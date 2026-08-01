import { Notice } from 'obsidian';
import type { AIModelProvider, ModelConfig, TranscriptResponse } from '../../types';
import type { PromptService } from '../../ai/promptService';
import { createProvider } from '../../ai/providers/factory';
import { isAbortError } from '../../queue/progress';
import { classifyAiError, describeAiErrorCause } from '../aiErrorClassifier';
import type { NoteInsertionTarget, ProgressState } from '../targets/noteTargets';
import type { GenerationWorkflowContext } from './context';

interface ModelChain {
	candidates: ModelConfig[];
	currentIndex: number;
	temperature: number;
	requestTimeoutMs: number;
}

export interface AiContentContext {
	chain: ModelChain;
	promptService: PromptService;
}

interface AiContentResult {
	text: string;
	warnings: string[];
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

async function generateAiContent(input: GenerateAiContentInput): Promise<AiContentResult> {
	return runWithModelChain(
		input.aiContext.chain,
		input.signal,
		(provider, model) => generateWithModel(provider, model, input),
		(message) => input.progress.updateStatus(message),
	);
}

export async function generateAiCompletion(
	aiContext: AiContentContext,
	prompt: string,
	signal: AbortSignal,
): Promise<AiContentResult> {
	return runWithModelChain(
		aiContext.chain,
		signal,
		(provider) => provider.summarizeVideo(prompt, signal),
	);
}

async function runWithModelChain(
	chain: ModelChain,
	signal: AbortSignal,
	attempt: (provider: AIModelProvider, model: ModelConfig) => Promise<string>,
	onStatus?: (message: string) => void,
): Promise<AiContentResult> {
	const warnings: string[] = [];

	for (;;) {
		const model = chain.candidates[chain.currentIndex];
		try {
			assertModelUsable(model);
			const provider = createProvider(model, chain.temperature, chain.requestTimeoutMs);
			const text = await attempt(provider, model);
			return { text, warnings };
		} catch (error) {
			if (isAbortError(error, signal)) {
				throw error;
			}
			const next = chain.candidates[chain.currentIndex + 1];
			if (!next) {
				throw error;
			}
			chain.currentIndex += 1;
			const message = `${modelLabel(model)} (${model.provider.name}) ${describeAiErrorCause(classifyAiError(error))}. Falling back to ${modelLabel(next)} (${next.provider.name}).`;
			new Notice(message);
			warnings.push(message);
			onStatus?.(`Falling back to ${modelLabel(next)}…`);
		}
	}
}

function modelLabel(model: ModelConfig): string {
	return model.displayName || model.name;
}

function assertModelUsable(model: ModelConfig): void {
	if (!model.provider.apiKey && model.provider.type !== 'openai-compatible') {
		throw Object.assign(
			new Error(`${model.provider.name} requires an API key. Please select an existing Obsidian secret in the plugin settings.`),
			{ status: 401 },
		);
	}
}

async function generateWithModel(
	provider: AIModelProvider,
	model: ModelConfig,
	{ aiContext, transcript, url, progress, signal, generateSummary }: GenerateAiContentInput,
): Promise<string> {
	const chunks = generateSummary
		? aiContext.promptService.splitTranscript(transcript, url, { model })
		: aiContext.promptService.splitTranscriptForAddons(transcript, url, { model });

	if (chunks.length <= 1) {
		if (signal.aborted) throw signal.reason;
		if (progress.hasProgressContent) {
			await progress.updateProgress(generateSummary ? 'Generating note content…' : 'Generating AI add-ons…');
		}
		progress.updateStatus(generateSummary ? 'Generating note content…' : 'Generating AI add-ons…');
		return provider.summarizeVideo(
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
				? `Summarizing transcript chunk ${index + 1}/${chunks.length}…`
				: `Extracting add-on material ${index + 1}/${chunks.length}…`);
		}
		progress.updateStatus(generateSummary
			? `Summarizing chunk ${index + 1}/${chunks.length}…`
			: `Extracting add-on material ${index + 1}/${chunks.length}…`);
		chunkSummaries.push(
			await provider.summarizeVideo(
				generateSummary
					? aiContext.promptService.buildChunkPrompt(transcript, url, chunk, index + 1, chunks.length)
					: aiContext.promptService.buildAddonsChunkPrompt(transcript, url, chunk, index + 1, chunks.length),
				signal,
			),
		);
	}

	if (signal.aborted) throw signal.reason;
	if (progress.hasProgressContent) {
		await progress.updateProgress(generateSummary ? 'Combining chunk summaries…' : 'Creating AI add-ons…');
	}
	progress.updateStatus(generateSummary ? 'Combining chunk summaries…' : 'Creating AI add-ons…');
	return provider.summarizeVideo(
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
): Promise<AiContentResult> {
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
