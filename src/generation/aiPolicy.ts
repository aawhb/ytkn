import { PromptService } from '../ai/promptService';
import { createProvider } from '../ai/providers/factory';
import type {
	AIModelProvider,
	InstructionConfig,
	ModelConfig,
	PluginSettings,
} from '../types';
import { shouldUseAi } from '../aiOutputPolicy';
import { buildModelId } from '../modelId';
import type { EffectiveGenerationOptions } from './effectiveOptions';
import type { AiContentContext } from './workflows/aiContent';

export { shouldGenerateAiSummary, shouldUseAi } from '../aiOutputPolicy';

export function isMetadataOnlyRun(effectiveOptions: EffectiveGenerationOptions): boolean {
	return !shouldUseAi(effectiveOptions) && effectiveOptions.transcriptMode === 'none';
}

function resolveSelectedModel(settings: PluginSettings, modelId?: string): ModelConfig | null {
	if (!modelId) {
		return null;
	}
	return settings.getModels().find((model) => buildModelId(model) === modelId) ?? null;
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

	const selectedModel = resolveSelectedModel(settings, effectiveOptions.modelId);
	if (!selectedModel) {
		throw new Error('No AI model selected. Please select a model in the plugin settings or in the generation modal.');
	}

	if (!selectedModel.provider.apiKey && selectedModel.provider.type !== 'openai-compatible') {
		throw new Error(`${selectedModel.provider.name} requires an API key. Please select an existing Obsidian secret in the plugin settings.`);
	}

	const provider: AIModelProvider = createProvider(
		selectedModel,
		effectiveOptions.temperature,
		effectiveOptions.requestTimeoutMs,
	);

	return {
		selectedModel,
		provider,
		promptService: createPromptService(createInstructionConfig(effectiveOptions), effectiveOptions),
	};
}
