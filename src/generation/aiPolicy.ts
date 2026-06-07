import { PromptService } from '../ai/promptService';
import { ProvidersFactory } from '../ai/providers/factory';
import {
	AIModelProvider,
	InstructionConfig,
	ModelConfig,
	PluginSettings,
} from '../types';
import { buildModelId } from '../utils';
import type { EffectiveGenerationOptions } from './effectiveOptions';
import type { AiContentContext } from './workflows/aiContent';

export function hasAiOutputs(effectiveOptions: EffectiveGenerationOptions): boolean {
	return effectiveOptions.generateAiSummary
		|| effectiveOptions.tldrCalloutAtTop
		|| effectiveOptions.includeMindmap
		|| effectiveOptions.includeMemorableQuotes;
}

export function shouldUseAi(effectiveOptions: EffectiveGenerationOptions): boolean {
	return effectiveOptions.useAi && hasAiOutputs(effectiveOptions);
}

export function shouldGenerateAiSummary(effectiveOptions: EffectiveGenerationOptions): boolean {
	return shouldUseAi(effectiveOptions) && effectiveOptions.generateAiSummary;
}

export function isMetadataOnlyRun(effectiveOptions: EffectiveGenerationOptions): boolean {
	return !shouldUseAi(effectiveOptions) && effectiveOptions.transcriptMode === 'none';
}

export function resolveSelectedModel(settings: PluginSettings, modelId?: string): ModelConfig | null {
	if (!modelId) {
		return null;
	}
	return settings.getModels().find((model) => buildModelId(model) === modelId) ?? null;
}

export function createProvider(
	selectedModel: ModelConfig,
	effectiveOptions: EffectiveGenerationOptions,
): AIModelProvider {
	return ProvidersFactory.createProvider(
		selectedModel,
		effectiveOptions.temperature,
		effectiveOptions.requestTimeoutMs,
	);
}

export function createInstructionConfig(effectiveOptions: EffectiveGenerationOptions): InstructionConfig {
	return {
		mode: effectiveOptions.instructionMode,
		template: effectiveOptions.instructionTemplate,
		manualInstructions: effectiveOptions.manualInstructions,
		includeMindmap: effectiveOptions.includeMindmap,
		includeMemorableQuotes: effectiveOptions.includeMemorableQuotes,
		controlValues: effectiveOptions.controlValues,
	};
}

export function createPromptService(instructionConfig: InstructionConfig, effectiveOptions: EffectiveGenerationOptions): PromptService {
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

	const selectedModel = resolveSelectedModel(settings, effectiveOptions.modelId);
	if (!selectedModel) {
		throw new Error('No AI model selected. Please select a model in the plugin settings or in the generation modal.');
	}

	if (!selectedModel.provider.apiKey && selectedModel.provider.type !== 'openai-compatible') {
		throw new Error(`${selectedModel.provider.name} requires an API key. Please select an existing Obsidian secret in the plugin settings.`);
	}

	const provider = createProvider(
		selectedModel,
		effectiveOptions,
	);

	return {
		selectedModel,
		provider,
		promptService: createPromptService(createInstructionConfig(effectiveOptions), effectiveOptions),
	};
}
