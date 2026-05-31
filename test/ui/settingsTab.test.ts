import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
    const mod = await import('../mocks/obsidian');
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
import { SettingsTab } from '../../src/ui/settings';
import { SUPPORT_LINKS } from '../../src/releaseNotes';
import { WhatsNewModal } from '../../src/ui/modals/WhatsNewModal';
import { SETTING_COPY } from '../../src/ui/settingCopy';

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

describe('SettingsTab', () => {
    it('renders the plugin name without the old intro slogan', () => {
        const plugin = makeFakePlugin();
        const tab = new SettingsTab(new App(), plugin as any);

        tab.display();

        const heading = tab.containerEl.querySelector('.ytkn-settings__intro-title .setting-item-name');

        expect(heading?.textContent).toBe('YT Knowledge Notes');
        expect(heading?.classList.contains('ytkn-brand-title')).toBe(true);
        expect(tab.containerEl.querySelector('.ytkn-settings__intro-desc')).toBeNull();
    });

    it('renders settings branding with shared layout classes and stable DOM order', () => {
        const plugin = makeFakePlugin();
        const tab = new SettingsTab(new App(), plugin as any);

        tab.display();

        const header = tab.containerEl.querySelector('.ytkn-settings__intro-header');
        const brandMark = header?.children.item(0);
        const copy = header?.children.item(1);

        expect(header?.classList.contains('ytkn-brand-header')).toBe(true);
        expect(header?.classList.contains('ytkn-brand-header--settings')).toBe(true);
        expect(brandMark?.classList.contains('ytkn-brand-mark')).toBe(true);
        expect(copy?.classList.contains('ytkn-brand-copy')).toBe(true);
        expect(copy?.classList.contains('ytkn-brand-copy--settings')).toBe(true);
        expect(copy?.children.item(0)?.classList.contains('ytkn-brand-title-row')).toBe(true);
        expect(copy?.children.item(1)?.classList.contains('ytkn-brand-actions')).toBe(true);
    });

    it('stamps settings select and button rows with explicit layout classes', () => {
        const plugin = makeFakePlugin();
        const tab = new SettingsTab(new App(), plugin as any);

        tab.display();

        const selectRow = tab.containerEl.querySelector('select')?.closest('.setting-item');
        const restoreButton = Array.from(tab.containerEl.querySelectorAll('button'))
            .find((button) => button.textContent === 'Restore defaults');

        expect(selectRow?.classList.contains('ytkn-setting-row--select')).toBe(true);
        expect(selectRow?.classList.contains('ytkn-setting-row--fit-control')).toBe(true);
        expect(restoreButton?.closest('.setting-item')?.classList.contains('ytkn-setting-row--button')).toBe(true);
        expect(restoreButton?.closest('.setting-item')?.classList.contains('ytkn-setting-row--fit-control')).toBe(true);
    });

    it('renders settings cards with generic card classes and legacy hooks', () => {
        const plugin = makeFakePlugin();
        const tab = new SettingsTab(new App(), plugin as any);

        tab.display();

        const card = tab.containerEl.querySelector('.ytkn-card.ytkn-settings__group');
        const title = card?.querySelector('.ytkn-card__title.ytkn-settings__group-title');
        const body = card?.querySelector('.ytkn-card__body.ytkn-settings__group-cards');

        expect(card).not.toBeNull();
        expect(title).not.toBeNull();
        expect(body).not.toBeNull();
    });

    it('renders the default content template subtitle inside its setting row', () => {
        const plugin = makeFakePlugin();
        const tab = new SettingsTab(new App(), plugin as any);

        tab.display();

        const templateRow = Array.from(tab.containerEl.querySelectorAll('.setting-item'))
            .find((row) => row.querySelector('.setting-item-name')?.textContent === SETTING_COPY.contentTemplate.name);
        const description = templateRow?.querySelector('.setting-item-description.ytkn-settings__template-description');

        expect(templateRow).not.toBeUndefined();
        expect(description?.textContent).toBe('Balanced summary, takeaways, where it applies, and limits. Best default.');
        expect(tab.containerEl.querySelector('p.ytkn-settings__template-description')).toBeNull();
    });

    it('renders only General and GenAI as semantic settings tabs', () => {
        const plugin = makeFakePlugin();
        const tab = new SettingsTab(new App(), plugin as any);

        tab.display();

        const semanticTabs = Array.from(tab.containerEl.querySelectorAll('[role="tab"]'));
        expect(semanticTabs.map((tabEl) => tabEl.textContent)).toEqual(['General', 'GenAI']);
        expect(tab.containerEl.querySelector('.ytkn-tabs-actions')).toBeNull();
    });

    it('renders icon-only brand actions with support links', () => {
        const plugin = makeFakePlugin();
        const tab = new SettingsTab(new App(), plugin as any);

        tab.display();

        const actionGroup = tab.containerEl.querySelector('.ytkn-brand-actions');
        const actions = Array.from(actionGroup?.querySelectorAll('.ytkn-brand-action') ?? []);
        expect(actions.map((action) => action.getAttribute('aria-label'))).toEqual([
            'Manage queue',
            'Sponsor',
            'Buy Me a Coffee',
            'Recent updates',
        ]);
        expect(actions.map((action) => action.textContent)).toEqual(['', '', '', '']);
        expect(actions.map((action) => action.querySelector('.ytkn-brand-action__icon')?.getAttribute('data-icon'))).toEqual([
            'list-todo',
            'heart-handshake',
            'coffee',
            'history',
        ]);
        expect(actions[1].getAttribute('href')).toBe(SUPPORT_LINKS.githubSponsors);
        expect(actions[2].getAttribute('href')).toBe(SUPPORT_LINKS.buyMeACoffee);
        expect(actions[0].tagName).toBe('BUTTON');
        expect(actions[0].classList.contains('ytkn-brand-action--button')).toBe(true);
        expect(actions[0].classList.contains('ytkn-brand-action--utility')).toBe(true);
        expect(actions[1].tagName).toBe('A');
        expect(actions[1].classList.contains('ytkn-brand-action--link')).toBe(true);
        expect(actions[2].classList.contains('ytkn-brand-action--link')).toBe(true);
        expect(actions[3].tagName).toBe('BUTTON');
        expect(actions[3].classList.contains('ytkn-brand-action--button')).toBe(true);
        expect(actions[3].classList.contains('ytkn-brand-action--utility')).toBe(true);
        expect(actions[3].getAttribute('role')).toBeNull();
        expect(actions[3].classList.contains('is-active')).toBe(false);
    });

    it('opens queue management from the Manage queue utility action', () => {
        const openQueueModal = vi.fn();
        const plugin = makeFakePlugin(openQueueModal);
        const tab = new SettingsTab(new App(), plugin as any);

        tab.display();

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

        tab.display();

        const releaseNotesButton = Array.from(tab.containerEl.querySelectorAll('.ytkn-brand-action'))
            .find((button) => button.getAttribute('aria-label') === 'Recent updates') as HTMLButtonElement | undefined;
        releaseNotesButton?.click();

        expect(releaseNotesButton).toBeTruthy();
        expect(openSpy).toHaveBeenCalledTimes(1);
        openSpy.mockRestore();
    });
});
