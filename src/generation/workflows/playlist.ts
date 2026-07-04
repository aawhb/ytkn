import { Notice } from 'obsidian';
import { getTemplate } from '../../ai/templates/registry';
import { isAbortError } from '../../queue/progress';
import { renderPlaylistNote } from '../../rendering/playlistNote';
import type {
	PlaylistEntry,
	PlaylistResponse,
	PlaylistRunReportEntry,
	PlaylistTranscriptResponse,
	TranscriptResponse,
} from '../../types';
import { thumbnailUrlForQuality } from '../../youtube/metadata';
import { isMetadataOnlyRun, shouldGenerateAiSummary } from '../aiPolicy';
import { INSERT_AT_CARET_REQUIRES_NOTE } from '../constants';
import type { EffectiveGenerationOptions } from '../effectiveOptions';
import { fetchTranscriptForUrl, fetchVideoDataForUrl } from '../fetch';
import { buildCombinedPlaylistBaseName, buildPerVideoBaseName } from '../noteNaming';
import {
	appendCanceledEntries,
	buildPlaylistReportEntry,
	classifyPlaylistEntryError,
	countPlaylistOutcomes,
} from '../reportEntries';
import type { NoteInsertionTarget, ProgressState } from '../targets/noteTargets';
import { generateAiCompletion, generateAiText, type AiContentContext } from './aiContent';
import type { GenerationWorkflowContext } from './context';
import { generateSingleVideoToTarget } from './singleVideo';

interface CombinedPlaylistTarget {
	target: NoteInsertionTarget;
	isAppendMode: boolean;
	titleToRenameTo: string | null;
}

interface CombinedPlaylistTranscripts {
	transcripts: TranscriptResponse[];
	reportEntries: PlaylistRunReportEntry[];
}

function requireCombinedInitialTarget(
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
): void {
	if ((effectiveOptions.noteDestinationMode === 'current-note' || effectiveOptions.noteDestinationMode === 'append-to-active-note') && !initialTarget) {
		throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
	}
}

async function resolveCombinedTarget(
	context: GenerationWorkflowContext,
	playlist: PlaylistResponse,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
): Promise<CombinedPlaylistTarget> {
	return {
		target: effectiveOptions.noteDestinationMode === 'folder'
			? await context.targets.createFolderTarget(
				effectiveOptions.noteDestinationFolder ?? '',
				buildCombinedPlaylistBaseName(playlist, effectiveOptions),
			)
			: initialTarget!,
		isAppendMode: effectiveOptions.noteDestinationMode === 'append-to-active-note',
		titleToRenameTo: effectiveOptions.noteDestinationMode === 'current-note' && effectiveOptions.useVideoTitleAsNoteName
			? playlist.title
			: null,
	};
}

async function fetchCombinedPlaylistTranscripts(
	context: GenerationWorkflowContext,
	playlist: PlaylistResponse,
	targetInfo: CombinedPlaylistTarget,
	effectiveOptions: EffectiveGenerationOptions,
	progressState: ProgressState,
	signal: AbortSignal,
	onTranscript?: (transcript: TranscriptResponse, entry: PlaylistEntry, index: number) => Promise<void>,
): Promise<CombinedPlaylistTranscripts> {
	const transcripts: TranscriptResponse[] = [];
	const reportEntries: PlaylistRunReportEntry[] = [];

	for (const [index, entry] of playlist.entries.entries()) {
		if (signal.aborted) {
			appendCanceledEntries(playlist.entries, reportEntries, index);
			break;
		}

		try {
			if (!targetInfo.isAppendMode) {
				await context.targets.showProgress(targetInfo.target, entry.url, `Fetching transcript ${index + 1}/${playlist.entries.length}...`, progressState);
			}
			context.onStatusBar(`Fetching playlist transcript ${index + 1}/${playlist.entries.length}...`);
			const transcriptResult = await fetchTranscriptForUrl(context.youtubeService, entry.url, effectiveOptions, signal);
			const transcript = transcriptResult.transcript;

			await onTranscript?.(transcript, entry, index);
			transcripts.push(transcript);
			reportEntries.push(buildPlaylistReportEntry(entry, 'completed', {
				title: transcript.title,
				transcriptLanguageCode: transcriptResult.languageCode,
			}));
		} catch (error) {
			const classified = classifyPlaylistEntryError(error, effectiveOptions, signal);
			if (classified.kind === 'cancel') {
				reportEntries.push(buildPlaylistReportEntry(entry, 'canceled', { reason: classified.message }));
				appendCanceledEntries(playlist.entries, reportEntries, index + 1);
				break;
			}
			if (classified.kind === 'transcript-fail') {
				throw error;
			}
			reportEntries.push(buildPlaylistReportEntry(
				entry,
				classified.kind === 'transcript-skip' ? 'skipped' : 'failed',
				{ reason: classified.message },
			));
		}
	}

	return { transcripts, reportEntries };
}

