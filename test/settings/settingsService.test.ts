import { describe, expect, it, vi } from 'vitest';
import { App } from 'obsidian';
import { SettingsService } from '../../src/settings/settingsService';
import {
	DEFAULT_GENERATE_AI_SUMMARY,
	DEFAULT_INCLUDE_MEMORABLE_QUOTES,
	DEFAULT_INCLUDE_MINDMAP,
	DEFAULT_INSTRUCTION_MODE,
	DEFAULT_INSTRUCTION_TEMPLATE,
	DEFAULT_MANUAL_INSTRUCTIONS,
	DEFAULT_MEDIA_EMBED_MODE,
	DEFAULT_NOTE_DESTINATION_FOLDER,
	DEFAULT_NOTE_DESTINATION_MODE,
	DEFAULT_OUTPUT_TRANSCRIPT_MODE,
	DEFAULT_REQUEST_TIMEOUT_MS,
	DEFAULT_TLDR_CALLOUT_AT_TOP,
	DEFAULT_USE_AI,
} from '../../src/defaults';
import { createDefaultFrontmatterPropertyPreferences } from '../../src/frontmatterProperties';

vi.mock('obsidian', async () => {
	const mod = await import('../mocks/obsidian');
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

const geminiProvider = {
	name: 'Gemini',
	type: 'gemini' as const,
	apiKeySecretId: 'gemini-secret',
	models: [{ name: 'gemini-1.5-flash', displayName: 'Gemini Flash' }],
};

function makeManager(data?: DataStore | null): { plugin: FakePlugin; manager: SettingsService } {
	const plugin = new FakePlugin();
	plugin.data = data ?? null;
	return { plugin, manager: new SettingsService(plugin as any) };
}

describe('SettingsService current contracts', () => {
	it('starts empty with the current defaults', async () => {
		const { manager } = makeManager();

		await manager.loadSettings();

		expect(manager.hasSavedSettings()).toBe(false);
		expect(manager.getProviders()).toEqual([]);
		expect(manager.getSelectedModels()).toEqual([]);
		expect(manager.getOutputDefaults()).toMatchObject({
			useAi: DEFAULT_USE_AI,
			generateAiSummary: DEFAULT_GENERATE_AI_SUMMARY,
			transcriptMode: DEFAULT_OUTPUT_TRANSCRIPT_MODE,
			mediaEmbedMode: DEFAULT_MEDIA_EMBED_MODE,
			noteDestinationMode: DEFAULT_NOTE_DESTINATION_MODE,
			noteDestinationFolder: DEFAULT_NOTE_DESTINATION_FOLDER,
			frontmatterProperties: createDefaultFrontmatterPropertyPreferences(),
			tldrCalloutAtTop: DEFAULT_TLDR_CALLOUT_AT_TOP,
		});
		expect(manager.getInstructionConfig()).toEqual({
			mode: DEFAULT_INSTRUCTION_MODE,
			template: DEFAULT_INSTRUCTION_TEMPLATE,
			manualInstructions: DEFAULT_MANUAL_INSTRUCTIONS,
			includeMindmap: DEFAULT_INCLUDE_MINDMAP,
			includeMemorableQuotes: DEFAULT_INCLUDE_MEMORABLE_QUOTES,
		});
		expect(manager.getRequestTimeoutMs()).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
	});

	it('manages providers, models, active selection, and discovered model merges', async () => {
		const { manager } = makeManager();
		await manager.loadSettings();

		await manager.addProvider({ name: 'Local', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1', models: [] });
		await manager.addModel({
			name: 'qwen3.5:4b',
			displayName: 'Qwen 3.5 4B',
			provider: { name: 'Local', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
		});
		await manager.updateModelIds(['Local:qwen3.5:4b']);

		expect(manager.validateModelId('Local:qwen3.5:4b')).toBe(true);
		expect(manager.getSelectedModels()[0]?.name).toBe('qwen3.5:4b');

		const added = await manager.mergeProviderModels('Local', [
			{ name: 'qwen3.5:4b', displayName: 'Qwen updated', contextWindow: 262144 },
			{ name: 'llama3.2', displayName: 'Llama 3.2', contextWindow: 131072 },
		]);

		expect(added).toBe(1);
		expect(manager.getProviders()[0].models?.map((model) => ({ name: model.name, contextWindow: model.contextWindow }))).toEqual([
			{ name: 'qwen3.5:4b', contextWindow: 262144 },
			{ name: 'llama3.2', contextWindow: 131072 },
		]);

		await manager.deleteModel('Local', 'qwen3.5:4b');
		expect(manager.validateModelId('Local:qwen3.5:4b')).toBe(false);
	});

	it('preserves user-configured model metadata during discovery', async () => {
		const { manager } = makeManager();
		await manager.loadSettings();
		await manager.addProvider({ name: 'Local', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1', models: [] });
		await manager.addModel({
			name: 'qwen3.5:4b',
			displayName: 'Qwen 3.5 4B',
			contextWindow: 8192,
			provider: { name: 'Local', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
		});

		await manager.mergeProviderModels('Local', [
			{ name: 'qwen3.5:4b', displayName: 'Qwen discovered', contextWindow: undefined },
		]);

		expect(manager.getProviders()[0]?.models?.[0]).toMatchObject({
			displayName: 'Qwen 3.5 4B',
			contextWindow: 8192,
		});
	});

	it('allows incomplete provider connections while enforcing provider identity', async () => {
		const { manager } = makeManager();
		await manager.loadSettings();

		await manager.addProvider({ name: 'Ollama', type: 'openai-compatible', apiKey: '', url: '', models: [] });
		await expect(manager.addProvider({ name: 'Open:AI', type: 'openai', apiKey: '', apiKeySecretId: 'openai-secret', url: '', models: [] })).rejects.toThrow(/colon/i);
		await manager.addProvider({ name: 'Gemini incomplete', type: 'gemini', apiKey: '', models: [] });
		expect(manager.getProviders().map((provider) => provider.name)).toEqual(['Ollama', 'Gemini incomplete']);

		expect(manager.validateModelId('')).toBe(false);
		expect(manager.validateModelId('NoColon')).toBe(false);
		expect(manager.validateModelId(':missing-provider')).toBe(false);
		expect(manager.validateModelId('missing-model:')).toBe(false);
	});

	it('persists custom URLs only for OpenAI-compatible providers', async () => {
		const { manager } = makeManager({
			settings: {
				providers: [
					{
						name: 'Anthropic',
						type: 'anthropic',
						apiKeySecretId: 'anthropic-secret',
						url: 'https://proxy.example/anthropic',
						models: [],
					},
					{
						name: 'Gateway',
						type: 'openai-compatible',
						url: 'https://gateway.example/v1',
						models: [],
					},
				],
			},
		});

		await manager.loadSettings();

		expect(manager.getProviders().find((provider) => provider.type === 'anthropic')?.url).toBeUndefined();
		expect(manager.getProviders().find((provider) => provider.type === 'openai-compatible')?.url)
			.toBe('https://gateway.example/v1');
	});

	it('normalizes persisted output defaults without overwriting explicit current choices', async () => {
		const { plugin, manager } = makeManager({
			settings: {
				outputDefaults: {
					useAi: true,
					generateAiSummary: false,
					transcriptMode: 'timestamped',
					playlistMode: 'combined',
					transcriptLanguageMode: 'preferred',
					preferredTranscriptLanguage: ' fr ',
					transcriptFailureMode: 'fail',
					mediaEmbedMode: 'thumbnail',
					includeReport: false,
					reportLocation: 'separate-note',
					useVideoTitleAsNoteName: false,
					noteDestinationMode: 'folder',
					noteDestinationFolder: ' Videos ',
					includeFrontmatter: false,
					frontmatterTags: ' #youtube ',
					frontmatterPropertyAllowlist: 'title channel videoUrl',
					sourceSectionPosition: 'top',
					linkTimestamps: false,
					tldrCalloutAtTop: false,
				},
				temperature: 9,
				requestTimeoutMs: 123456,
			},
		});

		await manager.loadSettings();

		expect(manager.getOutputDefaults()).toMatchObject({
			useAi: true,
			generateAiSummary: false,
			transcriptMode: 'timestamped',
			playlistMode: 'combined',
			transcriptLanguageMode: 'preferred',
			preferredTranscriptLanguage: 'fr',
			transcriptFailureMode: 'fail',
			mediaEmbedMode: 'thumbnail',
			includeReport: false,
			reportLocation: 'separate-note',
			useVideoTitleAsNoteName: false,
			noteDestinationMode: 'folder',
			noteDestinationFolder: 'Videos',
			includeFrontmatter: false,
			frontmatterTags: '#youtube',
			frontmatterProperties: expect.arrayContaining([
				{ key: 'title', enabled: true },
				{ key: 'channel', enabled: true },
				{ key: 'videoUrl', enabled: true },
			]),
			sourceSectionPosition: 'top',
			linkTimestamps: false,
			tldrCalloutAtTop: false,
		});
		expect(manager.getTemperature()).toBe(2);
		expect(manager.getRequestTimeoutMs()).toBe(123456);
		expect(plugin.saveData).toHaveBeenCalled();
	});

	it('migrates 1.8.1 report keys once with current keys taking precedence', async () => {
		const from181 = makeManager({
			settings: {
				providers: [geminiProvider],
				modelIds: ['Gemini:gemini-1.5-flash'],
				outputDefaults: {
					useAi: false,
					generateAiSummary: false,
					includeRunReport: false,
					runReportLocation: 'separate-note',
					openCreatedNote: true,
					frontmatterPropertyAllowlist: 'title channel topic',
				},
			},
		});
		await from181.manager.loadSettings();

		expect(from181.manager.getOutputDefaults()).toMatchObject({
			useAi: false,
			generateAiSummary: false,
			includeReport: false,
			reportLocation: 'separate-note',
			openCreatedNote: true,
			frontmatterProperties: expect.arrayContaining([
				{ key: 'title', enabled: true },
				{ key: 'channel', enabled: true },
				{ key: 'topic', enabled: true },
			]),
		});
		expect(from181.manager.getProviders()).toHaveLength(1);
		expect(from181.manager.getModelIds()).toEqual(['Gemini:gemini-1.5-flash']);
		expect(from181.plugin.data?.settings?.outputDefaults).toMatchObject({
			includeReport: false,
			reportLocation: 'separate-note',
		});
		expect(from181.plugin.data?.settings?.outputDefaults?.includeRunReport).toBeUndefined();
		expect(from181.plugin.data?.settings?.outputDefaults?.runReportLocation).toBeUndefined();
		expect(from181.plugin.data?.settings?.outputDefaults?.frontmatterPropertyAllowlist).toBeUndefined();

		const mixed = makeManager({
			settings: {
				outputDefaults: {
					includeReport: true,
					reportLocation: 'generated-note',
					includeRunReport: false,
					runReportLocation: 'separate-note',
				},
			},
		});
		await mixed.manager.loadSettings();
		expect(mixed.manager.getOutputDefaults()).toMatchObject({
			includeReport: true,
			reportLocation: 'generated-note',
		});
	});

	it('falls back from invalid persisted output values', async () => {
		const invalidMedia = makeManager({ settings: { outputDefaults: { mediaEmbedMode: 'poster' } } });
		await invalidMedia.manager.loadSettings();
		expect(invalidMedia.manager.getOutputDefaults().mediaEmbedMode).toBe(DEFAULT_MEDIA_EMBED_MODE);
	});

	it('normalizes usable instruction control values', async () => {
		const controls = makeManager({
			settings: {
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
		});

		await controls.manager.loadSettings();

		expect(controls.manager.getInstructionConfig().controlValues).toEqual({
			inquiry: 'How does retrieval practice scale?',
			strictness: 'strict',
		});
	});

	it('merges sequential instruction patches without reverting earlier changes', async () => {
		const { manager } = makeManager({
			settings: {
				instructionConfig: {
					mode: 'template',
					template: 'general',
					manualInstructions: '',
					includeMindmap: true,
					includeMemorableQuotes: false,
				},
			},
		});
		await manager.loadSettings();

		await manager.updateInstructionConfig({ includeMindmap: false });
		await manager.updateInstructionConfig({ includeMemorableQuotes: true });

		expect(manager.getInstructionConfig()).toMatchObject({
			includeMindmap: false,
			includeMemorableQuotes: true,
		});
	});

	it('tracks release-note state independently from reset settings', async () => {
		const { plugin, manager } = makeManager({
			settings: {
				providers: [geminiProvider],
				lastSeenReleaseNotesVersion: ' 1.7.0 ',
			},
		});

		await manager.loadSettings();
		expect(manager.hasSavedSettings()).toBe(true);
		expect(manager.getLastSeenReleaseNotesVersion()).toBe('1.7.0');

		await manager.setLastSeenReleaseNotesVersion('1.7.2');
		await manager.resetAllSettings();

		expect(manager.getProviders()).toEqual([]);
		expect(manager.getLastSeenReleaseNotesVersion()).toBe('1.7.2');
		expect(plugin.data?.settings?.lastSeenReleaseNotesVersion).toBe('1.7.2');
	});

	it('resets General and AI defaults independently', async () => {
		const { manager } = makeManager();
		await manager.loadSettings();
		const defaults = structuredClone(manager.getOutputDefaults());

		await manager.addProvider({
			name: 'Local',
			type: 'openai-compatible',
			apiKey: '',
			url: 'http://localhost:11434/v1',
			models: [],
		});
		await manager.updateOutputDefaults({
			...manager.getOutputDefaults(),
			useAi: false,
			generateAiSummary: false,
			tldrCalloutAtTop: false,
			transcriptMode: 'none',
			playlistMode: 'combined',
			channelContentTypes: ['shorts'],
			channelVideoLimit: null,
			transcriptLanguageMode: 'preferred',
			preferredTranscriptLanguage: 'ar',
			transcriptFailureMode: 'fail',
			mediaEmbedMode: 'none',
			includeReport: false,
			reportLocation: 'separate-note',
			useVideoTitleAsNoteName: false,
			noteDestinationMode: 'folder',
			noteDestinationFolder: 'YT',
			openCreatedNote: true,
			includeFrontmatter: false,
			frontmatterTags: 'video',
			frontmatterProperties: [],
			sourceSectionPosition: 'top',
			linkTimestamps: false,
		});
		await manager.updateInstructionConfig({
			mode: 'manual',
			manualInstructions: 'Custom',
			includeMindmap: false,
			includeMemorableQuotes: false,
		});
		await manager.updateTemperature(1.7);
		await manager.updateRequestTimeoutMs(45000);

		await manager.resetGeneralDefaults();
		expect(manager.getOutputDefaults()).toEqual({
			...defaults,
			useAi: false,
			generateAiSummary: false,
			tldrCalloutAtTop: false,
		});
		expect(manager.getInstructionConfig().mode).toBe('manual');
		expect(manager.getProviders()).toHaveLength(1);

		await manager.resetAiDefaults();
		expect(manager.getOutputDefaults()).toEqual(defaults);
		expect(manager.getInstructionConfig()).toEqual({
			mode: DEFAULT_INSTRUCTION_MODE,
			template: DEFAULT_INSTRUCTION_TEMPLATE,
			manualInstructions: DEFAULT_MANUAL_INSTRUCTIONS,
			includeMindmap: DEFAULT_INCLUDE_MINDMAP,
			includeMemorableQuotes: DEFAULT_INCLUDE_MEMORABLE_QUOTES,
		});
		expect(manager.getTemperature()).toBe(0.3);
		expect(manager.getRequestTimeoutMs()).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
		expect(manager.getProviders()).toHaveLength(1);
	});

	it('stores provider secrets by secret id and never persists plaintext API keys', async () => {
		const { plugin, manager } = makeManager({ settings: { providers: [geminiProvider] } });
		await manager.loadSettings();

		plugin.app.secretStorage.setSecret('replacement-secret', 'new-key');
		await manager.saveProviderSecretId('Gemini', 'replacement-secret');

		expect(manager.getProviders()[0].apiKey).toBe('new-key');
		expect(plugin.data?.settings?.providers?.[0].apiKey).toBeUndefined();
		expect(plugin.data?.settings?.providers?.[0].apiKeySecretId).toBe('replacement-secret');
		await expect(manager.saveProviderSecretId('Missing', 'replacement-secret')).rejects.toThrow(/Provider "Missing" not found/);
	});
});

describe('SettingsService model chain', () => {
	async function makeWithTwoModels() {
		const { plugin, manager } = makeManager();
		await manager.loadSettings();
		await manager.addProvider({ name: 'Local', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1', models: [] });
		await manager.addModel({
			name: 'qwen3.5:4b',
			displayName: 'Qwen',
			provider: { name: 'Local', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
		});
		await manager.addModel({
			name: 'llama3.2',
			displayName: 'Llama',
			provider: { name: 'Local', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
		});
		return { plugin, manager };
	}

	it('persists only the canonical model chain', async () => {
		const { plugin, manager } = await makeWithTwoModels();

		await manager.updateModelIds(['Local:llama3.2', 'Local:qwen3.5:4b']);

		expect(manager.getModelIds()).toEqual(['Local:llama3.2', 'Local:qwen3.5:4b']);
		expect(plugin.data?.settings?.modelIds).toEqual(['Local:llama3.2', 'Local:qwen3.5:4b']);
		expect(manager.getSelectedModels()[0]?.name).toBe('llama3.2');
	});

	it('drops invalid and duplicate entries when updating the chain', async () => {
		const { manager } = await makeWithTwoModels();

		await manager.updateModelIds(['Local:qwen3.5:4b', 'Local:qwen3.5:4b', 'Missing:model', 'no-colon']);

		expect(manager.getModelIds()).toEqual(['Local:qwen3.5:4b']);
	});

	it('prunes stale chain entries on load', async () => {
		const { manager } = makeManager({
			settings: {
				providers: [{ name: 'Local', type: 'openai-compatible', url: 'http://localhost:11434/v1', models: [{ name: 'llama3.2', displayName: 'Llama' }] }],
				modelIds: ['Local:gone', 'Local:llama3.2'],
			},
		});
		await manager.loadSettings();

		expect(manager.getModelIds()).toEqual(['Local:llama3.2']);
		expect(manager.getSelectedModels()[0]?.name).toBe('llama3.2');
	});

	it('keeps the chain in sync when providers are renamed or models deleted', async () => {
		const { manager } = await makeWithTwoModels();
		await manager.updateModelIds(['Local:qwen3.5:4b', 'Local:llama3.2']);

		await manager.updateProvider({ name: 'Ollama', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' }, 'Local');
		expect(manager.getModelIds()).toEqual(['Ollama:qwen3.5:4b', 'Ollama:llama3.2']);

		await manager.deleteModel('Ollama', 'qwen3.5:4b');
		expect(manager.getModelIds()).toEqual(['Ollama:llama3.2']);
		expect(manager.getSelectedModels()[0]?.name).toBe('llama3.2');

		await manager.deleteProvider({ name: 'Ollama', type: 'openai-compatible', apiKey: '' });
		expect(manager.getModelIds()).toEqual([]);
		expect(manager.getSelectedModels()).toEqual([]);
	});
});
