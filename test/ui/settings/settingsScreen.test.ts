import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../../mocks/obsidian');
	return {
		...mod,
		PluginSettingTab: class {
			containerEl = document.createElement('div');
			update = vi.fn();
			refreshDomState = vi.fn();

			constructor(
				public app: unknown,
				public plugin: unknown,
			) { }
		},
	};
});

import { App, Setting } from 'obsidian';
import type { SettingDefinitionItem, SettingPage } from 'obsidian';
import { SettingsScreen } from '../../../src/ui/settings/settingsScreen';
import { WhatsNewModal } from '../../../src/ui/releaseNotes/whatsNewModal';
import { GENERATION_OPTIONS_SCHEMA as OPTIONS } from '../../../src/ui/shared/generationOptionsSchema';
import type {
	InstructionConfig,
	ModelConfig,
	OutputDefaults,
	ProviderConfig,
} from '../../../src/types';

const baseOutputDefaults: OutputDefaults = {
	useAi: true,
	generateAiSummary: true,
	transcriptMode: 'none',
	playlistMode: 'per-video',
	channelContentTypes: ['videos', 'shorts', 'streams'],
	channelVideoLimit: 10,
	transcriptLanguageMode: 'auto',
	preferredTranscriptLanguage: '',
	transcriptFailureMode: 'skip',
	mediaEmbedMode: 'video',
	includeReport: true,
	reportLocation: 'generated-note',
	useVideoTitleAsNoteName: true,
	noteDestinationMode: 'current-note',
	noteDestinationFolder: '',
	openCreatedNote: false,
	includeFrontmatter: true,
	frontmatterTags: '',
	frontmatterPropertyAllowlist: 'title channel videoUrl',
	sourceSectionPosition: 'top',
	linkTimestamps: true,
	tldrCalloutAtTop: true,
};

const baseInstructionConfig: InstructionConfig = {
	mode: 'template',
	template: 'general',
	manualInstructions: '',
	includeMindmap: true,
	includeMemorableQuotes: true,
	controlValues: {},
};

function makeProvider(): ProviderConfig {
	return {
		name: 'Local',
		type: 'openai-compatible',
		apiKey: '',
		apiKeySecretId: 'local-secret',
		url: 'http://localhost:11434/v1',
		models: [{
			name: 'llama3.2',
			displayName: 'Llama 3.2',
			provider: {
				name: 'Local',
				type: 'openai-compatible',
				apiKey: '',
				apiKeySecretId: 'local-secret',
				url: 'http://localhost:11434/v1',
			},
		}],
	};
}

function makeFakeSettings(options: {
	outputDefaults?: Partial<OutputDefaults>;
	instructionConfig?: Partial<InstructionConfig>;
	providers?: ProviderConfig[];
	modelIds?: string[];
} = {}) {
	let outputDefaults: OutputDefaults = {
		...baseOutputDefaults,
		...options.outputDefaults,
	};
	let instructionConfig: InstructionConfig = {
		...baseInstructionConfig,
		...options.instructionConfig,
	};
	let providers = options.providers ?? [];
	let modelIds = [...(options.modelIds ?? [])];

	const settings = {
		getModels: vi.fn(() => providers.flatMap((provider) => provider.models ?? [])),
		getModelIds: vi.fn(() => [...modelIds]),
		getSelectedModels: vi.fn(() => [] as ModelConfig[]),
		updateModelIds: vi.fn(async (next: string[]) => {
			modelIds = [...next];
		}),
		getProviders: vi.fn(() => providers),
		getOutputDefaults: vi.fn(() => outputDefaults),
		getInstructionConfig: vi.fn(() => instructionConfig),
		getTemperature: vi.fn(() => 0.3),
		getRequestTimeoutMs: vi.fn(() => 300000),
		updateOutputDefaults: vi.fn(async (next: OutputDefaults) => {
			outputDefaults = next;
		}),
		updateInstructionConfig: vi.fn(async (patch: Partial<InstructionConfig>) => {
			instructionConfig = { ...instructionConfig, ...patch };
		}),
		updateTemperature: vi.fn().mockResolvedValue(undefined),
		updateRequestTimeoutMs: vi.fn().mockResolvedValue(undefined),
		addProvider: vi.fn(async (provider: ProviderConfig) => {
			providers = [...providers, provider];
		}),
		updateProvider: vi.fn(async (provider: ProviderConfig, originalName: string) => {
			providers = providers.map((item) => item.name === originalName ? provider : item);
		}),
		deleteProvider: vi.fn().mockResolvedValue(undefined),
		addModel: vi.fn().mockResolvedValue(undefined),
		updateModel: vi.fn().mockResolvedValue(undefined),
		deleteModel: vi.fn().mockResolvedValue(undefined),
		mergeProviderModels: vi.fn().mockResolvedValue(0),
		resetGeneralDefaults: vi.fn().mockResolvedValue(undefined),
		resetAiDefaults: vi.fn().mockResolvedValue(undefined),
		resetAllSettings: vi.fn().mockResolvedValue(undefined),
		saveProviderSecretId: vi.fn().mockResolvedValue(undefined),
		validateModelId: vi.fn(() => true),
	};

	return settings;
}

