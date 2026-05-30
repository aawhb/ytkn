import { describe, expect, it, vi } from 'vitest';
import { App } from 'obsidian';
import { SettingsService } from '../src/services/settings';
import {
	DEFAULT_FRONTMATTER_TAGS,
	DEFAULT_FRONTMATTER_PROPERTY_ALLOWLIST,
	DEFAULT_GENERATE_AI_SUMMARY,
	DEFAULT_INCLUDE_FRONTMATTER,
	DEFAULT_INCLUDE_MEMORABLE_QUOTES,
	DEFAULT_INCLUDE_MINDMAP,
	DEFAULT_INSTRUCTION_MODE,
	DEFAULT_INSTRUCTION_TEMPLATE,
	DEFAULT_MANUAL_INSTRUCTIONS,
	DEFAULT_INCLUDE_RUN_REPORT,
	DEFAULT_LINK_TIMESTAMPS,
	DEFAULT_MEDIA_EMBED_MODE,
	DEFAULT_NOTE_DESTINATION_FOLDER,
	DEFAULT_NOTE_DESTINATION_MODE,
	DEFAULT_OUTPUT_TRANSCRIPT_MODE,
	DEFAULT_RUN_REPORT_LOCATION,
	DEFAULT_PLAYLIST_MODE,
	DEFAULT_PREFERRED_TRANSCRIPT_LANGUAGE,
	DEFAULT_REQUEST_TIMEOUT_MS,
	DEFAULT_SOURCE_SECTION_POSITION,
	DEFAULT_TLDR_CALLOUT_AT_TOP,
	DEFAULT_TRANSCRIPT_FAILURE_MODE,
	DEFAULT_TRANSCRIPT_LANGUAGE_MODE,
	DEFAULT_USE_VIDEO_TITLE_AS_NOTE_NAME,
} from '../src/defaults';

vi.mock('obsidian', async () => {
	const mod = await import('./mocks/obsidian');
	return mod;
});

type DataStore = { settings?: any };

class FakePlugin {
	app = new App();
	data: DataStore | null = null;
	saveData = vi.fn(async (data: DataStore) => {
		this.data = data;
	});
	loadData = vi.fn(async () => this.data);

	constructor() {
		this.app.secretStorage.setSecret('gemini-secret', 'test-key');
		this.app.secretStorage.setSecret('openai-secret', 'openai-key');
		this.app.secretStorage.setSecret('anthropic-secret', 'anthropic-key');
	}
}

const baseProvider = {
	name: 'Gemini',
	type: 'gemini' as const,
	apiKey: 'test-key',
	apiKeySecretId: 'gemini-secret',
	models: [{ name: 'gemini-1.5-flash', displayName: 'Gemini Flash' }],
};

