import { PromptService } from '../ai/promptService';
import type {
	InstructionConfig,
	ModelConfig,
	PluginSettings,
} from '../types';
import { buildModelId } from '../modelId';
import type { EffectiveGenerationOptions } from './effectiveOptions';
import type { AiContentContext } from './workflows/aiContent';

interface AiOutputFlags {
	generateAiSummary: boolean;
	tldrCalloutAtTop: boolean;
	includeMindmap: boolean;
	includeMemorableQuotes: boolean;
}

interface AiExecutionFlags extends AiOutputFlags {
	useAi: boolean;
}

function hasAiOutputs(options: AiOutputFlags): boolean {
	return options.generateAiSummary
		|| options.tldrCalloutAtTop
		|| options.includeMindmap
		|| options.includeMemorableQuotes;
}

export function shouldUseAi(options: AiExecutionFlags): boolean {
	return options.useAi && hasAiOutputs(options);
}

export function shouldGenerateAiSummary(options: AiExecutionFlags): boolean {
	return shouldUseAi(options) && options.generateAiSummary;
}

export function isMetadataOnlyRun(effectiveOptions: EffectiveGenerationOptions): boolean {
	return !shouldUseAi(effectiveOptions) && effectiveOptions.transcriptMode === 'none';
}

function resolveModelChain(settings: PluginSettings, modelIds: string[]): ModelConfig[] {
	const models = settings.getModels();
	return modelIds
		.map((modelId) => models.find((model) => buildModelId(model) === modelId))
		.filter((model): model is ModelConfig => Boolean(model));
}

function isModelUsable(model: ModelConfig): boolean {
	return Boolean(model.provider.apiKey) || model.provider.type === 'openai-compatible';
}

function createInstructionConfig(effectiveOptions: EffectiveGenerationOptions): InstructionConfig {
	return {
		mode: effectiveOptions.instructionMode,
		template: effectiveOptions.instructionTemplate,
		manualInstructions: effectiveOptions.manualInstructions,
		includeMindmap: effectiveOptions.includeMindmap,
		includeMemorableQuotes: effectiveOptions.includeMemorableQuotes,
		controlValues: effectiveOptions.controlValues,
	};
}

function createPromptService(instructionConfig: InstructionConfig, effectiveOptions: EffectiveGenerationOptions): PromptService {
	return new PromptService(instructionConfig, {
		includeTldr: effectiveOptions.tldrCalloutAtTop,
	});
}

export function buildAiExecutionContext(
	effectiveOptions: EffectiveGenerationOptions,
	settings: PluginSettings,
): AiContentContext | null {
	if (!shouldUseAi(effectiveOptions)) {
		return null;
	}

	const candidates = resolveModelChain(settings, effectiveOptions.modelIds);
	if (candidates.length === 0) {
		throw new Error('No AI model selected. Please select a model in the plugin settings or in the generation modal.');
	}

	if (!candidates.some(isModelUsable)) {
		throw new Error(`${candidates[0].provider.name} requires an API key. Please select an existing Obsidian secret in the plugin settings.`);
	}

	return {
		chain: {
			candidates,
			currentIndex: 0,
			temperature: effectiveOptions.temperature,
			requestTimeoutMs: effectiveOptions.requestTimeoutMs,
		},
		promptService: createPromptService(createInstructionConfig(effectiveOptions), effectiveOptions),
	};
}
