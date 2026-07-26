import { Notice } from 'obsidian';
import { getTemplate } from '../../ai/templates/registry';
import { isAbortError } from '../../queue/progress';
import { renderVideoCollectionNote } from '../../rendering/videoCollectionNote';
import type {
	CollectionItemResult,
	TranscriptResponse,
	VideoCollectionEntry,
	VideoCollectionResponse,
	VideoCollectionTranscriptResponse,
} from '../../types';
import { thumbnailUrlForQuality } from '../../youtube/metadata';
import { isMetadataOnlyRun, shouldGenerateAiSummary } from '../aiPolicy';
import { INSERT_AT_CARET_REQUIRES_NOTE } from '../constants';
import type { EffectiveGenerationOptions } from '../effectiveOptions';
import { fetchTranscriptForUrl, fetchVideoDataForUrl } from '../fetch';
import { buildCombinedCollectionBaseName, buildPerVideoBaseName } from '../noteNaming';
import {
	appendCanceledEntries,
	buildCollectionReportEntry,
	classifyCollectionEntryError,
	countCollectionOutcomes,
} from '../reportEntries';
import type { NoteInsertionTarget, ProgressState } from '../targets/noteTargets';
import { generateAiCompletion, generateAiText, type AiContentContext } from './aiContent';
import type { GenerationWorkflowContext } from './context';
import { generateSingleVideoToTarget } from './singleVideo';

interface CombinedCollectionTarget {
	target: NoteInsertionTarget;
	isAppendMode: boolean;
	titleToRenameTo: string | null;
}

interface CombinedCollectionTranscripts {
	transcripts: TranscriptResponse[];
	reportEntries: CollectionItemResult[];
}

function collectionLabel(collection: VideoCollectionResponse, capitalize = false): string {
	const label = 'channelId' in collection ? 'channel' : 'playlist';
	return capitalize ? `${label[0].toUpperCase()}${label.slice(1)}` : label;
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
	collection: VideoCollectionResponse,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
): Promise<CombinedCollectionTarget> {
	let target: NoteInsertionTarget;
	if (effectiveOptions.noteDestinationMode === 'folder') {
		target = await context.targets.createFolderTarget(
			effectiveOptions.noteDestinationFolder ?? '',
			buildCombinedCollectionBaseName(collection, effectiveOptions),
		);
		await context.maybeOpenCreatedNote?.(target);
	} else {
		target = initialTarget!;
	}

	return {
		target,
		isAppendMode: effectiveOptions.noteDestinationMode === 'append-to-active-note',
		titleToRenameTo: effectiveOptions.noteDestinationMode === 'current-note' && effectiveOptions.useVideoTitleAsNoteName
			? collection.title
			: null,
	};
}

