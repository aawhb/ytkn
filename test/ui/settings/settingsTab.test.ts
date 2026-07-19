import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../../mocks/obsidian');
	return {
		...mod,
		PluginSettingTab: class {
			containerEl = document.createElement('div');

			constructor(
				public app: unknown,
				public plugin: unknown,
			) { }
		},
		setIcon: vi.fn(),
	};
});

import { App, Setting } from 'obsidian';
import { SettingsTab } from '../../../src/ui/settings/settingsTab';
import { SUPPORT_LINKS } from '../../../src/releaseNotes';
import { WhatsNewModal } from '../../../src/ui/releaseNotes/whatsNewModal';
import { SETTING_COPY } from '../../../src/ui/shared/settingCopy';

function makeFakeSettings() {
	const instructionConfig = {
		mode: 'template',
		template: 'general',
		manualInstructions: '',
		includeMindmap: true,
		includeMemorableQuotes: true,
		controlValues: {},
	};
	const settings = {
		getModels: vi.fn().mockReturnValue([]),
		getModelIds: vi.fn().mockReturnValue([]),
		getSelectedModels: vi.fn().mockReturnValue([]),
		updateModelIds: vi.fn().mockResolvedValue(undefined),
		getProviders: vi.fn().mockReturnValue([]),
		getOutputDefaults: vi.fn().mockReturnValue({
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
			includeRunReport: true,
			runReportLocation: 'generated-note',
			useVideoTitleAsNoteName: true,
			noteDestinationMode: 'current-note',
			noteDestinationFolder: '',
			includeFrontmatter: true,
			frontmatterTags: '',
			frontmatterPropertyAllowlist: 'title channel videoUrl',
			sourceSectionPosition: 'top',
			linkTimestamps: true,
			tldrCalloutAtTop: true,
		}),
		getInstructionConfig: vi.fn(() => instructionConfig),
		getTemperature: vi.fn().mockReturnValue(0.3),
		getRequestTimeoutMs: vi.fn().mockReturnValue(300000),
		updateOutputDefaults: vi.fn().mockResolvedValue(undefined),
		updateInstructionConfig: vi.fn(async (patch) => {
			Object.assign(instructionConfig, patch);
		}),
		updateTemperature: vi.fn().mockResolvedValue(undefined),
		updateRequestTimeoutMs: vi.fn().mockResolvedValue(undefined),
	};
	return settings;
}

function makeFakePlugin(openQueueModal = vi.fn()) {
	return {
		manifest: { name: 'YT Knowledge Notes', version: '1.7.0' },
		settings: makeFakeSettings(),
		openQueueModal,
	};
}

function createSettingsTab(plugin: ReturnType<typeof makeFakePlugin>): SettingsTab {
	return new SettingsTab(
		new App(),
		plugin as any,
		plugin.settings as any,
		plugin.openQueueModal,
	);
}

type SettingsTabRenderer = { display: () => void };

function renderSettingsTab(tab: SettingsTab): void {
	(tab as SettingsTabRenderer).display();
}

