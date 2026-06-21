import type { AIModelProvider, ModelConfig, TranscriptResponse } from '../../types';
import type { PromptService } from '../../ai/promptService';
import type { NoteInsertionTarget, ProgressState } from '../targets/noteTargets';
import type { GenerationWorkflowContext } from './context';

export interface AiContentContext {
	selectedModel: ModelConfig;
	provider: AIModelProvider;
	promptService: PromptService;
}

interface AiContentProgress {
	hasProgressContent: boolean;
	updateProgress(message: string): Promise<void>;
	updateStatus(message: string): void;
}

interface GenerateAiContentInput {
	aiContext: AiContentContext;
	transcript: TranscriptResponse;
	url: string;
	progress: AiContentProgress;
	signal: AbortSignal;
	generateSummary: boolean;
}

export async function generateAiContent({
	aiContext,
	transcript,
	url,
	progress,
	signal,
	generateSummary,
}: GenerateAiContentInput): Promise<string> {
	const chunks = generateSummary
		? aiContext.promptService.splitTranscript(transcript, url, {
			model: aiContext.selectedModel,
		})
		: aiContext.promptService.splitTranscriptForAddons(transcript, url, {
			model: aiContext.selectedModel,
		});

	if (chunks.length <= 1) {
		if (signal.aborted) throw signal.reason;
		if (progress.hasProgressContent) {
			await progress.updateProgress(generateSummary ? 'Generating summary...' : 'Generating AI add-ons...');
		}
		progress.updateStatus(generateSummary ? 'Generating summary...' : 'Generating AI add-ons...');
		return aiContext.provider.summarizeVideo(
			generateSummary
				? aiContext.promptService.buildPrompt(transcript, url)
				: aiContext.promptService.buildAddonsPrompt(transcript, url),
			signal,
		);
	}

	const chunkSummaries: string[] = [];
	for (const [index, chunk] of chunks.entries()) {
		if (signal.aborted) throw signal.reason;
		if (progress.hasProgressContent) {
			await progress.updateProgress(generateSummary
				? `Summarizing transcript chunk ${index + 1}/${chunks.length}...`
				: `Extracting add-on material ${index + 1}/${chunks.length}...`);
		}
		progress.updateStatus(generateSummary
			? `Summarizing chunk ${index + 1}/${chunks.length}...`
			: `Extracting add-on material ${index + 1}/${chunks.length}...`);
		chunkSummaries.push(
			await aiContext.provider.summarizeVideo(
				generateSummary
					? aiContext.promptService.buildChunkPrompt(transcript, url, chunk, index + 1, chunks.length)
					: aiContext.promptService.buildAddonsChunkPrompt(transcript, url, chunk, index + 1, chunks.length),
				signal,
			),
		);
	}

	if (signal.aborted) throw signal.reason;
	if (progress.hasProgressContent) {
		await progress.updateProgress(generateSummary ? 'Combining chunk summaries...' : 'Creating AI add-ons...');
	}
	progress.updateStatus(generateSummary ? 'Combining chunk summaries...' : 'Creating AI add-ons...');
	return aiContext.provider.summarizeVideo(
		generateSummary
			? aiContext.promptService.buildSynthesisPrompt(transcript, url, chunkSummaries)
			: aiContext.promptService.buildAddonsSynthesisPrompt(transcript, url, chunkSummaries),
		signal,
	);
}

export async function generateAiText(
	context: GenerationWorkflowContext,
	aiContext: AiContentContext,
	transcript: TranscriptResponse,
	url: string,
	target: NoteInsertionTarget,
	progressState: ProgressState,
	signal: AbortSignal,
	generateSummary: boolean,
): Promise<string> {
	return generateAiContent({
		aiContext,
		transcript,
		url,
		progress: {
			hasProgressContent: progressState.hasProgressContent,
			updateProgress: (message) => context.targets.upsertProgressContent(target, url, message),
			updateStatus: (message) => context.onStatusBar(message),
		},
		signal,
		generateSummary,
	});
}