async function writeCombinedNote(
	context: GenerationWorkflowContext,
	targetInfo: CombinedPlaylistTarget,
	content: string,
	progressState: ProgressState,
): Promise<string> {
	if (targetInfo.isAppendMode) {
		await context.targets.appendContentToTarget(targetInfo.target, content);
		targetInfo.target.finalized = true;
	} else {
		await context.targets.finalizeTargetNote(
			targetInfo.target,
			content,
			targetInfo.titleToRenameTo,
			progressState,
		);
	}
	return targetInfo.target.file.path;
}

async function cancelCombinedPlaylist(
	context: GenerationWorkflowContext,
	target: NoteInsertionTarget,
	reportEntries: PlaylistRunReportEntry[],
): Promise<{ notePath: null; entries: PlaylistRunReportEntry[]; warnings: string[] }> {
	await context.targets.deleteTargetIfDisposable(target);
	const { completed, canceled } = countPlaylistOutcomes(reportEntries);
	new Notice(`Playlist generation canceled (${completed} completed, ${canceled} canceled).`);
	return { notePath: null, entries: reportEntries, warnings: [] };
}

function notifyRenderWarnings(warnings: string[]): void {
	for (const warning of warnings) {
		if (/\b(?:required|requested) section\b/i.test(warning)) {
			new Notice(`Note generated with warning: ${warning}`);
		}
	}
}

async function generateCombinedMetadataPlaylistNote(
	context: GenerationWorkflowContext,
	playlist: PlaylistResponse,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
	progressState: ProgressState,
	signal: AbortSignal,
): Promise<{ notePath: string | null; entries: PlaylistRunReportEntry[]; warnings: string[] }> {
	requireCombinedInitialTarget(initialTarget, effectiveOptions);
	if (signal.aborted) {
		throw signal.reason;
	}

	const targetInfo = await resolveCombinedTarget(context, playlist, initialTarget, effectiveOptions);

	if (!targetInfo.isAppendMode) {
		await context.targets.showProgress(targetInfo.target, playlist.url, 'Rendering playlist metadata...', progressState);
	}
	context.onStatusBar('Rendering playlist metadata...');

	const playlistForRender: PlaylistTranscriptResponse = { ...playlist, transcripts: [] };
	const { content, warnings } = renderPlaylistNote(playlistForRender, null, null, effectiveOptions, null, targetInfo.isAppendMode ? 'fragment' : 'standalone');
	notifyRenderWarnings(warnings);
	const notePath = await writeCombinedNote(context, targetInfo, content, progressState);

	const entries = playlist.entries.map((entry) => buildPlaylistReportEntry(entry, 'completed', { notePath }));
	new Notice(`Playlist metadata note generated (${entries.length} completed).`);
	return { notePath, entries, warnings };
}