async function fetchCombinedCollectionTranscripts(
	context: GenerationWorkflowContext,
	collection: VideoCollectionResponse,
	targetInfo: CombinedCollectionTarget,
	effectiveOptions: EffectiveGenerationOptions,
	progressState: ProgressState,
	signal: AbortSignal,
	onTranscript?: (transcript: TranscriptResponse, entry: VideoCollectionEntry, index: number) => Promise<void>,
): Promise<CombinedCollectionTranscripts> {
	const transcripts: TranscriptResponse[] = [];
	const reportEntries: CollectionItemResult[] = [];

	for (const [index, entry] of collection.entries.entries()) {
		if (signal.aborted) {
			appendCanceledEntries(collection.entries, reportEntries, index);
			break;
		}

		try {
			if (!targetInfo.isAppendMode) {
				await context.targets.showProgress(targetInfo.target, entry.url, `Fetching transcript ${index + 1}/${collection.entries.length}…`, progressState);
			}
			context.onStatusBar(`Fetching ${collectionLabel(collection)} transcript ${index + 1}/${collection.entries.length}…`);
			const transcriptResult = await fetchTranscriptForUrl(context.youtubeService, entry.url, effectiveOptions, signal);
			const transcript = transcriptResult.transcript;

			await onTranscript?.(transcript, entry, index);
			transcripts.push(transcript);
			reportEntries.push(buildCollectionReportEntry(entry, 'completed', {
				title: transcript.title,
				transcriptLanguageCode: transcriptResult.languageCode,
			}));
		} catch (error) {
			const classified = classifyCollectionEntryError(error, effectiveOptions, signal);
			if (classified.kind === 'cancel') {
				reportEntries.push(buildCollectionReportEntry(entry, 'canceled', { reason: classified.message }));
				appendCanceledEntries(collection.entries, reportEntries, index + 1);
				break;
			}
			if (classified.kind === 'transcript-fail') {
				throw error;
			}
			reportEntries.push(buildCollectionReportEntry(
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
	targetInfo: CombinedCollectionTarget,
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

async function cancelCombinedCollection(
	context: GenerationWorkflowContext,
	collection: VideoCollectionResponse,
	target: NoteInsertionTarget,
	reportEntries: CollectionItemResult[],
): Promise<{ notePath: null; entries: CollectionItemResult[]; warnings: string[] }> {
	await context.targets.deleteTargetIfDisposable(target);
	const { completed, canceled } = countCollectionOutcomes(reportEntries);
	new Notice(`${collectionLabel(collection, true)} generation canceled (${completed} completed, ${canceled} canceled).`);
	return { notePath: null, entries: reportEntries, warnings: [] };
}

function notifyRenderWarnings(warnings: string[]): void {
	for (const warning of warnings) {
		if (/\b(?:required|requested) section\b/i.test(warning)) {
			new Notice(`Note generated with warning: ${warning}`);
		}
	}
}

async function generateCombinedMetadataCollectionNote(
	context: GenerationWorkflowContext,
	collection: VideoCollectionResponse,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
	progressState: ProgressState,
	signal: AbortSignal,
): Promise<{ notePath: string | null; entries: CollectionItemResult[]; warnings: string[] }> {
	requireCombinedInitialTarget(initialTarget, effectiveOptions);
	if (signal.aborted) {
		throw signal.reason;
	}

	const targetInfo = await resolveCombinedTarget(context, collection, initialTarget, effectiveOptions);

	if (!targetInfo.isAppendMode) {
		await context.targets.showProgress(targetInfo.target, collection.url, `Rendering ${collectionLabel(collection)} metadata…`, progressState);
	}
	context.onStatusBar(`Rendering ${collectionLabel(collection)} metadata…`);

	const collectionForRender: VideoCollectionTranscriptResponse = { ...collection, transcripts: [] };
	const { content, warnings } = renderVideoCollectionNote(collectionForRender, null, null, effectiveOptions, null, targetInfo.isAppendMode ? 'fragment' : 'standalone');
	notifyRenderWarnings(warnings);
	const notePath = await writeCombinedNote(context, targetInfo, content, progressState);

	const entries = collection.entries.map((entry) => buildCollectionReportEntry(entry, 'completed', { notePath }));
	new Notice(`${collectionLabel(collection, true)} metadata note generated (${entries.length} completed).`);
	return { notePath, entries, warnings };
}

async function generateCombinedTranscriptCollectionNote(
	context: GenerationWorkflowContext,
	collection: VideoCollectionResponse,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
	progressState: ProgressState,
	signal: AbortSignal,
): Promise<{ notePath: string | null; entries: CollectionItemResult[]; warnings: string[] }> {
	requireCombinedInitialTarget(initialTarget, effectiveOptions);
	if (signal.aborted) {
		throw signal.reason;
	}

	const targetInfo = await resolveCombinedTarget(context, collection, initialTarget, effectiveOptions);
	const { transcripts, reportEntries } = await fetchCombinedCollectionTranscripts(
		context, collection, targetInfo, effectiveOptions, progressState, signal,
	);

	if (signal.aborted) {
		return cancelCombinedCollection(context, collection, targetInfo.target, reportEntries);
	}

	if (transcripts.length === 0) {
		await context.targets.deleteTargetIfDisposable(targetInfo.target);
		throw new Error(`No ${collectionLabel(collection)} transcripts could be fetched.`);
	}

	if (!targetInfo.isAppendMode) {
		await context.targets.showProgress(targetInfo.target, collection.url, `Rendering ${collectionLabel(collection)} transcripts…`, progressState);
	}
	context.onStatusBar(`Rendering ${collectionLabel(collection)} transcripts…`);

	const collectionWithTranscripts: VideoCollectionTranscriptResponse = { ...collection, transcripts };
	const thumbnailUrl = transcripts[0] ? thumbnailUrlForQuality(transcripts[0].videoId, 'medium') : null;
	const { content, warnings } = renderVideoCollectionNote(collectionWithTranscripts, thumbnailUrl, null, effectiveOptions, null, targetInfo.isAppendMode ? 'fragment' : 'standalone');
	notifyRenderWarnings(warnings);

	if (targetInfo.isAppendMode) {
		context.onStatusBar('Rendering note…');
	}
	const notePath = await writeCombinedNote(context, targetInfo, content, progressState);
	const finalEntries = reportEntries.map((e) => (e.outcome === 'completed' ? { ...e, notePath } : e));
	const { completed, skipped, failed } = countCollectionOutcomes(finalEntries);
	new Notice(`${collectionLabel(collection, true)} transcript note generated (${completed} completed, ${skipped} skipped, ${failed} failed).`);
	return { notePath, entries: finalEntries, warnings };
}

async function generateCombinedCollectionNote(
	context: GenerationWorkflowContext,
	collection: VideoCollectionResponse,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
	aiContext: AiContentContext | null,
	progressState: ProgressState,
	signal: AbortSignal,
): Promise<{ notePath: string | null; entries: CollectionItemResult[]; warnings: string[] }> {
	if (isMetadataOnlyRun(effectiveOptions)) {
		return generateCombinedMetadataCollectionNote(context, collection, initialTarget, effectiveOptions, progressState, signal);
	}

	if (!aiContext) {
		return generateCombinedTranscriptCollectionNote(context, collection, initialTarget, effectiveOptions, progressState, signal);
	}

	requireCombinedInitialTarget(initialTarget, effectiveOptions);
	const targetInfo = await resolveCombinedTarget(context, collection, initialTarget, effectiveOptions);
	const generateSummary = shouldGenerateAiSummary(effectiveOptions);
	const videoSummaries: Array<{ transcript: TranscriptResponse; summary: string }> = [];
	const aiWarnings: string[] = [];
	const { transcripts, reportEntries } = await fetchCombinedCollectionTranscripts(
		context,
		collection,
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
						? `Summarizing ${collectionLabel(collection)} video ${index + 1}/${collection.entries.length}…`
						: `Extracting ${collectionLabel(collection)} add-ons ${index + 1}/${collection.entries.length}…`,
					progressState,
				);
			}
			context.onStatusBar(generateSummary
				? `Summarizing ${collectionLabel(collection)} video ${index + 1}/${collection.entries.length}…`
				: `Extracting ${collectionLabel(collection)} add-ons ${index + 1}/${collection.entries.length}…`);
			const aiResult = await generateAiText(
				context, aiContext, transcript, entry.url, targetInfo.target, progressState, signal, generateSummary,
			);

			aiWarnings.push(...aiResult.warnings);
			videoSummaries.push({ transcript, summary: aiResult.text });
		},
	);

	if (signal.aborted) {
		return cancelCombinedCollection(context, collection, targetInfo.target, reportEntries);
	}

	if (videoSummaries.length === 0) {
		await context.targets.deleteTargetIfDisposable(targetInfo.target);
		throw new Error(generateSummary
			? `No ${collectionLabel(collection)} videos could be summarized.`
			: `No ${collectionLabel(collection)} videos could be processed for AI add-ons.`);
	}

	const finalProgress = generateSummary
		? `Generating combined ${collectionLabel(collection)} note content…`
		: `Generating combined ${collectionLabel(collection)} add-ons…`;
	if (!targetInfo.isAppendMode) {
		await context.targets.showProgress(targetInfo.target, collection.url, finalProgress, progressState);
	}
	context.onStatusBar(finalProgress);

	let summary: string;
	try {
		const collectionWithTranscripts: VideoCollectionTranscriptResponse = { ...collection, transcripts };
		const synthesis = await generateAiCompletion(
			aiContext,
			generateSummary
				? aiContext.promptService.buildCollectionSynthesisPrompt(collectionWithTranscripts, videoSummaries)
				: aiContext.promptService.buildCollectionAddonsSynthesisPrompt(collectionWithTranscripts, videoSummaries),
			signal,
		);
		summary = synthesis.text;
		aiWarnings.push(...synthesis.warnings);
	} catch (error) {
		if (isAbortError(error, signal)) {
			return cancelCombinedCollection(context, collection, targetInfo.target, reportEntries);
		}
		throw error;
	}

	const collectionWithTranscripts: VideoCollectionTranscriptResponse = { ...collection, transcripts };
	const thumbnailUrl = transcripts[0] ? thumbnailUrlForQuality(transcripts[0].videoId, 'medium') : null;
	const template = generateSummary && effectiveOptions.instructionMode !== 'manual'
		? getTemplate(effectiveOptions.instructionTemplate)
		: null;
	const { content, warnings: renderWarnings } = renderVideoCollectionNote(collectionWithTranscripts, thumbnailUrl, summary, effectiveOptions, template, targetInfo.isAppendMode ? 'fragment' : 'standalone');
	notifyRenderWarnings(renderWarnings);
	if (targetInfo.isAppendMode) {
		context.onStatusBar('Rendering note…');
	}
	const notePath = await writeCombinedNote(context, targetInfo, content, progressState);
	const finalEntries = reportEntries.map((e) => (e.outcome === 'completed' ? { ...e, notePath } : e));
	const { completed, skipped, failed } = countCollectionOutcomes(finalEntries);
	new Notice(`${collectionLabel(collection, true)} note generated (${completed} completed, ${skipped} skipped, ${failed} failed).`);
	return { notePath, entries: finalEntries, warnings: [...aiWarnings, ...renderWarnings] };
}

async function generatePerVideoCollectionNotes(
	context: GenerationWorkflowContext,
	collection: VideoCollectionResponse,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
	aiContext: AiContentContext | null,
	progressState: ProgressState,
	signal: AbortSignal,
): Promise<CollectionItemResult[]> {
	if (effectiveOptions.noteDestinationMode === 'append-to-active-note') {
		throw new Error('Append to active note cannot be used with One note per video. Choose One combined note or a different destination.');
	}

	const reportEntries: CollectionItemResult[] = [];
	const metadataOnly = isMetadataOnlyRun(effectiveOptions);

	for (const [index, entry] of collection.entries.entries()) {
		if (signal.aborted) {
			appendCanceledEntries(collection.entries, reportEntries, index);
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
				await context.targets.showProgress(target, entry.url, metadataOnly ? 'Fetching video metadata…' : 'Fetching transcript…', progressState);
			}

			context.onStatusBar(metadataOnly
				? `Fetching ${collectionLabel(collection)} video metadata ${index + 1}/${collection.entries.length}…`
				: `Fetching ${collectionLabel(collection)} transcript ${index + 1}/${collection.entries.length}…`);
			const videoData = await fetchVideoDataForUrl(context.youtubeService, entry.url, effectiveOptions, signal);
			const transcript = videoData.transcript;

			if (!target) {
				const baseName = buildPerVideoBaseName(collection, transcript, index + 1, effectiveOptions);
				if (effectiveOptions.noteDestinationMode === 'folder') {
					target = await context.targets.createFolderTarget(effectiveOptions.noteDestinationFolder ?? '', baseName);
					await context.maybeOpenCreatedNote?.(target);
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

			reportEntries.push(buildCollectionReportEntry(entry, 'completed', {
				title: transcript.title,
				transcriptLanguageCode: videoData.languageCode,
				notePath: target.file.path,
				warnings: videoWarnings.length > 0 ? videoWarnings : undefined,
			}));
		} catch (error) {
			const classified = classifyCollectionEntryError(error, effectiveOptions, signal);
			if (classified.kind === 'cancel') {
				await context.targets.deleteTargetIfDisposable(target);
				reportEntries.push(buildCollectionReportEntry(entry, 'canceled', { reason: classified.message }));
				appendCanceledEntries(collection.entries, reportEntries, index + 1);
				break;
			}
			await context.targets.deleteTargetIfDisposable(target);
			if (classified.kind === 'transcript-fail') {
				throw error;
			}
			reportEntries.push(buildCollectionReportEntry(
				entry,
				classified.kind === 'transcript-skip' ? 'skipped' : 'failed',
				{ reason: classified.message },
			));
		}
	}

	const { completed, skipped, failed, canceled } = countCollectionOutcomes(reportEntries);
	if (signal.aborted) {
		new Notice(`${collectionLabel(collection, true)} generation canceled (${completed} completed, ${canceled} canceled).`);
	} else {
		new Notice(`${collectionLabel(collection, true)} generation finished (${completed} completed, ${skipped} skipped, ${failed} failed).`);
	}
	return reportEntries;
}

async function generateVideoCollectionNotes(
	context: GenerationWorkflowContext,
	url: string,
	kind: 'playlist' | 'channel',
	fetchCollection: () => Promise<VideoCollectionResponse>,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
	aiContext: AiContentContext | null,
	progressState: ProgressState,
	signal: AbortSignal,
): Promise<{ collection: VideoCollectionResponse; notePath: string | null; entries: CollectionItemResult[]; warnings: string[] }> {
	if (effectiveOptions.noteDestinationMode === 'current-note') {
		if (!initialTarget) {
			throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
		}
		await context.targets.showProgress(initialTarget, url, `Fetching ${kind}…`, progressState);
	} else if (effectiveOptions.noteDestinationMode === 'append-to-active-note') {
		if (!initialTarget) {
			throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
		}
	}

	context.onStatusBar(`Fetching ${kind}…`);
	new Notice(`Fetching ${kind} videos…`);
	const collection = await fetchCollection();

	if (effectiveOptions.noteDestinationMode === 'folder') {
		await context.targets.ensureFolderExists(effectiveOptions.noteDestinationFolder ?? '');
	}

	if (effectiveOptions.playlistMode === 'combined') {
		const { notePath, entries, warnings } = await generateCombinedCollectionNote(
			context, collection, initialTarget, effectiveOptions, aiContext, progressState, signal,
		);
		return { collection, notePath, entries, warnings };
	}

	const entries = await generatePerVideoCollectionNotes(
		context, collection, initialTarget, effectiveOptions, aiContext, progressState, signal,
	);
	return { collection, notePath: null, entries, warnings: [] };
}

export async function generatePlaylistNotes(
	context: GenerationWorkflowContext,
	url: string,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
	aiContext: AiContentContext | null,
	progressState: ProgressState,
	signal: AbortSignal,
): Promise<{ playlist: Extract<VideoCollectionResponse, { playlistId: string }>; notePath: string | null; entries: CollectionItemResult[]; warnings: string[] }> {
	const result = await generateVideoCollectionNotes(
		context,
		url,
		'playlist',
		() => context.youtubeService.fetchPlaylist(url),
		initialTarget,
		effectiveOptions,
		aiContext,
		progressState,
		signal,
	);
	const { collection, ...runResult } = result;
	return { ...runResult, playlist: collection as Extract<VideoCollectionResponse, { playlistId: string }> };
}

export async function generateChannelNotes(
	context: GenerationWorkflowContext,
	url: string,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
	aiContext: AiContentContext | null,
	progressState: ProgressState,
	signal: AbortSignal,
): Promise<{ channel: Extract<VideoCollectionResponse, { channelId: string }>; notePath: string | null; entries: CollectionItemResult[]; warnings: string[] }> {
	const result = await generateVideoCollectionNotes(
		context,
		url,
		'channel',
		() => context.youtubeService.fetchChannel(url, {
			contentTypes: effectiveOptions.channelContentTypes,
			videoLimit: effectiveOptions.channelVideoLimit,
		}),
		initialTarget,
		effectiveOptions,
		aiContext,
		progressState,
		signal,
	);
	const { collection, ...runResult } = result;
	return { ...runResult, channel: collection as Extract<VideoCollectionResponse, { channelId: string }> };
}
