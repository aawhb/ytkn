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
		openCreatedNote: false,
		temperature: 0.2,
		requestTimeoutMs: 60000,
		includeFrontmatter: true,
		frontmatterTags: '',
		frontmatterPropertyAllowlist: '',
		sourceSectionPosition: 'top',
		linkTimestamps: false,
		tldrCalloutAtTop: false,
		modelIds: [],
		...overrides,
		channelContentTypes: overrides.channelContentTypes ?? ['videos', 'shorts', 'streams'],
		channelVideoLimit: overrides.channelVideoLimit !== undefined ? overrides.channelVideoLimit : 10,
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

	it('creates a chain context from the run model list without instantiating providers', () => {
		const secondModel: ModelConfig = {
			name: 'gpt-test',
			provider: { name: 'OpenAI', type: 'openai', apiKey: 'key' },
		};
		const context = buildAiExecutionContext(
			makeOptions({
				useAi: true,
				tldrCalloutAtTop: true,
				modelIds: ['Ollama:local-model', 'Missing:model', 'OpenAI:gpt-test'],
				temperature: 0.7,
				requestTimeoutMs: 1000,
			}),
			makeSettings([model, secondModel]),
		);

		expect(context?.chain.candidates).toEqual([model, secondModel]);
		expect(context?.chain.index).toBe(0);
		expect(context?.chain.temperature).toBe(0.7);
		expect(context?.chain.requestTimeoutMs).toBe(1000);
		expect(providerFactoryMocks.createProvider).not.toHaveBeenCalled();
	});

	it('rejects empty chains and chains with no usable model', () => {
		expect(() => buildAiExecutionContext(
			makeOptions({ useAi: true, tldrCalloutAtTop: true, modelIds: ['Missing:model'] }),
			makeSettings(),
		)).toThrow('No AI model selected');

		const cloudModel: ModelConfig = {
			name: 'gpt-test',
			provider: { name: 'OpenAI', type: 'openai', apiKey: '' },
		};
		expect(() => buildAiExecutionContext(
			makeOptions({ useAi: true, tldrCalloutAtTop: true, modelIds: ['OpenAI:gpt-test'] }),
			makeSettings([cloudModel]),
		)).toThrow('OpenAI requires an API key');

		const context = buildAiExecutionContext(
			makeOptions({ useAi: true, tldrCalloutAtTop: true, modelIds: ['OpenAI:gpt-test', 'Ollama:local-model'] }),
			makeSettings([cloudModel, model]),
		);
		expect(context?.chain.candidates).toEqual([cloudModel, model]);
	});
});