function makeFakePlugin(
	settings = makeFakeSettings(),
	openQueueModal = vi.fn(),
) {
	return {
		manifest: { name: 'YT Knowledge Notes', version: '1.8.1' },
		settings,
		openQueueModal,
	};
}

function createSettingsScreen(plugin: ReturnType<typeof makeFakePlugin>): SettingsScreen {
	return new SettingsScreen(
		new App(),
		plugin as any,
		plugin.settings as any,
		plugin.openQueueModal,
	);
}

function flattenDefinitions(items: SettingDefinitionItem[]): SettingDefinitionItem[] {
	return items.flatMap((item) => [
		item,
		...('items' in item && item.items ? flattenDefinitions(item.items as SettingDefinitionItem[]) : []),
	]);
}

function findDefinition(tab: SettingsScreen, name: string): any {
	return flattenDefinitions(tab.getSettingDefinitions() as SettingDefinitionItem[])
		.find((item) => 'name' in item && item.name === name);
}

describe('SettingsScreen declarative settings', () => {
	it('exposes native General and AI pages with individually searchable settings', () => {
		const tab = createSettingsScreen(makeFakePlugin());
		const definitions = tab.getSettingDefinitions();
		const flattened = flattenDefinitions(definitions as SettingDefinitionItem[]);

		expect(definitions.map((item) => 'heading' in item
			? item.heading
			: ('name' in item ? item.name : undefined))).toEqual([
				undefined,
				undefined,
			]);
		const pages = flattened.filter((item) => 'type' in item && item.type === 'page');
		expect(pages.map((item) => 'name' in item ? item.name : undefined)).toEqual([
			'General',
			'AI',
		]);
		expect(pages.filter((item) => 'name' in item && item.name !== 'Frontmatter properties')
			.every((item) => !('displayValue' in item))).toBe(true);
		expect(pages.every((item) => typeof item.desc === 'string')).toBe(true);
		expect(findDefinition(tab, OPTIONS.outputDestination.name)?.control.type).toBe('dropdown');
		expect(findDefinition(tab, OPTIONS.destinationFolder.name)?.control.type).toBe('folder');
		expect(findDefinition(tab, OPTIONS.openCreatedNote.name)?.control.type).toBe('toggle');
		expect(findDefinition(tab, 'Reset everything')?.render).toBeTypeOf('function');
		const hero = findDefinition(tab, 'YT Knowledge Notes');
		expect(hero.searchable).not.toBe(false);
		expect(hero.aliases).toContain('YTKN');
	});

	it('organizes General and AI into the agreed native sections', () => {
		const tab = createSettingsScreen(makeFakePlugin());
		const pages = flattenDefinitions(tab.getSettingDefinitions() as SettingDefinitionItem[])
			.filter((item) => 'type' in item && item.type === 'page') as any[];
		const general = pages.find((page) => page.name === 'General');
		const ai = pages.find((page) => page.name === 'AI');

		expect(general.items.map((item: any) => item.heading).filter(Boolean)).toEqual([
			'Output destination',
			'Note format',
			'Transcript',
			'Playlists and channels',
			'Reports',
		]);
		expect(ai.items.map((item: any) => item.heading).filter(Boolean)).toEqual([
			'AI-generated content',
			'Providers',
			'Model order',
			'Generation parameters',
		]);
		const sectionDescriptions = new Map([
			['Output destination', 'Choose whether output updates the active note or creates notes in a folder, and whether newly created notes open automatically.'],
			['Note format', 'Define the media, naming, frontmatter, and source metadata shared by generated notes.'],
			['Transcript', 'Choose which transcript YouTube supplies and how it appears in generated notes.'],
			['Playlists and channels', 'Control how multi-video sources are split, filtered, limited, and handled when transcripts are unavailable.'],
			['Reports', 'Keep a record of batch outcomes and choose where that record is written.'],
			['AI-generated content', 'Choose which parts of a note AI generates and the instructions used to generate them.'],
			['Providers', 'Connect the cloud services or local servers that make AI models available.'],
			['Model order', 'Choose the first model to try and the fallback order used when a request fails.'],
			['Generation parameters', 'Tune response variation and the maximum time allowed for each model request.'],
		]);
		const sections = [...general.items, ...ai.items]
			.filter((item: any) => sectionDescriptions.has(item.heading));
		expect(sections).toHaveLength(sectionDescriptions.size);
		for (const section of sections) {
			const button = {
				setIcon: vi.fn(),
				setTooltip: vi.fn(),
			};
			button.setIcon.mockReturnValue(button);
			button.setTooltip.mockReturnValue(button);
			expect(section.extraButtons).toHaveLength(1);
			section.extraButtons[0](button);
			expect(button.setIcon).toHaveBeenCalledWith('info');
			expect(button.setTooltip).toHaveBeenCalledWith(sectionDescriptions.get(section.heading));
		}
	});

	it('binds output defaults through the settings service', async () => {
		const settings = makeFakeSettings({
			outputDefaults: { noteDestinationMode: 'folder', openCreatedNote: false },
		});
		const tab = createSettingsScreen(makeFakePlugin(settings));

		expect(tab.getControlValue('output.openCreatedNote')).toBe(false);
		await tab.setControlValue('output.openCreatedNote', true);

		expect(tab.getControlValue('output.openCreatedNote')).toBe(true);
		expect(settings.updateOutputDefaults).toHaveBeenLastCalledWith(
			expect.objectContaining({ openCreatedNote: true }),
		);
	});

	it('uses live visibility predicates for dependent settings', async () => {
		const settings = makeFakeSettings();
		const tab = createSettingsScreen(makeFakePlugin(settings));
		const openCreatedNote = findDefinition(tab, OPTIONS.openCreatedNote.name);

		expect(openCreatedNote.visible()).toBe(false);
		await tab.setControlValue('output.noteDestinationMode', 'folder');
		expect(openCreatedNote.visible()).toBe(true);
		expect((tab as any).refreshDomState).toHaveBeenCalled();

		const preferredLanguage = findDefinition(tab, OPTIONS.preferredLanguageCode.name);
		expect(preferredLanguage.visible()).toBe(false);
		await tab.setControlValue('output.transcriptLanguageMode', 'preferred');
		expect(preferredLanguage.visible()).toBe(true);
	});

	it('renders channel content as one control and prevents removing the final type', async () => {
		const settings = makeFakeSettings({
			outputDefaults: { channelContentTypes: ['videos'] },
		});
		const tab = createSettingsScreen(makeFakePlugin(settings));
		const channel = findDefinition(tab, 'Channel');
		const host = document.createElement('div');
		channel.render(new Setting(host), {} as never);
		const inputs = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));

		expect(inputs).toHaveLength(3);
		inputs[0].checked = false;
		inputs[0].dispatchEvent(new Event('change'));
		expect(inputs[0].checked).toBe(true);
		expect(host.textContent).toContain('Select at least one channel content type.');
		expect(settings.getOutputDefaults().channelContentTypes).toEqual(['videos']);

		inputs[1].checked = true;
		inputs[1].dispatchEvent(new Event('change'));
		await vi.waitFor(() => expect(settings.getOutputDefaults().channelContentTypes)
			.toEqual(['videos', 'shorts']));
	});

	it('maps native channel and request controls to stored value shapes', async () => {
		const settings = makeFakeSettings({
			outputDefaults: { channelVideoLimit: null },
		});
		const tab = createSettingsScreen(makeFakePlugin(settings));

		expect(tab.getControlValue('channel-limit-mode')).toBe('all');
		await tab.setControlValue('channel-limit-mode', 'limited');
		expect(settings.getOutputDefaults().channelVideoLimit).toBe(10);

		await tab.setControlValue('request-timeout-seconds', 45);
		expect(settings.updateRequestTimeoutMs).toHaveBeenCalledWith(45000);
	});

	it('rebuilds template-specific definitions and validates required controls', async () => {
		const settings = makeFakeSettings();
		const tab = createSettingsScreen(makeFakePlugin(settings));

		await tab.setControlValue('instruction.template', 'research');
		expect((tab as any).update).toHaveBeenCalled();

		const inquiry = findDefinition(tab, 'Research inquiry *');
		expect(inquiry.control.type).toBe('textarea');
		expect(inquiry.control.validate('')).toBe('Research inquiry is required.');
		expect(inquiry.control.validate('Question')).toBeUndefined();

		await tab.setControlValue('instruction.control.inquiry', 'What changed?');
		expect(settings.getInstructionConfig().controlValues).toMatchObject({
			inquiry: 'What changed?',
		});
	});

	it('renders the native note-structure preview from current settings', () => {
		const tab = createSettingsScreen(makeFakePlugin());
		const preview = findDefinition(tab, OPTIONS.noteStructurePreview.name);
		const host = document.createElement('div');

		preview.render(new Setting(host), {} as never);
		const text = host.textContent ?? '';
		expect(text).toContain('TL;DR');
		expect(text).toContain('Key takeaways');
		expect(text).toContain('Mind Map');
		expect(text).toContain('Memorable Quotes');
	});

	it('groups optional AI sections and allows clearing every selection', async () => {
		const settings = makeFakeSettings();
		const tab = createSettingsScreen(makeFakePlugin(settings));
		const additionalSections = findDefinition(tab, OPTIONS.additionalSections.name);
		const preview = findDefinition(tab, OPTIONS.noteStructurePreview.name);
		const groupHost = document.createElement('div');
		const previewHost = document.createElement('div');
		additionalSections.render(new Setting(groupHost), {} as never);
		preview.render(new Setting(previewHost), {} as never);
		const options = Array.from(groupHost.querySelectorAll<HTMLElement>('.ytkn-checkbox-group-option'));
		const inputs = options.map((option) => option.querySelector<HTMLInputElement>('input')!);

		expect(options.map((option) => option.textContent?.trim())).toEqual([
			'TL;DR',
			'Mind Map',
			'Memorable Quotes',
		]);
		expect(inputs.map((input) => input.checked)).toEqual([true, true, true]);

		for (const input of inputs) {
			input.checked = false;
			input.dispatchEvent(new Event('change'));
		}

		await vi.waitFor(() => {
			expect(settings.getOutputDefaults().tldrCalloutAtTop).toBe(false);
			expect(settings.getInstructionConfig().includeMindmap).toBe(false);
			expect(settings.getInstructionConfig().includeMemorableQuotes).toBe(false);
		});
		expect(groupHost.textContent).not.toContain('Select at least one');
		expect(previewHost.textContent).not.toContain('TL;DR');
		expect(previewHost.textContent).not.toContain('Mind Map');
		expect(previewHost.textContent).not.toContain('Memorable Quotes');
	});

	it('uses visibility refresh and targeted preview rendering for non-structural changes', async () => {
		const settings = makeFakeSettings();
		const tab = createSettingsScreen(makeFakePlugin(settings));
		const instructionStyle = findDefinition(tab, OPTIONS.instructionStyle.name);
		const preview = findDefinition(tab, OPTIONS.noteStructurePreview.name);
		const host = document.createElement('div');
		preview.render(new Setting(host), {} as never);
		const update = (tab as any).update as ReturnType<typeof vi.fn>;
		update.mockClear();

		await tab.setControlValue('output.tldrCalloutAtTop', false);
		expect(host.textContent).not.toContain('TL;DR');
		expect(update).not.toHaveBeenCalled();

		await tab.setControlValue('output.generateAiSummary', false);
		expect(instructionStyle.visible()).toBe(false);
		expect((tab as any).refreshDomState).toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it('builds dynamic provider pages with connection and model controls', () => {
		const provider = makeProvider();
		const settings = makeFakeSettings({ providers: [provider] });
		const tab = createSettingsScreen(makeFakePlugin(settings));
		const definitions = flattenDefinitions(tab.getSettingDefinitions() as SettingDefinitionItem[]);

		const providerPage = definitions.find((item) => 'name' in item && item.name === 'Local') as any;
		expect(providerPage.type).toBe('page');
		expect(providerPage.desc).toBe('OpenAI-compatible · 1 model');
		expect(providerPage.page).toBeTypeOf('function');
		const page = providerPage.page() as SettingPage;
		page.display();
		expect(page.containerEl.textContent).toContain('Provider name');
		expect(page.containerEl.textContent).toContain('API key');
		expect(page.containerEl.textContent).toContain('Base URL');
		expect(page.containerEl.textContent).toContain('Fetch models');
		expect(page.containerEl.textContent).toContain('Llama 3.2');
	});

	it('warns about incomplete AI setup and disables model fetching until ready', () => {
		const cloud: ProviderConfig = {
			name: 'Cloud',
			type: 'openai',
			apiKey: '',
			models: [],
		};
		const tab = createSettingsScreen(makeFakePlugin(makeFakeSettings({ providers: [cloud] })));
		const definitions = flattenDefinitions(tab.getSettingDefinitions() as SettingDefinitionItem[]);
		const aiPage = definitions.find((item) => 'type' in item && item.type === 'page' && item.name === 'AI') as any;
		const providerPage = definitions.find((item) => 'type' in item && item.type === 'page' && item.name === 'Cloud') as any;
		const page = providerPage.page() as SettingPage;
		page.display();
		const fetchButton = Array.from(page.containerEl.querySelectorAll<HTMLButtonElement>('button'))
			.find((button) => button.textContent === 'Fetch models');
		expect(aiPage.status()).toBe('warning');
		expect(providerPage.status()).toBe('warning');
		expect(fetchButton?.disabled).toBe(true);
		expect(page.containerEl.textContent).toContain('Select an API key secret');
	});

	it('persists native fallback-chain reorder and delete actions', async () => {
		const provider = makeProvider();
		provider.models?.push({
			name: 'qwen',
			displayName: 'Qwen',
			provider: provider.models[0].provider,
		});
		const settings = makeFakeSettings({
			providers: [provider],
			modelIds: ['Local:llama3.2', 'Local:qwen'],
		});
		const tab = createSettingsScreen(makeFakePlugin(settings));
		const modelList = flattenDefinitions(tab.getSettingDefinitions() as SettingDefinitionItem[])
			.find((item) => 'type' in item && item.type === 'list' && item.heading === 'Model order') as any;
		expect(modelList.items[0].action).toBeTypeOf('function');
		expect(modelList.addItem).toEqual(expect.objectContaining({
			name: OPTIONS.modelOrder.addLabel,
			action: expect.any(Function),
		}));

		modelList.onReorder(0, 1);
		await vi.waitFor(() => expect(settings.updateModelIds).toHaveBeenLastCalledWith([
			'Local:qwen',
			'Local:llama3.2',
		]));

		modelList.onDelete(0);
		await vi.waitFor(() => expect(settings.updateModelIds).toHaveBeenLastCalledWith([
			'Local:llama3.2',
		]));
	});

	it('keeps queue and release-note actions in the branded header', () => {
		const openQueueModal = vi.fn();
		const plugin = makeFakePlugin(makeFakeSettings(), openQueueModal);
		const tab = createSettingsScreen(plugin);
		const openSpy = vi.spyOn(WhatsNewModal.prototype, 'open').mockImplementation(() => undefined);
		const host = document.createElement('div');
		const hero = findDefinition(tab, 'YT Knowledge Notes');

		hero.render(new Setting(host), {} as never);
		host.querySelector<HTMLButtonElement>('[data-action-id="manage-queue"]')?.click();
		host.querySelector<HTMLButtonElement>('[data-action-id="about"]')?.click();

		expect(openQueueModal).toHaveBeenCalledOnce();
		expect(openSpy).toHaveBeenCalledOnce();
		expect(host.querySelector('.ytkn-settings__hero-title')?.textContent).toBe('YT Knowledge Notes');
		expect(host.querySelectorAll('.ytkn-brand-action')).toHaveLength(4);
		expect(host.querySelector('.ytkn-settings__hero-actions')?.parentElement)
			.toBe(host.querySelector('.ytkn-settings__hero-copy'));
		openSpy.mockRestore();
	});
});