describe('SettingsService', () => {
	it('adds provider, model, updates active model, deletes model, validates model id', async () => {
		const plugin = new FakePlugin();
		plugin.data = {
			settings: {
				providers: [baseProvider],
				selectedModelId: null,
				outputDefaults: {
					generateAiSummary: true,
					transcriptMode: 'none',
					playlistMode: 'per-video',
					transcriptLanguageMode: 'auto',
					preferredTranscriptLanguage: '',
					transcriptFailureMode: 'skip',
					mediaEmbedMode: 'video',
					includeRunReport: true,
					runReportLocation: 'generated-note',
					useVideoTitleAsNoteName: true,
					noteDestinationMode: 'current-note',
					noteDestinationFolder: '',
				},
				instructionConfig: { mode: 'manual', template: 'implementation', manualInstructions: 'prompt', includeMindmap: false },
				maxTokens: 1000,
				temperature: 0.2,
				requestTimeoutMs: 120000,
			},
		};

		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		await manager.addProvider({ name: 'OpenAI', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1', models: [] });
		await manager.addModel({
			name: 'gpt-4o-mini',
			displayName: 'GPT-4o Mini',
			provider: { name: 'OpenAI', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
		});
		await manager.updateActiveModel('OpenAI:gpt-4o-mini');
		expect(manager.validateModelId('OpenAI:gpt-4o-mini')).toBe(true);

		await manager.deleteModel('OpenAI', 'gpt-4o-mini');
		expect(manager.validateModelId('OpenAI:gpt-4o-mini')).toBe(false);
	});

	it('rejects custom providers without a URL', async () => {
		const plugin = new FakePlugin();
		plugin.data = { settings: { providers: [baseProvider] } };
		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		await expect(manager.addProvider({ name: 'Ollama', type: 'openai-compatible', apiKey: '', url: '', models: [] })).rejects.toThrow(
			'OpenAI-compatible providers require a URL.',
		);
	});

	it('rejects invalid model ids', async () => {
		const plugin = new FakePlugin();
		plugin.data = { settings: { providers: [baseProvider] } };
		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();
		expect(manager.validateModelId('Missing:Model')).toBe(false);
	});

	it('clears stale selected model ids during load', async () => {
		const plugin = new FakePlugin();
		plugin.data = {
			settings: {
				providers: [baseProvider],
				selectedModelId: 'Missing:Model',
				outputDefaults: {
					generateAiSummary: true,
					transcriptMode: 'none',
					playlistMode: 'per-video',
					transcriptLanguageMode: 'auto',
					preferredTranscriptLanguage: '',
					transcriptFailureMode: 'skip',
					mediaEmbedMode: 'video',
					includeRunReport: true,
					runReportLocation: 'generated-note',
					useVideoTitleAsNoteName: true,
					noteDestinationMode: 'current-note',
					noteDestinationFolder: '',
				},
				instructionConfig: { mode: 'manual', template: 'implementation', manualInstructions: 'prompt', includeMindmap: false },
				maxTokens: 1000,
				temperature: 0.2,
				requestTimeoutMs: 120000,
			},
		};

		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		expect(manager.getSelectedModel()).toBeNull();
		expect(plugin.saveData).toHaveBeenCalled();
	});

	it('starts with no providers and defaults media embed to video', async () => {
		const plugin = new FakePlugin();
		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		expect(manager.getProviders()).toEqual([]);
		expect(manager.getSelectedModel()).toBeNull();
		expect(manager.getOutputDefaults()).toEqual({
			generateAiSummary: DEFAULT_GENERATE_AI_SUMMARY,
			transcriptMode: DEFAULT_OUTPUT_TRANSCRIPT_MODE,
			playlistMode: DEFAULT_PLAYLIST_MODE,
			transcriptLanguageMode: DEFAULT_TRANSCRIPT_LANGUAGE_MODE,
			preferredTranscriptLanguage: DEFAULT_PREFERRED_TRANSCRIPT_LANGUAGE,
			transcriptFailureMode: DEFAULT_TRANSCRIPT_FAILURE_MODE,
			mediaEmbedMode: DEFAULT_MEDIA_EMBED_MODE,
			includeRunReport: DEFAULT_INCLUDE_RUN_REPORT,
			runReportLocation: DEFAULT_RUN_REPORT_LOCATION,
			useVideoTitleAsNoteName: DEFAULT_USE_VIDEO_TITLE_AS_NOTE_NAME,
			noteDestinationMode: DEFAULT_NOTE_DESTINATION_MODE,
			noteDestinationFolder: DEFAULT_NOTE_DESTINATION_FOLDER,
			includeFrontmatter: DEFAULT_INCLUDE_FRONTMATTER,
			frontmatterTags: DEFAULT_FRONTMATTER_TAGS,
			frontmatterPropertyAllowlist: DEFAULT_FRONTMATTER_PROPERTY_ALLOWLIST,
			sourceSectionPosition: DEFAULT_SOURCE_SECTION_POSITION,
			linkTimestamps: DEFAULT_LINK_TIMESTAMPS,
			tldrCalloutAtTop: DEFAULT_TLDR_CALLOUT_AT_TOP,
		});
		expect(manager.getRequestTimeoutMs()).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
	});

	it('normalizes media embed mode values cleanly', async () => {
		const plugin = new FakePlugin();
		plugin.data = {
			settings: {
				providers: [],
				selectedModelId: null,
				outputDefaults: {
					mediaEmbedMode: 'thumbnail',
				},
			},
		};

		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		expect(manager.getOutputDefaults().mediaEmbedMode).toBe('thumbnail');

		const invalidPlugin = new FakePlugin();
		invalidPlugin.data = {
			settings: {
				providers: [],
				selectedModelId: null,
				outputDefaults: {
					mediaEmbedMode: 'poster',
				},
			},
		};

		const invalidManager = new SettingsService(invalidPlugin as any);
		await invalidManager.loadSettings();

		expect(invalidManager.getOutputDefaults().mediaEmbedMode).toBe(DEFAULT_MEDIA_EMBED_MODE);

		const legacyDisabledPlugin = new FakePlugin();
		legacyDisabledPlugin.data = {
			settings: {
				providers: [],
				selectedModelId: null,
				outputDefaults: {
					includeThumbnail: false,
				},
			},
		};

		const legacyDisabledManager = new SettingsService(legacyDisabledPlugin as any);
		await legacyDisabledManager.loadSettings();

		expect(legacyDisabledManager.getOutputDefaults().mediaEmbedMode).toBe('none');
	});

	it('merges discovered models without duplicates and can reset settings', async () => {
		const plugin = new FakePlugin();
		plugin.data = {
			settings: {
				providers: [
					{
						name: 'Ollama',
						type: 'openai-compatible',
						apiKey: '',
						url: 'http://localhost:11434/v1',
						models: [{ name: 'qwen3.5:4b', displayName: 'qwen3.5:4b' }],
					},
				],
				selectedModelId: 'Ollama:qwen3.5:4b',
				outputDefaults: {
					generateAiSummary: false,
					transcriptMode: 'timestamped',
					playlistMode: 'combined',
					transcriptLanguageMode: 'preferred',
					preferredTranscriptLanguage: 'en',
					transcriptFailureMode: 'fail',
					mediaEmbedMode: 'none',
					includeRunReport: false,
					runReportLocation: 'separate-note',
					useVideoTitleAsNoteName: false,
					noteDestinationMode: 'folder',
					noteDestinationFolder: 'YouTube Notes',
				},
				instructionConfig: { mode: 'manual', template: 'implementation', manualInstructions: 'custom', includeMindmap: false },
				maxTokens: 500,
				temperature: 0.9,
				requestTimeoutMs: 90000,
			},
		};

		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();
		expect(manager.getOutputDefaults().transcriptMode).toBe('timestamped');

		const added = await manager.mergeProviderModels('Ollama', [
			{ name: 'qwen3.5:4b', displayName: 'Qwen 3.5 4B', contextWindow: 262144 },
			{ name: 'llama3.2', displayName: 'Llama 3.2', contextWindow: 131072 },
		]);

		expect(added).toBe(1);
		expect(manager.getProviders()[0].models?.map((model) => ({ name: model.name, contextWindow: model.contextWindow }))).toEqual([
			{ name: 'qwen3.5:4b', contextWindow: 262144 },
			{ name: 'llama3.2', contextWindow: 131072 },
		]);

		await manager.resetSettings();

		expect(manager.getProviders()).toEqual([]);
		expect(manager.getSelectedModel()).toBeNull();
		expect(manager.getOutputDefaults()).toEqual({
			generateAiSummary: DEFAULT_GENERATE_AI_SUMMARY,
			transcriptMode: DEFAULT_OUTPUT_TRANSCRIPT_MODE,
			playlistMode: DEFAULT_PLAYLIST_MODE,
			transcriptLanguageMode: DEFAULT_TRANSCRIPT_LANGUAGE_MODE,
			preferredTranscriptLanguage: DEFAULT_PREFERRED_TRANSCRIPT_LANGUAGE,
			transcriptFailureMode: DEFAULT_TRANSCRIPT_FAILURE_MODE,
			mediaEmbedMode: DEFAULT_MEDIA_EMBED_MODE,
			includeRunReport: DEFAULT_INCLUDE_RUN_REPORT,
			runReportLocation: DEFAULT_RUN_REPORT_LOCATION,
			useVideoTitleAsNoteName: DEFAULT_USE_VIDEO_TITLE_AS_NOTE_NAME,
			noteDestinationMode: DEFAULT_NOTE_DESTINATION_MODE,
			noteDestinationFolder: DEFAULT_NOTE_DESTINATION_FOLDER,
			includeFrontmatter: DEFAULT_INCLUDE_FRONTMATTER,
			frontmatterTags: DEFAULT_FRONTMATTER_TAGS,
			frontmatterPropertyAllowlist: DEFAULT_FRONTMATTER_PROPERTY_ALLOWLIST,
			sourceSectionPosition: DEFAULT_SOURCE_SECTION_POSITION,
			linkTimestamps: DEFAULT_LINK_TIMESTAMPS,
			tldrCalloutAtTop: DEFAULT_TLDR_CALLOUT_AT_TOP,
		});
		expect(manager.getRequestTimeoutMs()).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
	});

	it('normalizes temperature and request timeout', async () => {
		const plugin = new FakePlugin();
		plugin.data = {
			settings: {
				providers: [],
				selectedModelId: null,
				outputDefaults: {
					generateAiSummary: true,
					transcriptMode: 'none',
					playlistMode: 'per-video',
					transcriptLanguageMode: 'auto',
					preferredTranscriptLanguage: '',
					transcriptFailureMode: 'skip',
					mediaEmbedMode: 'video',
					includeRunReport: true,
					runReportLocation: 'generated-note',
					useVideoTitleAsNoteName: true,
					noteDestinationMode: 'current-note',
					noteDestinationFolder: '',
				},
				instructionConfig: { mode: 'manual', template: 'implementation', manualInstructions: 'prompt', includeMindmap: false },
				maxTokens: 250000,
				temperature: 9,
				requestTimeoutMs: 123456,
			},
		};

		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		expect(manager.getTemperature()).toBe(2);
		expect(manager.getRequestTimeoutMs()).toBe(123456);
		expect(plugin.saveData).toHaveBeenCalled();
	});

	it('falls back to defaults when timeout is invalid', async () => {
		const plugin = new FakePlugin();
		plugin.data = {
			settings: {
				providers: [],
				selectedModelId: null,
				outputDefaults: {
					generateAiSummary: true,
					transcriptMode: 'none',
					playlistMode: 'per-video',
					transcriptLanguageMode: 'auto',
					preferredTranscriptLanguage: '',
					transcriptFailureMode: 'skip',
					mediaEmbedMode: 'video',
					includeRunReport: true,
					runReportLocation: 'generated-note',
					useVideoTitleAsNoteName: true,
					noteDestinationMode: 'current-note',
					noteDestinationFolder: '',
				},
				instructionConfig: { mode: 'manual', template: 'implementation', manualInstructions: 'prompt', includeMindmap: false },
				maxTokens: -1,
				temperature: 0.4,
				requestTimeoutMs: 0,
			},
		};

		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		expect(manager.getRequestTimeoutMs()).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
	});

	it('normalizes missing output defaults and preserves explicit overrides', async () => {
		const pluginWithSparseDefaults = new FakePlugin();
		pluginWithSparseDefaults.data = {
			settings: {
				providers: [],
				selectedModelId: null,
				outputDefaults: { transcriptMode: 'none' },
				maxTokens: 1000,
				temperature: 0.2,
				requestTimeoutMs: 120000,
			},
		};

		const sparseDefaultsManager = new SettingsService(pluginWithSparseDefaults as any);
		await sparseDefaultsManager.loadSettings();

		expect(sparseDefaultsManager.getOutputDefaults().playlistMode).toBe(DEFAULT_PLAYLIST_MODE);
		expect(sparseDefaultsManager.getOutputDefaults().generateAiSummary).toBe(DEFAULT_GENERATE_AI_SUMMARY);
		expect(sparseDefaultsManager.getOutputDefaults().transcriptLanguageMode).toBe(DEFAULT_TRANSCRIPT_LANGUAGE_MODE);
		expect(sparseDefaultsManager.getOutputDefaults().preferredTranscriptLanguage).toBe(DEFAULT_PREFERRED_TRANSCRIPT_LANGUAGE);
		expect(sparseDefaultsManager.getOutputDefaults().transcriptFailureMode).toBe(DEFAULT_TRANSCRIPT_FAILURE_MODE);
		expect(sparseDefaultsManager.getOutputDefaults().useVideoTitleAsNoteName).toBe(true);
		expect(sparseDefaultsManager.getOutputDefaults().includeRunReport).toBe(DEFAULT_INCLUDE_RUN_REPORT);
		expect(sparseDefaultsManager.getOutputDefaults().runReportLocation).toBe(DEFAULT_RUN_REPORT_LOCATION);
		expect(sparseDefaultsManager.getOutputDefaults().mediaEmbedMode).toBe(DEFAULT_MEDIA_EMBED_MODE);
		expect(sparseDefaultsManager.getOutputDefaults().noteDestinationMode).toBe(DEFAULT_NOTE_DESTINATION_MODE);
		expect(sparseDefaultsManager.getOutputDefaults().noteDestinationFolder).toBe(DEFAULT_NOTE_DESTINATION_FOLDER);
		expect(sparseDefaultsManager.getOutputDefaults().tldrCalloutAtTop).toBe(DEFAULT_TLDR_CALLOUT_AT_TOP);
		expect(sparseDefaultsManager.getInstructionConfig()).toEqual({
			mode: DEFAULT_INSTRUCTION_MODE,
			template: DEFAULT_INSTRUCTION_TEMPLATE,
			manualInstructions: DEFAULT_MANUAL_INSTRUCTIONS,
			includeMindmap: DEFAULT_INCLUDE_MINDMAP,
			includeMemorableQuotes: DEFAULT_INCLUDE_MEMORABLE_QUOTES,
		});
		expect(pluginWithSparseDefaults.saveData).toHaveBeenCalled();

		const explicitFalsePlugin = new FakePlugin();
		explicitFalsePlugin.data = {
			settings: {
				providers: [],
				selectedModelId: null,
				outputDefaults: {
					generateAiSummary: false,
					transcriptMode: 'none',
					playlistMode: 'combined',
					transcriptLanguageMode: 'preferred',
					preferredTranscriptLanguage: 'fr',
					transcriptFailureMode: 'fail',
					mediaEmbedMode: 'thumbnail',
					includeRunReport: false,
					runReportLocation: 'separate-note',
					useVideoTitleAsNoteName: false,
					noteDestinationMode: 'folder',
					noteDestinationFolder: 'Videos',
					tldrCalloutAtTop: false,
				},
				instructionConfig: { mode: 'template', template: 'study', manualInstructions: '', includeMindmap: true },
				maxTokens: 1000,
				temperature: 0.2,
				requestTimeoutMs: 120000,
			},
		};

		const explicitFalseManager = new SettingsService(explicitFalsePlugin as any);
		await explicitFalseManager.loadSettings();

		expect(explicitFalseManager.getOutputDefaults().playlistMode).toBe('combined');
		expect(explicitFalseManager.getOutputDefaults().generateAiSummary).toBe(false);
		expect(explicitFalseManager.getOutputDefaults().transcriptLanguageMode).toBe('preferred');
		expect(explicitFalseManager.getOutputDefaults().preferredTranscriptLanguage).toBe('fr');
		expect(explicitFalseManager.getOutputDefaults().transcriptFailureMode).toBe('fail');
		expect(explicitFalseManager.getOutputDefaults().mediaEmbedMode).toBe('thumbnail');
		expect(explicitFalseManager.getOutputDefaults().includeRunReport).toBe(false);
		expect(explicitFalseManager.getOutputDefaults().runReportLocation).toBe('separate-note');
		expect(explicitFalseManager.getOutputDefaults().useVideoTitleAsNoteName).toBe(false);
		expect(explicitFalseManager.getOutputDefaults().noteDestinationMode).toBe('folder');
		expect(explicitFalseManager.getOutputDefaults().noteDestinationFolder).toBe('Videos');
		expect(explicitFalseManager.getOutputDefaults().tldrCalloutAtTop).toBe(false);
		expect(explicitFalseManager.getInstructionConfig()).toEqual({
			mode: 'template',
			template: 'study',
			manualInstructions: '',
			includeMindmap: true,
			includeMemorableQuotes: DEFAULT_INCLUDE_MEMORABLE_QUOTES,
		});
	});

	it('uses template defaults when no instruction config exists', async () => {
		const plugin = new FakePlugin();
		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		expect(manager.getInstructionConfig()).toEqual({
			mode: DEFAULT_INSTRUCTION_MODE,
			template: DEFAULT_INSTRUCTION_TEMPLATE,
			manualInstructions: DEFAULT_MANUAL_INSTRUCTIONS,
			includeMindmap: DEFAULT_INCLUDE_MINDMAP,
			includeMemorableQuotes: DEFAULT_INCLUDE_MEMORABLE_QUOTES,
		});
	});

	it('falls back dropped or invalid template ids to the default content template', async () => {
		const plugin = new FakePlugin();
		plugin.data = {
			settings: {
				providers: [],
				selectedModelId: null,
				instructionConfig: {
					mode: 'template',
					template: 'talk',
					manualInstructions: 'prompt',
					includeMindmap: false,
					includeMemorableQuotes: false,
				},
			},
		};

		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		expect(manager.getInstructionConfig().template).toBe(DEFAULT_INSTRUCTION_TEMPLATE);
		expect(plugin.saveData).toHaveBeenCalled();
	});

	it('preserves non-empty instruction control values during normalization', async () => {
		const plugin = new FakePlugin();
		plugin.data = {
			settings: {
				providers: [],
				selectedModelId: null,
				instructionConfig: {
					mode: 'template',
					template: 'research',
					manualInstructions: 'prompt',
					includeMindmap: false,
					includeMemorableQuotes: false,
					controlValues: {
						inquiry: '  How does retrieval practice scale?  ',
						strictness: 'strict',
						empty: '   ',
						notString: 42,
					},
				},
			},
		};

		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		expect(manager.getInstructionConfig().controlValues).toEqual({
			inquiry: 'How does retrieval practice scale?',
			strictness: 'strict',
		});
	});

	it('round-trips Ollama-style model ids that contain colons (provider:model:tag)', async () => {
		const plugin = new FakePlugin();
		plugin.data = {
			settings: {
				providers: [
					{
						name: 'Ollama',
						type: 'openai-compatible',
						apiKey: '',
						url: 'http://localhost:11434/v1',
						models: [{ name: 'qwen3.5:4b', displayName: 'Qwen 3.5 4B' }],
					},
				],
				selectedModelId: 'Ollama:qwen3.5:4b',
				instructionConfig: { mode: 'manual', template: 'implementation', manualInstructions: 'p', includeMindmap: false },
				maxTokens: 1000,
				temperature: 0.2,
				requestTimeoutMs: 120000,
			},
		};

		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		expect(manager.validateModelId('Ollama:qwen3.5:4b')).toBe(true);
		expect(manager.getSelectedModel()?.name).toBe('qwen3.5:4b');
		expect(manager.getSelectedModel()?.provider.name).toBe('Ollama');
	});

	it('rejects malformed model ids (missing colon, missing parts, leading colon)', async () => {
		const plugin = new FakePlugin();
		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		expect(manager.validateModelId('')).toBe(false);
		expect(manager.validateModelId('NoColon')).toBe(false);
		expect(manager.validateModelId(':missing-provider')).toBe(false);
		expect(manager.validateModelId('missing-model:')).toBe(false);
	});

	it('throws a descriptive error when adding a duplicate provider', async () => {
		const plugin = new FakePlugin();
		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		await manager.addProvider({ name: 'OpenAI', type: 'openai', apiKey: '', apiKeySecretId: 'openai-secret', url: '', models: [] });

		await expect(
			manager.addProvider({ name: 'OpenAI', type: 'openai', apiKey: '', apiKeySecretId: 'openai-secret', url: '', models: [] }),
		).rejects.toThrow(/unique/i);
	});

	it('throws when a provider name contains a colon', async () => {
		const plugin = new FakePlugin();
		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		await expect(
			manager.addProvider({ name: 'Open:AI', type: 'openai', apiKey: '', apiKeySecretId: 'openai-secret', url: '', models: [] }),
		).rejects.toThrow(/colon/i);
	});

	it('throws a clear error when an Anthropic or Gemini provider is added without an API key', async () => {
		const plugin = new FakePlugin();
		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		await expect(
			manager.addProvider({ name: 'Anthropic', type: 'anthropic', apiKey: '', url: undefined, models: [] }),
		).rejects.toThrow(/Anthropic providers require an API key/);
		await expect(
			manager.addProvider({ name: 'Gemini', type: 'gemini', apiKey: '', url: undefined, models: [] }),
		).rejects.toThrow(/Gemini providers require an API key/);
	});

	it('saveProviderSecretId replaces the API key secret reference without re-validating other fields', async () => {
		const plugin = new FakePlugin();
		plugin.data = { settings: { providers: [baseProvider] } };
		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();

		plugin.app.secretStorage.setSecret('new-secret', 'new-key');
		await manager.saveProviderSecretId('Gemini', 'new-secret');
		expect(manager.getProviders()[0].apiKey).toBe('new-key');
		expect(plugin.data?.settings?.providers?.[0].apiKey).toBeUndefined();
		expect(plugin.data?.settings?.providers?.[0].apiKeySecretId).toBe('new-secret');

		await expect(manager.saveProviderSecretId('NotThere', 'x')).rejects.toThrow(/Provider "NotThere" not found/);
	});

	it('drops legacy plaintext provider keys instead of migrating them', async () => {
		const plugin = new FakePlugin();
		plugin.data = {
			settings: {
				providers: [{
					name: 'Gemini',
					type: 'gemini',
					apiKey: 'legacy-plaintext-key',
					models: [{ name: 'gemini-1.5-flash', displayName: 'Gemini Flash' }],
				}],
			},
		};
		const manager = new SettingsService(plugin as any);

		await manager.loadSettings();

		const storedProvider = plugin.data?.settings?.providers?.[0];
		expect(storedProvider.apiKey).toBeUndefined();
		expect(storedProvider.apiKeySecretId).toBeUndefined();
		expect(manager.getProviders()[0].apiKey).toBe('');
	});

	it('stores selected secret ids in data.json instead of API key values', async () => {
		const plugin = new FakePlugin();
		plugin.app = new App();
		plugin.app.secretStorage.setSecret('gemini-secret', 'test-key');
		plugin.app.secretStorage.setSecret('replacement-secret', 'new-key');
		plugin.data = {
			settings: {
				providers: [{
					...baseProvider,
					apiKey: undefined,
					apiKeySecretId: 'gemini-secret',
				}],
			},
		};
		const manager = new SettingsService(plugin as any);

		await manager.loadSettings();
		await manager.saveProviderSecretId('Gemini', 'replacement-secret');

		const storedProvider = plugin.data?.settings?.providers?.[0];
		expect(storedProvider.apiKey).toBeUndefined();
		expect(storedProvider.apiKeySecretId).toBe('replacement-secret');
		expect(manager.getProviders()[0].apiKey).toBe('new-key');
	});

	it('clears the active model when its provider is renamed-deleted', async () => {
		const plugin = new FakePlugin();
		plugin.data = {
			settings: {
				providers: [baseProvider],
				selectedModelId: 'Gemini:gemini-1.5-flash',
				instructionConfig: { mode: 'manual', template: 'implementation', manualInstructions: 'p', includeMindmap: false },
				maxTokens: 1000,
				temperature: 0.2,
				requestTimeoutMs: 120000,
			},
		};

		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();
		await manager.deleteProvider({ name: 'Gemini', type: 'gemini', apiKey: 'test-key', models: [] });

		expect(manager.getSelectedModel()).toBeNull();
	});

	describe('migration: addAlias → frontmatterPropertyAllowlist pruning', () => {
		it('prunes aliases from allowlist when addAlias is false', async () => {
			const plugin = new FakePlugin();
			plugin.data = {
				settings: {
					outputDefaults: {
						addAlias: false,
						frontmatterPropertyAllowlist: 'title aliases channel',
					},
				},
			};

			const manager = new SettingsService(plugin as any);
			await manager.loadSettings();

			const allowlist = manager.getOutputDefaults().frontmatterPropertyAllowlist;
			expect(allowlist).not.toContain('aliases');
			expect(allowlist.split(/\s+/)).toEqual(expect.arrayContaining(['title', 'channel']));
		});

		it('leaves allowlist unchanged when addAlias is true', async () => {
			const plugin = new FakePlugin();
			plugin.data = {
				settings: {
					outputDefaults: {
						addAlias: true,
						frontmatterPropertyAllowlist: 'title aliases channel',
					},
				},
			};

			const manager = new SettingsService(plugin as any);
			await manager.loadSettings();

			const allowlist = manager.getOutputDefaults().frontmatterPropertyAllowlist;
			expect(allowlist).toContain('aliases');
		});
	});

	describe('saved frontmatter allowlists', () => {
		it('preserves a saved previously published default allowlist', async () => {
			const previouslyPublishedDefaultAllowlist = 'title aliases source channel channelUrl videoUrl playlistUrl videoId playlistId generated videoCount';
			const plugin = new FakePlugin();
			plugin.data = {
				settings: {
					outputDefaults: {
						frontmatterPropertyAllowlist: previouslyPublishedDefaultAllowlist,
					},
				},
			};

			const manager = new SettingsService(plugin as any);
			await manager.loadSettings();

			expect(manager.getOutputDefaults().frontmatterPropertyAllowlist).toBe(previouslyPublishedDefaultAllowlist);
		});

		it('preserves custom allowlists when adding new default metadata keys', async () => {
			const plugin = new FakePlugin();
			plugin.data = {
				settings: {
					outputDefaults: {
						frontmatterPropertyAllowlist: 'title channel videoUrl',
					},
				},
			};

			const manager = new SettingsService(plugin as any);
			await manager.loadSettings();

			expect(manager.getOutputDefaults().frontmatterPropertyAllowlist).toBe('title channel videoUrl');
		});
	});

	it('keeps the active model after renaming the owning provider', async () => {
		const plugin = new FakePlugin();
		plugin.data = {
			settings: {
				providers: [baseProvider],
				selectedModelId: 'Gemini:gemini-1.5-flash',
				instructionConfig: { mode: 'manual', template: 'implementation', manualInstructions: 'p', includeMindmap: false },
				maxTokens: 1000,
				temperature: 0.2,
				requestTimeoutMs: 120000,
			},
		};

		const manager = new SettingsService(plugin as any);
		await manager.loadSettings();
		await manager.updateProvider(
			{ name: 'GeminiPro', type: 'gemini', apiKey: '', apiKeySecretId: 'gemini-secret', url: undefined, models: [] },
			'Gemini',
		);

		expect(manager.validateModelId('GeminiPro:gemini-1.5-flash')).toBe(true);
		expect(manager.getSelectedModel()?.name).toBe('gemini-1.5-flash');
	});
});