async function generateCombinedTranscriptPlaylistNote(
	context: GenerationWorkflowContext,
	playlist: PlaylistResponse,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
	progressState: ProgressState,
	signal: AbortSignal,
): Promise<{ notePath: string | null; entries: PlaylistRunReportEntry[]; warnings: string[] }> {
	requireCombinedInitialTarget(initialTarget, effectiveOptions);
	if (signal.aborted) {
		throw signal.reason;
	}

	const targetInfo = await resolveCombinedTarget(context, playlist, initialTarget, effectiveOptions);
	const { transcripts, reportEntries } = await fetchCombinedPlaylistTranscripts(
		context, playlist, targetInfo, effectiveOptions, progressState, signal,
	);

	if (signal.aborted) {
		return cancelCombinedPlaylist(context, targetInfo.target, reportEntries);
	}

	if (transcripts.length === 0) {
		await context.targets.deleteTargetIfDisposable(targetInfo.target);
		throw new Error('No playlist transcripts could be fetched.');
	}

	if (!targetInfo.isAppendMode) {
		await context.targets.showProgress(targetInfo.target, playlist.url, 'Rendering playlist transcripts...', progressState);
	}
	context.onStatusBar('Rendering playlist transcripts...');

	const playlistWithTranscripts: PlaylistTranscriptResponse = { ...playlist, transcripts };
	const thumbnailUrl = transcripts[0] ? thumbnailUrlForQuality(transcripts[0].videoId, 'medium') : null;
	const { content, warnings } = renderPlaylistNote(playlistWithTranscripts, thumbnailUrl, null, effectiveOptions, null, targetInfo.isAppendMode ? 'fragment' : 'standalone');
	notifyRenderWarnings(warnings);

	if (targetInfo.isAppendMode) {
		context.onStatusBar('Rendering note...');
	}
	const notePath = await writeCombinedNote(context, targetInfo, content, progressState);
	const finalEntries = reportEntries.map((e) => (e.outcome === 'completed' ? { ...e, notePath } : e));
	const { completed, skipped, failed } = countPlaylistOutcomes(finalEntries);
	new Notice(`Playlist transcript note generated (${completed} completed, ${skipped} skipped, ${failed} failed).`);
	return { notePath, entries: finalEntries, warnings };
}

