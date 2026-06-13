import { describe, expect, it, vi } from 'vitest';
import type { ModelConfig, PluginSettings } from '../../src/types';

const providerFactoryMocks = vi.hoisted(() => ({
	createProvider: vi.fn(() => ({ summarizeVideo: vi.fn() })),
}));

vi.mock('../../src/ai/providers/factory', () => ({
	createProvider: providerFactoryMocks.createProvider,
}));

import {
	buildAiExecutionContext,
	isMetadataOnlyRun,
	shouldGenerateAiSummary,
	shouldUseAi,
} from '../../src/generation/aiPolicy';
import type { EffectiveGenerationOptions } from '../../src/generation/effectiveOptions';

const model: ModelConfig = {
	name: 'local-model',
	provider: {
		name: 'Ollama',
		type: 'openai-compatible',
		apiKey: '',
		url: 'http://localhost:11434/v1',
	},
};

function makeOptions(overrides: Partial<EffectiveGenerationOptions> = {}): EffectiveGenerationOptions {
	return {
		useAi: false,
		generateAiSummary: false,
		instructionMode: 'template',
		instructionTemplate: 'general',
		manualInstructions: '',
		includeMindmap: false,
		includeMemorableQuotes: false,
		controlValues: {},
		transcriptMode: 'readable',
		playlistMode: 'combined',
		transcriptLanguageMode: 'auto',
		preferredTranscriptLanguage: '',
		transcriptFailureMode: 'skip',
		mediaEmbedMode: 'thumbnail',
		includeRunReport: true,
		runReportLocation: 'generated-note',
		useVideoTitleAsNoteName: true,
		noteDestinationMode: 'folder',
		noteDestinationFolder: 'Notes',
		temperature: 0.2,
		requestTimeoutMs: 60000,
		includeFrontmatter: true,
		frontmatterTags: '',
		frontmatterPropertyAllowlist: '',
		sourceSectionPosition: 'top',
		linkTimestamps: false,
		tldrCalloutAtTop: false,
		...overrides,
	};
}

function makeSettings(models: ModelConfig[] = [model]): PluginSettings {
	return {
		getModels: vi.fn(() => models),
	} as unknown as PluginSettings;
}

describe('AI generation policy', () => {
	it('uses AI only when the run asks for at least one AI output', () => {
		expect(shouldUseAi(makeOptions({ useAi: true }))).toBe(false);
		expect(shouldUseAi(makeOptions({ useAi: true, tldrCalloutAtTop: true }))).toBe(true);
		expect(shouldGenerateAiSummary(makeOptions({ useAi: true, tldrCalloutAtTop: true, generateAiSummary: false }))).toBe(false);
		expect(shouldGenerateAiSummary(makeOptions({ useAi: true, generateAiSummary: true }))).toBe(true);
	});

	it('treats transcriptMode none as metadata-only only when AI is inactive', () => {
		expect(isMetadataOnlyRun(makeOptions({ transcriptMode: 'none' }))).toBe(true);
		expect(isMetadataOnlyRun(makeOptions({ transcriptMode: 'none', useAi: true, tldrCalloutAtTop: true }))).toBe(false);
	});

	it('returns null when no AI output is requested', () => {
		expect(buildAiExecutionContext(makeOptions({ useAi: false }), makeSettings())).toBeNull();
		expect(providerFactoryMocks.createProvider).not.toHaveBeenCalled();
	});

	it('creates an AI context from the selected model and effective options', () => {
		const context = buildAiExecutionContext(
			makeOptions({
				useAi: true,
				tldrCalloutAtTop: true,
				modelId: 'Ollama:local-model',
				temperature: 0.7,
				requestTimeoutMs: 1000,
			}),
			makeSettings(),
		);

		expect(context?.selectedModel).toBe(model);
		expect(providerFactoryMocks.createProvider).toHaveBeenCalledWith(model, 0.7, 1000);
	});

	it('rejects missing selected models and API keys for cloud providers', () => {
		expect(() => buildAiExecutionContext(
			makeOptions({ useAi: true, tldrCalloutAtTop: true, modelId: 'Missing:model' }),
			makeSettings(),
		)).toThrow('No AI model selected');

		const cloudModel: ModelConfig = {
			name: 'gpt-test',
			provider: { name: 'OpenAI', type: 'openai', apiKey: '' },
		};
		expect(() => buildAiExecutionContext(
			makeOptions({ useAi: true, tldrCalloutAtTop: true, modelId: 'OpenAI:gpt-test' }),
			makeSettings([cloudModel]),
		)).toThrow('OpenAI requires an API key');
	});
});
