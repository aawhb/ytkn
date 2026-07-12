import type { GenerationOptions } from '../../types';
import { getTemplate } from '../../ai/templates/registry';
import { isChannelUrl, parseUrls } from '../../youtube/urls';
import { shouldGenerateAiSummary, shouldUseAi } from '../../aiOutputPolicy';
import type { GenerationFormState } from './generationFormState';

export type GenerationSubmitResult =
	| {
		ok: true;
		urls: string[];
		options: GenerationOptions;
		duplicateCount: number;
	}
	| {
		ok: false;
		message: string;
		duplicateCount: number;
	};

export function buildGenerationSubmit(state: GenerationFormState): GenerationSubmitResult {
	const trimmedUrl = state.url.trim();
	const parsedTemperature = Number(state.temperature.trim());
	const parsedTimeoutSecs = state.requestTimeoutSeconds.trim() ? Number(state.requestTimeoutSeconds.trim()) : undefined;
	const parsedChannelVideoLimit = state.channelVideoLimit.trim()
		? Number(state.channelVideoLimit.trim())
		: null;
	const trimmedManualInstructions = state.manualInstructions.trim();
	const trimmedFolder = state.noteDestinationFolder.trim();
	const effectiveUseAi = shouldUseAi(state);
	const effectiveGenerateAiSummary = shouldGenerateAiSummary(state);

	if (!trimmedUrl) {
		return failure('Paste at least one YouTube video, playlist, or channel URL.');
	}

	const parsedUrls = parseUrls(trimmedUrl);
	const urls = dedupeUrls(parsedUrls);
	const duplicateCount = parsedUrls.length - urls.length;
	const hasChannelUrl = urls.some(isChannelUrl);

	if (hasChannelUrl && state.channelContentTypes.length === 0) {
		return failure('Select at least one channel content type.', duplicateCount);
	}
	if (hasChannelUrl && parsedChannelVideoLimit !== null && (
		!Number.isInteger(parsedChannelVideoLimit) || parsedChannelVideoLimit < 1
	)) {
		return failure('Items per selected type must be a positive whole number, or choose All available.', duplicateCount);
	}

	if (
		!Number.isFinite(parsedTemperature) ||
		parsedTemperature < 0 ||
		parsedTemperature > 2
	) {
		return failure('Temperature must be between 0 and 2.', duplicateCount);
	}

	if (state.noteDestinationMode === 'folder' && !trimmedFolder) {
		return failure('Enter a destination folder, or switch to "current note".', duplicateCount);
	}

	if (effectiveUseAi && state.modelIds.length === 0) {
		return failure('Select an AI model, or turn off AI for transcript-only output.', duplicateCount);
	}

	if (
		effectiveGenerateAiSummary &&
		state.instructionMode === 'manual' &&
		!trimmedManualInstructions
	) {
		return failure('Enter manual instructions, or switch back to a built-in template.', duplicateCount);
	}

	if (
		effectiveGenerateAiSummary &&
		state.instructionMode === 'template'
	) {
		for (const control of getTemplate(state.instructionTemplate).controls ?? []) {
			if (control.required) {
				const value = state.controlValues[control.id];
				if (!value || !value.trim()) {
					return failure(`"${control.label}" is required for this template. Please fill it in.`, duplicateCount);
				}
			}
		}
	}

	return {
		ok: true,
		urls,
		duplicateCount,
		options: {
			useAi: effectiveUseAi,
			generateAiSummary: effectiveGenerateAiSummary,
			transcriptMode: state.transcriptMode,
			playlistMode: state.playlistMode,
			channelContentTypes: state.channelContentTypes,
			channelVideoLimit: parsedChannelVideoLimit,
			transcriptLanguageMode: state.transcriptLanguageMode,
			preferredTranscriptLanguage: state.preferredTranscriptLanguage,
			transcriptFailureMode: state.transcriptFailureMode,
			mediaEmbedMode: state.mediaEmbedMode,
			includeRunReport: state.includeRunReport,
			runReportLocation: state.runReportLocation,
			useVideoTitleAsNoteName: state.useVideoTitleAsNoteName,
			noteDestinationMode: state.noteDestinationMode,
			noteDestinationFolder: state.noteDestinationFolder,
			openCreatedNote: state.openCreatedNote,
			includeFrontmatter: state.includeFrontmatter,
			frontmatterTags: state.frontmatterTags,
			frontmatterPropertyAllowlist: state.frontmatterPropertyAllowlist,
			sourceSectionPosition: state.sourceSectionPosition,
			linkTimestamps: state.linkTimestamps,
			tldrCalloutAtTop: state.tldrCalloutAtTop,
			modelIds: state.modelIds,
			instructionMode: state.instructionMode,
			instructionTemplate: state.instructionTemplate,
			manualInstructions: trimmedManualInstructions,
			includeMindmap: effectiveUseAi && state.includeMindmap,
			includeMemorableQuotes: effectiveUseAi && state.includeMemorableQuotes,
			controlValues: effectiveGenerateAiSummary && Object.keys(state.controlValues).length > 0
				? Object.fromEntries(
					Object.entries(state.controlValues).filter(([, value]) => value.trim() !== ''),
				)
				: undefined,
			temperature: parsedTemperature,
			...(Number.isFinite(parsedTimeoutSecs) && (parsedTimeoutSecs ?? 0) > 0 ? { requestTimeoutMs: Math.round((parsedTimeoutSecs ?? 0) * 1000) } : {}),
		},
	};
}

function failure(message: string, duplicateCount = 0): GenerationSubmitResult {
	return { ok: false, message, duplicateCount };
}

function dedupeUrls(parsedUrls: string[]): string[] {
	return [...new Set(parsedUrls)];
}