async function generateCombinedPlaylistNote(
	context: GenerationWorkflowContext,
	playlist: PlaylistResponse,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
	aiContext: AiContentContext | null,
	progressState: ProgressState,
	signal: AbortSignal,
): Promise<{ notePath: string | null; entries: PlaylistRunReportEntry[]; warnings: string[] }> {
	if (isMetadataOnlyRun(effectiveOptions)) {
		return generateCombinedMetadataPlaylistNote(context, playlist, initialTarget, effectiveOptions, progressState, signal);
	}

	if (!aiContext) {
		return generateCombinedTranscriptPlaylistNote(context, playlist, initialTarget, effectiveOptions, progressState, signal);
	}

	requireCombinedInitialTarget(initialTarget, effectiveOptions);
	const targetInfo = await resolveCombinedTarget(context, playlist, initialTarget, effectiveOptions);
	const generateSummary = shouldGenerateAiSummary(effectiveOptions);
	const videoSummaries: Array<{ transcript: TranscriptResponse; summary: string }> = [];
	const aiWarnings: string[] = [];
	const { transcripts, reportEntries } = await fetchCombinedPlaylistTranscripts(
		context,
		playlist,
		targetInfo,
		effectiveOptions,
		progressState,
		signal,
		async (transcript, entry, index) => {
			if (!targetInfo.isAppendMode) {
				await context.targets.showProgress(
					targetInfo.target,
					entry.url,
					generateSummary
						? `Summarizing playlist video ${index + 1}/${playlist.entries.length}...`
						: `Extracting playlist add-ons ${index + 1}/${playlist.entries.length}...`,
					progressState,
				);
			}
			context.onStatusBar(generateSummary
				? `Summarizing playlist video ${index + 1}/${playlist.entries.length}...`
				: `Extracting playlist add-ons ${index + 1}/${playlist.entries.length}...`);
			const aiResult = await generateAiText(
				context, aiContext, transcript, entry.url, targetInfo.target, progressState, signal, generateSummary,
			);

			aiWarnings.push(...aiResult.warnings);
			videoSummaries.push({ transcript, summary: aiResult.text });
		},
	);

	if (signal.aborted) {
		return cancelCombinedPlaylist(context, targetInfo.target, reportEntries);
	}

	if (videoSummaries.length === 0) {
		await context.targets.deleteTargetIfDisposable(targetInfo.target);
		throw new Error(generateSummary ? 'No playlist videos could be summarized.' : 'No playlist videos could be processed for AI add-ons.');
	}

	const finalProgress = generateSummary ? 'Generating combined playlist summary...' : 'Generating combined playlist add-ons...';
	if (!targetInfo.isAppendMode) {
		await context.targets.showProgress(targetInfo.target, playlist.url, finalProgress, progressState);
	}
	context.onStatusBar(finalProgress);

	let summary: string;
	try {
		const playlistWithTranscripts: PlaylistTranscriptResponse = { ...playlist, transcripts };
		const synthesis = await generateAiCompletion(
			aiContext,
			generateSummary
				? aiContext.promptService.buildPlaylistSynthesisPrompt(playlistWithTranscripts, videoSummaries)
				: aiContext.promptService.buildPlaylistAddonsSynthesisPrompt(playlistWithTranscripts, videoSummaries),
			signal,
		);
		summary = synthesis.text;
		aiWarnings.push(...synthesis.warnings);
	} catch (error) {
		if (isAbortError(error, signal)) {
			return cancelCombinedPlaylist(context, targetInfo.target, reportEntries);
		}
		throw error;
	}

	const playlistWithTranscripts: PlaylistTranscriptResponse = { ...playlist, transcripts };
	const thumbnailUrl = transcripts[0] ? thumbnailUrlForQuality(transcripts[0].videoId, 'medium') : null;
	const template = generateSummary && effectiveOptions.instructionMode !== 'manual'
		? getTemplate(effectiveOptions.instructionTemplate)
		: null;
	const { content, warnings: renderWarnings } = renderPlaylistNote(playlistWithTranscripts, thumbnailUrl, summary, effectiveOptions, template, targetInfo.isAppendMode ? 'fragment' : 'standalone');
	notifyRenderWarnings(renderWarnings);
	if (targetInfo.isAppendMode) {
		context.onStatusBar('Rendering note...');
	}
	const notePath = await writeCombinedNote(context, targetInfo, content, progressState);
	const finalEntries = reportEntries.map((e) => (e.outcome === 'completed' ? { ...e, notePath } : e));
	const { completed, skipped, failed } = countPlaylistOutcomes(finalEntries);
	new Notice(`Playlist note generated (${completed} completed, ${skipped} skipped, ${failed} failed).`);
	return { notePath, entries: finalEntries, warnings: [...aiWarnings, ...renderWarnings] };
}

