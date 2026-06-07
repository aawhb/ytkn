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

import { App } from 'obsidian';
import { SettingsTab } from '../../../src/ui/settings/settingsTab';
import { SUPPORT_LINKS } from '../../../src/releaseNotes';
import { WhatsNewModal } from '../../../src/ui/releaseNotes/whatsNewModal';
import { SETTING_COPY } from '../../../src/ui/shared/settingCopy';

function makeFakeSettings() {
    return {
        getModels: vi.fn().mockReturnValue([]),
        getSelectedModel: vi.fn().mockReturnValue(null),
        getProviders: vi.fn().mockReturnValue([]),
        getOutputDefaults: vi.fn().mockReturnValue({
            useAi: true,
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
            includeFrontmatter: true,
            frontmatterTags: '',
            frontmatterPropertyAllowlist: 'title channel videoUrl',
            sourceSectionPosition: 'top',
            linkTimestamps: true,
            tldrCalloutAtTop: true,
        }),
        getInstructionConfig: vi.fn().mockReturnValue({
            mode: 'template',
            template: 'general',
            manualInstructions: '',
            includeMindmap: true,
            includeMemorableQuotes: true,
            controlValues: {},
        }),
        getTemperature: vi.fn().mockReturnValue(0.3),
        getRequestTimeoutMs: vi.fn().mockReturnValue(300000),
        updateOutputDefaults: vi.fn().mockResolvedValue(undefined),
        updateInstructionConfig: vi.fn().mockResolvedValue(undefined),
        updateTemperature: vi.fn().mockResolvedValue(undefined),
        updateRequestTimeoutMs: vi.fn().mockResolvedValue(undefined),
    };
}

function makeFakePlugin(openQueueModal = vi.fn()) {
    return {
        manifest: { name: 'YT Knowledge Notes', version: '1.7.0' },
        settings: makeFakeSettings(),
        openQueueModal,
    };
}

type LegacySettingsTabRenderer = { display: () => void };

function renderSettingsTab(tab: SettingsTab): void {
    (tab as LegacySettingsTabRenderer).display();
}

describe('SettingsTab', () => {
    it('renders the plugin title and current settings sections', () => {
        const plugin = makeFakePlugin();
        const tab = new SettingsTab(new App(), plugin as any);

        renderSettingsTab(tab);

        const heading = tab.containerEl.querySelector('.ytkn-settings__intro-title .setting-item-name');
        const semanticTabs = Array.from(tab.containerEl.querySelectorAll('[role="tab"]'));

        expect(heading?.textContent).toBe('YT Knowledge Notes');
        expect(semanticTabs.map((tabEl) => tabEl.textContent)).toEqual(['General', 'GenAI']);
    });

    it('renders the default content template subtitle inside its setting row', () => {
        const plugin = makeFakePlugin();
        const tab = new SettingsTab(new App(), plugin as any);

        renderSettingsTab(tab);

        const templateRow = Array.from(tab.containerEl.querySelectorAll('.setting-item'))
            .find((row) => row.querySelector('.setting-item-name')?.textContent === SETTING_COPY.contentTemplate.name);
        const description = templateRow?.querySelector('.setting-item-description.ytkn-settings__template-description');

        expect(templateRow).not.toBeUndefined();
        expect(description?.textContent).toBe('Balanced summary, takeaways, where it applies, and limits. Best default.');
        expect(tab.containerEl.querySelector('p.ytkn-settings__template-description')).toBeNull();
    });

    it('renders icon-only brand actions with support links', () => {
        const plugin = makeFakePlugin();
        const tab = new SettingsTab(new App(), plugin as any);

        renderSettingsTab(tab);

        const actionGroup = tab.containerEl.querySelector('.ytkn-brand-actions');
        const actions = Array.from(actionGroup?.querySelectorAll('.ytkn-brand-action') ?? []);
        expect(actions.map((action) => action.getAttribute('aria-label'))).toEqual([
            'Manage queue',
            'Sponsor',
            'Buy Me a Coffee',
            'Recent updates',
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
        const tab = new SettingsTab(new App(), plugin as any);

        renderSettingsTab(tab);

        const queueButton = Array.from(tab.containerEl.querySelectorAll('.ytkn-brand-action'))
            .find((button) => button.getAttribute('aria-label') === 'Manage queue') as HTMLButtonElement | undefined;
        queueButton?.click();

        expect(queueButton).toBeTruthy();
        expect(openQueueModal).toHaveBeenCalledTimes(1);
    });

    it('opens release notes from the Recent updates utility action', () => {
        const openSpy = vi.spyOn(WhatsNewModal.prototype, 'open').mockImplementation(() => undefined);
        const plugin = makeFakePlugin();
        const tab = new SettingsTab(new App(), plugin as any);

        renderSettingsTab(tab);

        const releaseNotesButton = Array.from(tab.containerEl.querySelectorAll('.ytkn-brand-action'))
            .find((button) => button.getAttribute('aria-label') === 'Recent updates') as HTMLButtonElement | undefined;
        releaseNotesButton?.click();

        expect(releaseNotesButton).toBeTruthy();
        expect(openSpy).toHaveBeenCalledTimes(1);
        openSpy.mockRestore();
    });
});
