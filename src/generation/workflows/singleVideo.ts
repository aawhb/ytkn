import { Notice } from 'obsidian';
import type { TranscriptResponse } from '../../types';
import { getTemplate } from '../../ai/templates/registry';
import { renderVideoNote } from '../../rendering/videoNote';
import { YouTubeService } from '../../youtube/youtubeService';
import { INSERT_AT_CARET_REQUIRES_NOTE } from '../constants';
import type { EffectiveGenerationOptions } from '../effectiveOptions';
import { fetchVideoDataForUrl } from '../fetch';
import { isMetadataOnlyRun, shouldGenerateAiSummary } from '../aiPolicy';
import { buildSingleVideoBaseName } from '../noteNaming';
import type { NoteInsertionTarget, ProgressState } from '../targets/noteTargets';
import { generateAiText, type AiContentContext } from './aiContent';
import type { GenerationWorkflowContext } from './context';

export async function generateSingleVideoToTarget(
	context: GenerationWorkflowContext,
	url: string,
	target: NoteInsertionTarget,
	transcript: TranscriptResponse,
	effectiveOptions: EffectiveGenerationOptions,
	aiContext: AiContentContext | null,
	progressState: ProgressState,
	titleToRenameTo: string | null,
	signal: AbortSignal,
): Promise<string[]> {
	progressState.target = target;
	progressState.url = url;
	const isAppendMode = effectiveOptions.noteDestinationMode === 'append-to-active-note';
	if (!isAppendMode) {
		progressState.hasProgressContent = true;
	}

	const thumbnailUrl = transcript.thumbnailUrl ?? YouTubeService.getThumbnailUrl(transcript.videoId);
	const generateSummary = shouldGenerateAiSummary(effectiveOptions);
	const summary = aiContext
		? await generateAiText(context, aiContext, transcript, url, target, progressState, signal, generateSummary)
		: null;

	const template = generateSummary && effectiveOptions.instructionMode !== 'manual'
		? getTemplate(effectiveOptions.instructionTemplate)
		: null;
	const { content, warnings } = renderVideoNote(transcript, thumbnailUrl, url, summary, effectiveOptions, template, isAppendMode ? 'fragment' : 'standalone');
	for (const warning of warnings) {
		if (warning.toLowerCase().includes('required section')) {
			new Notice(`Note generated with warning: ${warning}`);
		}
	}
	if (isAppendMode) {
		context.onStatusBar('Rendering note...');
		await context.targets.appendContentToTarget(target, content);
		target.finalized = true;
	} else {
		await context.targets.finalizeTargetNote(target, content, titleToRenameTo, progressState);
	}
	return warnings;
}

export async function generateSingleVideoNote(
	context: GenerationWorkflowContext,
	url: string,
	initialTarget: NoteInsertionTarget | null,
	effectiveOptions: EffectiveGenerationOptions,
	aiContext: AiContentContext | null,
	progressState: ProgressState,
	signal: AbortSignal,
): Promise<{ notePath: string | null; transcriptLanguageCode: string | undefined; warnings: string[] }> {
	let target: NoteInsertionTarget | null = initialTarget;
	let titleToRenameTo: string | null = null;
	const metadataOnly = isMetadataOnlyRun(effectiveOptions);
	const fetchStatus = metadataOnly ? 'Fetching video metadata...' : 'Fetching transcript...';

	if (effectiveOptions.noteDestinationMode === 'current-note') {
		if (!target) {
			throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
		}
		await context.targets.showProgress(target, url, fetchStatus, progressState);
	} else if (effectiveOptions.noteDestinationMode === 'append-to-active-note') {
		if (!target) {
			throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
		}
		// Skip showProgress - do not write progress markers into the user's existing note
	}

	context.onStatusBar(metadataOnly ? 'Fetching video metadata…' : 'Fetching transcript…');
	new Notice(metadataOnly ? 'Fetching video metadata…' : 'Fetching video transcript…');
	const videoData = await fetchVideoDataForUrl(context.youtubeService, url, effectiveOptions, signal);
	const transcript = videoData.transcript;

	if (effectiveOptions.noteDestinationMode === 'folder') {
		target = await context.targets.createFolderTarget(
			effectiveOptions.noteDestinationFolder ?? '',
			buildSingleVideoBaseName(transcript, effectiveOptions),
		);
	} else if (effectiveOptions.noteDestinationMode !== 'append-to-active-note' && effectiveOptions.useVideoTitleAsNoteName) {
		titleToRenameTo = transcript.title;
	}

	if (aiContext) {
		new Notice(shouldGenerateAiSummary(effectiveOptions) ? 'Generating summary…' : 'Generating AI add-ons…');
	}

	if (!target) {
		throw new Error('Internal error: missing note target.');
	}

	let warnings: string[];
	try {
		warnings = await generateSingleVideoToTarget(
			context, url, target, transcript, effectiveOptions, aiContext, progressState, titleToRenameTo, signal,
		);
	} catch (error) {
		await context.targets.deleteTargetIfDisposable(target);
		throw error;
	}

	new Notice(aiContext ? 'Knowledge note generated.' : metadataOnly ? 'Metadata note generated.' : 'Transcript note generated.');
	return { notePath: target.file.path, transcriptLanguageCode: videoData.languageCode, warnings };
}
