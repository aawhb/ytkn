import { describe, expect, it } from 'vitest';
import { resolveEffectiveGenerationOptions } from '../../src/generation/effectiveOptions';
import type { PluginSettings } from '../../src/types';

function createSettings(overrides: Partial<PluginSettings> = {}): PluginSettings {
	return {
		loadSettings: async () => undefined,
		hasSavedSettings: () => true,
		getProviders: () => [],
		getModels: () => [],
		getInstructionConfig: () => ({
			mode: 'template',
			template: 'general',
			manualInstructions: 'saved manual',
			includeMindmap: false,
			includeMemorableQuotes: true,
			controlValues: { density: 'comprehensive' },
		}),
		getOutputDefaults: () => ({
			useAi: true,
			generateAiSummary: true,
			transcriptMode: 'readable',
			playlistMode: 'combined',
			channelContentTypes: ['videos', 'shorts'],
			channelVideoLimit: 10,
			transcriptLanguageMode: 'preferred',
			preferredTranscriptLanguage: 'en',
			transcriptFailureMode: 'skip',
			mediaEmbedMode: 'thumbnail',
			includeRunReport: true,
			runReportLocation: 'generated-note',
			useVideoTitleAsNoteName: true,
			noteDestinationMode: 'folder',
			noteDestinationFolder: 'Videos',
			openCreatedNote: false,
			includeFrontmatter: true,
			frontmatterTags: 'ytkn video',
			frontmatterPropertyAllowlist: 'title source generated',
			sourceSectionPosition: 'bottom',
			linkTimestamps: true,
			tldrCalloutAtTop: true,
		}),
		getModelIds: () => [],
		getSelectedModels: () => [],
		updateModelIds: async () => undefined,
		getTemperature: () => 0.4,
		getRequestTimeoutMs: () => 60000,
		getLastSeenReleaseNotesVersion: () => null,
		setLastSeenReleaseNotesVersion: async () => undefined,
		addProvider: async () => undefined,
		addModel: async () => undefined,
		updateProvider: async () => undefined,
		updateModel: async () => undefined,
		deleteProvider: async () => undefined,
		deleteModel: async () => undefined,
		updateInstructionConfig: async () => undefined,
		updateOutputDefaults: async () => undefined,
		updateTemperature: async () => undefined,
		updateRequestTimeoutMs: async () => undefined,
		mergeProviderModels: async () => 0,
		resetSettings: async () => undefined,
		saveProviderSecretId: async () => undefined,
		validateModelId: () => true,
		...overrides,
	};
}

describe('resolveEffectiveGenerationOptions', () => {
	it('merges saved defaults into a complete effective run shape', () => {
		const effective = resolveEffectiveGenerationOptions({}, createSettings());

		expect(effective.useAi).toBe(true);
		expect(effective.generateAiSummary).toBe(true);
		expect(effective.instructionTemplate).toBe('general');
		expect(effective.includeMemorableQuotes).toBe(true);
		expect(effective.transcriptMode).toBe('readable');
		expect(effective.noteDestinationMode).toBe('folder');
		expect(effective.channelContentTypes).toEqual(['videos', 'shorts']);
		expect(effective.channelVideoLimit).toBe(10);
		expect(effective.temperature).toBe(0.4);
		expect(effective.requestTimeoutMs).toBe(60000);
	});

	it('preserves per-run overrides over saved defaults', () => {
		const effective = resolveEffectiveGenerationOptions({
			useAi: false,
			generateAiSummary: false,
			instructionMode: 'manual',
			manualInstructions: 'run manual',
			includeMemorableQuotes: false,
			transcriptMode: 'none',
			noteDestinationMode: 'current-note',
			temperature: 1.2,
			requestTimeoutMs: 1000,
			channelContentTypes: ['streams'],
			channelVideoLimit: null,
		}, createSettings());

		expect(effective.useAi).toBe(false);
		expect(effective.generateAiSummary).toBe(false);
		expect(effective.instructionMode).toBe('manual');
		expect(effective.manualInstructions).toBe('run manual');
		expect(effective.includeMemorableQuotes).toBe(false);
		expect(effective.transcriptMode).toBe('none');
		expect(effective.noteDestinationMode).toBe('current-note');
		expect(effective.temperature).toBe(1.2);
		expect(effective.requestTimeoutMs).toBe(1000);
		expect(effective.channelContentTypes).toEqual(['streams']);
		expect(effective.channelVideoLimit).toBeNull();
	});

	it('resolves the model chain from per-run options, then settings', () => {
		const settings = createSettings({
			getModelIds: () => ['A:one', 'B:two'],
		} as never);

		expect(resolveEffectiveGenerationOptions({}, settings).modelIds).toEqual(['A:one', 'B:two']);
		expect(resolveEffectiveGenerationOptions({ modelIds: ['B:two'] }, settings).modelIds).toEqual(['B:two']);
	});

	it('resolves openCreatedNote from saved defaults and per-run overrides', () => {
		const settings = createSettings();
		const withDefaultOn: typeof settings = {
			...settings,
			getOutputDefaults: () => ({ ...settings.getOutputDefaults(), openCreatedNote: true }),
		};

		expect(resolveEffectiveGenerationOptions({}, settings).openCreatedNote).toBe(false);
		expect(resolveEffectiveGenerationOptions({}, withDefaultOn).openCreatedNote).toBe(true);
		expect(resolveEffectiveGenerationOptions({ openCreatedNote: false }, withDefaultOn).openCreatedNote).toBe(false);
		expect(resolveEffectiveGenerationOptions({ openCreatedNote: true }, settings).openCreatedNote).toBe(true);
	});
});