describe('SettingsTab', () => {
	it('exposes searchable declarative settings definitions', () => {
		const plugin = makeFakePlugin();
		const tab = createSettingsTab(plugin);
		const [definition] = tab.getSettingDefinitions();

		expect(definition).toMatchObject({
			name: 'YT Knowledge Notes',
			aliases: expect.arrayContaining([
				'AI models',
				'Destination folder',
				'Restore defaults',
			]),
		});
		if (!definition || !('render' in definition) || !definition.render) {
			throw new Error('Expected an imperative render definition');
		}
		const host = document.createElement('div');
		definition.render(new Setting(host), {} as never);
		expect(host.textContent).toContain('YT Knowledge Notes');
		expect(host.textContent).toContain('Destination folder');
	});

	it('renders and saves default channel content selections', async () => {
		const plugin = makeFakePlugin();
		const tab = createSettingsTab(plugin);
		renderSettingsTab(tab);

		const contentRow = tab.containerEl.querySelector('.ytkn-channel-content-setting');
		expect(contentRow).toBeDefined();
		expect(contentRow?.className).toContain('ytkn-setting-row--fit-control');
		expect(contentRow?.querySelector('.setting-item-name')?.textContent).toBe('Channel');
		const shortOption = Array.from(contentRow!.querySelectorAll('.ytkn-channel-content-option')).find(
			(option) => option.textContent?.trim() === 'Shorts',
		);
		const checkbox = shortOption?.querySelector('input') as HTMLInputElement;
		checkbox.checked = false;
		checkbox.dispatchEvent(new Event('change'));

		await vi.waitFor(() => expect(plugin.settings.updateOutputDefaults).toHaveBeenCalledWith(
			expect.objectContaining({ channelContentTypes: ['videos', 'streams'] }),
		));
		const streamOption = Array.from(contentRow!.querySelectorAll('.ytkn-channel-content-option')).find(
			(option) => option.textContent?.trim() === 'Stream replays',
		);
		const streamCheckbox = streamOption?.querySelector('input') as HTMLInputElement;
		streamCheckbox.checked = false;
		streamCheckbox.dispatchEvent(new Event('change'));
		await vi.waitFor(() => expect(plugin.settings.updateOutputDefaults).toHaveBeenCalledWith(
			expect.objectContaining({ channelContentTypes: ['videos'] }),
		));
		expect(SETTING_COPY.channelItemsPerType.name).toBe('Items per selected type');
		expect(tab.containerEl.textContent).toContain('Items per selected type');
	});

	it('hides the channel item count when the default is All available', async () => {
		const plugin = makeFakePlugin();
		const defaults = plugin.settings.getOutputDefaults();
		plugin.settings.getOutputDefaults.mockReturnValue({
			...defaults,
			channelVideoLimit: null,
		});
		const tab = createSettingsTab(plugin);
		renderSettingsTab(tab);

		const limitRow = Array.from(tab.containerEl.querySelectorAll('.setting-item')).find(
			(row) => row.querySelector('.setting-item-name')?.textContent === SETTING_COPY.channelItemsPerType.name,
		);
		const limitSelect = limitRow?.querySelector('select') as HTMLSelectElement;
		const limitInput = limitRow?.querySelector('input[type="number"]') as HTMLInputElement;
		expect(limitSelect.value).toBe('all');
		expect(limitInput.hidden).toBe(true);

		limitSelect.value = 'limited';
		limitSelect.dispatchEvent(new Event('change'));
		expect(limitInput.hidden).toBe(false);
		await vi.waitFor(() => expect(plugin.settings.updateOutputDefaults).toHaveBeenCalledWith(
			expect.objectContaining({ channelVideoLimit: 10 }),
		));

		limitSelect.value = 'all';
		limitSelect.dispatchEvent(new Event('change'));
		expect(limitInput.hidden).toBe(true);
		await vi.waitFor(() => expect(plugin.settings.updateOutputDefaults).toHaveBeenCalledWith(
			expect.objectContaining({ channelVideoLimit: null }),
		));
	});

	it('renders the plugin title and current settings sections', () => {
		const plugin = makeFakePlugin();
		const tab = createSettingsTab(plugin);

		renderSettingsTab(tab);

		const heading = tab.containerEl.querySelector('.ytkn-settings__intro-title .setting-item-name');
		const semanticTabs = Array.from(tab.containerEl.querySelectorAll('[role="tab"]'));

		expect(heading?.textContent).toBe('YT Knowledge Notes');
		expect(semanticTabs.map((tabEl) => tabEl.textContent)).toEqual(['General', 'AI']);
	});

	it('shows the open-created-note toggle below the destination folder only for folder output', async () => {
		const currentNotePlugin = makeFakePlugin();
		const currentNoteTab = createSettingsTab(currentNotePlugin);
		renderSettingsTab(currentNoteTab);
		const currentNoteNames = Array.from(currentNoteTab.containerEl.querySelectorAll('.setting-item'))
			.map((el) => el.querySelector('.setting-item-name')?.textContent);
		expect(currentNoteNames).not.toContain('Open created note');

		const folderPlugin = makeFakePlugin();
		const baseDefaults = folderPlugin.settings.getOutputDefaults();
		folderPlugin.settings.getOutputDefaults = vi.fn().mockReturnValue({
			...baseDefaults,
			noteDestinationMode: 'folder',
			noteDestinationFolder: 'Notes',
			openCreatedNote: false,
		});
		const folderTab = createSettingsTab(folderPlugin);
		renderSettingsTab(folderTab);
		const rows = Array.from(folderTab.containerEl.querySelectorAll('.setting-item'));
		const names = rows.map((el) => el.querySelector('.setting-item-name')?.textContent);
		const folderIndex = names.indexOf('Destination folder');
		const toggleIndex = names.indexOf('Open created note');
		expect(folderIndex).toBeGreaterThan(-1);
		expect(toggleIndex).toBe(folderIndex + 1);

		const checkbox = rows[toggleIndex].querySelector('input[type="checkbox"]') as HTMLInputElement;
		checkbox.checked = true;
		checkbox.dispatchEvent(new Event('change'));
		await Promise.resolve();
		expect(folderPlugin.settings.updateOutputDefaults).toHaveBeenCalledWith(
			expect.objectContaining({ openCreatedNote: true }),
		);
	});

	it('renders the default content template subtitle inside its setting row', () => {
		const plugin = makeFakePlugin();
		const tab = createSettingsTab(plugin);

		renderSettingsTab(tab);

		const templateRow = Array.from(tab.containerEl.querySelectorAll('.setting-item'))
			.find((row) => row.querySelector('.setting-item-name')?.textContent === SETTING_COPY.contentTemplate.name);
		const description = templateRow?.querySelector('.setting-item-description.ytkn-settings__template-description');

		expect(templateRow).not.toBeUndefined();
		expect(description?.textContent).toBe('Balanced summary, takeaways, where it applies, and limits. Best default.');
	});

	it('renders a note-structure preview reflecting the section toggles', () => {
		const plugin = makeFakePlugin();
		const tab = createSettingsTab(plugin);

		renderSettingsTab(tab);

		const preview = tab.containerEl.querySelector('.ytkn-settings__template-preview');
		expect(preview).not.toBeNull();
		const text = preview?.textContent ?? '';
		expect(text).toContain('TL;DR');
		expect(text).toContain('Key takeaways');
		expect(text).toContain('When this applies');
		expect(text).toContain('Limits and pushback');
		expect(text).toContain('Evidence');
		expect(text).toContain('Mindmap');
		expect(text).toContain('Memorable quotes');
	});

	it('keeps earlier instruction changes when another control changes', async () => {
		const plugin = makeFakePlugin();
		const config = plugin.settings.getInstructionConfig();
		config.includeMindmap = true;
		config.includeMemorableQuotes = false;
		const tab = createSettingsTab(plugin);
		renderSettingsTab(tab);

		const findToggle = (name: string): HTMLInputElement => {
			const row = Array.from(tab.containerEl.querySelectorAll('.setting-item'))
				.find((item) => item.querySelector('.setting-item-name')?.textContent === name);
			const toggle = row?.querySelector<HTMLInputElement>('input[type="checkbox"]');
			if (!toggle) throw new Error(`Missing toggle: ${name}`);
			return toggle;
		};

		const mindmap = findToggle(SETTING_COPY.mindmap.name);
		mindmap.checked = false;
		mindmap.dispatchEvent(new Event('change'));

		const quotes = findToggle(SETTING_COPY.memorableQuotes.name);
		quotes.checked = true;
		quotes.dispatchEvent(new Event('change'));

		await vi.waitFor(() => {
			expect(plugin.settings.getInstructionConfig()).toMatchObject({
				includeMindmap: false,
				includeMemorableQuotes: true,
			});
		});
	});

	it('renders icon-only brand actions with support links', () => {
		const plugin = makeFakePlugin();
		const tab = createSettingsTab(plugin);

		renderSettingsTab(tab);

		const actionGroup = tab.containerEl.querySelector('.ytkn-brand-actions');
		const actions = Array.from(actionGroup?.querySelectorAll('.ytkn-brand-action') ?? []);
		expect(actions.map((action) => action.getAttribute('aria-label'))).toEqual([
			'Manage queue',
			'Sponsor',
			'Buy Me a Coffee',
			'About YT Knowledge Notes',
		]);
		expect(actions.map((action) => action.textContent)).toEqual(['', '', '', '']);
		expect(actions[1].getAttribute('href')).toBe(SUPPORT_LINKS.githubSponsors);
		expect(actions[2].getAttribute('href')).toBe(SUPPORT_LINKS.buyMeACoffee);
		expect(actions[0].tagName).toBe('BUTTON');
		expect(actions[1].tagName).toBe('A');
		expect(actions[3].tagName).toBe('BUTTON');
	});

	it('opens queue management from the Manage queue utility action', () => {
		const openQueueModal = vi.fn();
		const plugin = makeFakePlugin(openQueueModal);
		const tab = createSettingsTab(plugin);

		renderSettingsTab(tab);

		const queueButton = Array.from(tab.containerEl.querySelectorAll('.ytkn-brand-action'))
			.find((button) => button.getAttribute('aria-label') === 'Manage queue') as HTMLButtonElement | undefined;
		queueButton?.click();

		expect(queueButton).toBeTruthy();
		expect(openQueueModal).toHaveBeenCalledTimes(1);
	});

	it('opens release notes from the About utility action', () => {
		const openSpy = vi.spyOn(WhatsNewModal.prototype, 'open').mockImplementation(() => undefined);
		const plugin = makeFakePlugin();
		const tab = createSettingsTab(plugin);

		renderSettingsTab(tab);

		const releaseNotesButton = Array.from(tab.containerEl.querySelectorAll('.ytkn-brand-action'))
			.find((button) => button.getAttribute('aria-label') === 'About YT Knowledge Notes') as HTMLButtonElement | undefined;
		releaseNotesButton?.click();

		expect(releaseNotesButton).toBeTruthy();
		expect(openSpy).toHaveBeenCalledTimes(1);
		openSpy.mockRestore();
	});
});