async function generatePerVideoPlaylistNotes(
	context: GenerationWorkflowContext,
	playlist: PlaylistResponse,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
	aiContext: AiContentContext | null,
	progressState: ProgressState,
	signal: AbortSignal,
): Promise<PlaylistRunReportEntry[]> {
	if (effectiveOptions.noteDestinationMode === 'append-to-active-note') {
		throw new Error('Append to active note is not supported with per-video playlist mode. Switch to "Combined" playlist mode or choose a different destination.');
	}

	const reportEntries: PlaylistRunReportEntry[] = [];
	const metadataOnly = isMetadataOnlyRun(effectiveOptions);

	for (const [index, entry] of playlist.entries.entries()) {
		if (signal.aborted) {
			appendCanceledEntries(playlist.entries, reportEntries, index);
			break;
		}

		let target: NoteInsertionTarget | null = null;
		let titleToRenameTo: string | null = null;

		try {
			if (effectiveOptions.noteDestinationMode === 'current-note' && index === 0) {
				if (!initialTarget) {
					throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
				}
				target = initialTarget;
				await context.targets.showProgress(target, entry.url, metadataOnly ? 'Fetching video metadata...' : 'Fetching transcript...', progressState);
			}

			context.onStatusBar(metadataOnly
				? `Fetching playlist video metadata ${index + 1}/${playlist.entries.length}...`
				: `Fetching playlist transcript ${index + 1}/${playlist.entries.length}...`);
			const videoData = await fetchVideoDataForUrl(context.youtubeService, entry.url, effectiveOptions, signal);
			const transcript = videoData.transcript;

			if (!target) {
				const baseName = buildPerVideoBaseName(playlist, transcript, index + 1, effectiveOptions);
				if (effectiveOptions.noteDestinationMode === 'folder') {
					target = await context.targets.createFolderTarget(effectiveOptions.noteDestinationFolder ?? '', baseName);
				} else {
					if (!initialTarget) {
						throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
					}
					target = await context.targets.createAdjacentTarget(initialTarget.file, baseName);
				}
			} else if (effectiveOptions.useVideoTitleAsNoteName) {
				titleToRenameTo = transcript.title;
			}

			const videoWarnings = await generateSingleVideoToTarget(
				context, entry.url, target, transcript, effectiveOptions, aiContext, progressState, titleToRenameTo, signal,
			);

			reportEntries.push(buildPlaylistReportEntry(entry, 'completed', {
				title: transcript.title,
				transcriptLanguageCode: videoData.languageCode,
				notePath: target.file.path,
				warnings: videoWarnings.length > 0 ? videoWarnings : undefined,
			}));
		} catch (error) {
			const classified = classifyPlaylistEntryError(error, effectiveOptions, signal);
			if (classified.kind === 'cancel') {
				await context.targets.deleteTargetIfDisposable(target);
				reportEntries.push(buildPlaylistReportEntry(entry, 'canceled', { reason: classified.message }));
				appendCanceledEntries(playlist.entries, reportEntries, index + 1);
				break;
			}
			await context.targets.deleteTargetIfDisposable(target);
			if (classified.kind === 'transcript-fail') {
				throw error;
			}
			reportEntries.push(buildPlaylistReportEntry(
				entry,
				classified.kind === 'transcript-skip' ? 'skipped' : 'failed',
				{ reason: classified.message },
			));
		}
	}

	const { completed, skipped, failed, canceled } = countPlaylistOutcomes(reportEntries);
	if (signal.aborted) {
		new Notice(`Playlist generation canceled (${completed} completed, ${canceled} canceled).`);
	} else {
		new Notice(`Playlist generation finished (${completed} completed, ${skipped} skipped, ${failed} failed).`);
	}
	return reportEntries;
}

export async function generatePlaylistNotes(
	context: GenerationWorkflowContext,
	url: string,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
	aiContext: AiContentContext | null,
	progressState: ProgressState,
	signal: AbortSignal,
): Promise<{ playlist: PlaylistResponse; notePath: string | null; entries: PlaylistRunReportEntry[]; warnings: string[] }> {
	if (effectiveOptions.noteDestinationMode === 'current-note') {
		if (!initialTarget) {
			throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
		}
		await context.targets.showProgress(initialTarget, url, 'Fetching playlist...', progressState);
	} else if (effectiveOptions.noteDestinationMode === 'append-to-active-note') {
		if (!initialTarget) {
			throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
		}
		// Append mode must not write progress markers.
	}

	context.onStatusBar('Fetching playlist…');
	new Notice('Fetching playlist videos…');
	const playlist = await context.youtubeService.fetchPlaylist(url);

	if (effectiveOptions.noteDestinationMode === 'folder') {
		await context.targets.ensureFolderExists(effectiveOptions.noteDestinationFolder ?? '');
	}

	if (effectiveOptions.playlistMode === 'combined') {
		const { notePath, entries, warnings } = await generateCombinedPlaylistNote(
			context, playlist, initialTarget, effectiveOptions, aiContext, progressState, signal,
		);
		return { playlist, notePath, entries, warnings };
	}

	const entries = await generatePerVideoPlaylistNotes(
		context, playlist, initialTarget, effectiveOptions, aiContext, progressState, signal,
	);
	return { playlist, notePath: null, entries, warnings: [] };
}
