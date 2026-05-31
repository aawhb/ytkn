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
import { SETTING_COPY, type SettingCopyKey } from '../../src/ui/settingCopy';
import { SettingsTab } from '../../src/ui/settings';
import { GenerationOptionsModal } from '../../src/ui/modals/GenerationOptionsModal';
import type { GenerationOptions, ModelConfig } from '../../src/types';

const REQUIRED_COPY_KEYS: SettingCopyKey[] = [
    'aiModel',
    'useAi',
    'aiSummary',
    'instructionStyle',
    'contentTemplate',
    'manualInstructions',
    'tldrCallout',
    'mindmap',
    'memorableQuotes',
    'mediaEmbed',
    'useVideoTitleAsNoteName',
    'includeFrontmatter',
    'frontmatterTags',
    'frontmatterProperties',
    'sourceMetadataPosition',
    'outputDestination',
    'destinationFolder',
    'transcriptInNote',
    'linkTimestamps',
    'transcriptLanguage',
    'preferredLanguageCode',
    'playlistHandling',
    'transcriptFailure',
    'includeRunReport',
    'runReportLocation',
    'temperature',
    'requestTimeout',
];

const sampleModel: ModelConfig = {
    name: 'gpt-4',
    displayName: 'GPT-4',
    provider: { name: 'OpenAI', type: 'openai', apiKey: 'key' },
};

function makeFakeSettings() {
    return {
        getModels: vi.fn().mockReturnValue([sampleModel]),
        getSelectedModel: vi.fn().mockReturnValue(sampleModel),
        getProviders: vi.fn().mockReturnValue([]),
        getOutputDefaults: vi.fn().mockReturnValue({
            useAi: true,
            generateAiSummary: true,
            transcriptMode: 'readable',
            playlistMode: 'per-video',
            transcriptLanguageMode: 'preferred',
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

function makeFakePlugin() {
    return {
        manifest: { name: 'YT Knowledge Notes', version: '1.7.0' },
        settings: makeFakeSettings(),
        openQueueModal: vi.fn(),
    };
}

type LegacySettingsTabRenderer = { display: () => void };

function renderSettingsTab(tab: SettingsTab): void {
    (tab as LegacySettingsTabRenderer).display();
}

function settingRows(root: HTMLElement, label: string): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>('.setting-item')).filter(
        (row) => row.querySelector('.setting-item-name')?.textContent === label,
    );
}

function settingRow(root: HTMLElement, label: string): HTMLElement {
    const row = settingRows(root, label)[0];
    expect(row).toBeTruthy();
    return row;
}

function description(row: HTMLElement): string | null | undefined {
    return row.querySelector('.setting-item-description')?.textContent;
}

function selectLabels(row: HTMLElement): string[] {
    return Array.from(row.querySelectorAll('option')).map((option) => option.textContent ?? '');
}

function placeholder(row: HTMLElement): string | null | undefined {
    return row.querySelector('input, textarea')?.getAttribute('placeholder');
}

function visibleText(root: HTMLElement): string {
    return root.textContent ?? '';
}

describe('shared setting copy', () => {
    it('keeps one typed metadata entry for each shared settings/modal field', () => {
        expect(Object.keys(SETTING_COPY).sort()).toEqual([...REQUIRED_COPY_KEYS].sort());
        expect(SETTING_COPY.outputDestination.options).toEqual({
            'current-note': 'Current note',
            'append-to-active-note': 'Append to active note',
            folder: 'Folder',
        });
        expect(SETTING_COPY.instructionStyle.options).toEqual({
            template: 'Built-in template',
            manual: 'Manual instructions',
        });
        expect(SETTING_COPY.preferredLanguageCode.placeholder).toBe('en');
    });

    it('renders canonical copy in the settings tab', () => {
        const plugin = makeFakePlugin();
        const tab = new SettingsTab(new App(), plugin as any);

        renderSettingsTab(tab);

        const destinationRow = settingRow(tab.containerEl, SETTING_COPY.outputDestination.name);
        expect(description(destinationRow)).toBe(SETTING_COPY.outputDestination.desc);
        expect(selectLabels(destinationRow)).toEqual(Object.values(SETTING_COPY.outputDestination.options!));

        const templateRow = settingRow(tab.containerEl, SETTING_COPY.contentTemplate.name);
        expect(description(templateRow)).toBe('Balanced summary, takeaways, where it applies, and limits. Best default.');

        expect(description(settingRow(tab.containerEl, SETTING_COPY.aiSummary.name))).toBe(SETTING_COPY.aiSummary.desc);
        expect(description(settingRow(tab.containerEl, SETTING_COPY.tldrCallout.name))).toBe(SETTING_COPY.tldrCallout.desc);
        expect(placeholder(settingRow(tab.containerEl, SETTING_COPY.preferredLanguageCode.name))).toBe(SETTING_COPY.preferredLanguageCode.placeholder);
        expect(placeholder(settingRow(tab.containerEl, SETTING_COPY.destinationFolder.name))).toBe(SETTING_COPY.destinationFolder.placeholder);

        const text = visibleText(tab.containerEl);
        expect(text).not.toContain('Default destination');
        expect(text).not.toContain('Folder for new notes');
        expect(text).not.toContain('Generate AI summary');
        expect(text).not.toContain('Default content template');
        expect(text).not.toContain('Add tl;dr/summary callout');
    });

    it('renders canonical copy in the generation options modal', () => {
        const modal = new GenerationOptionsModal(
            new App(),
            '',
            [sampleModel],
            {
                useAi: true,
                generateAiSummary: true,
                transcriptLanguageMode: 'preferred',
                includeRunReport: true,
            } satisfies GenerationOptions,
            vi.fn(),
        );

        modal.open();

        const destinationRow = settingRow(modal.contentEl, SETTING_COPY.outputDestination.name);
        expect(selectLabels(destinationRow)).toEqual(Object.values(SETTING_COPY.outputDestination.options!));

        const playlistRow = settingRow(modal.contentEl, SETTING_COPY.playlistHandling.name);
        expect(selectLabels(playlistRow)).toEqual(Object.values(SETTING_COPY.playlistHandling.options!));

        const instructionRow = settingRow(modal.contentEl, SETTING_COPY.instructionStyle.name);
        expect(selectLabels(instructionRow)).toEqual(Object.values(SETTING_COPY.instructionStyle.options!));

        expect(settingRows(modal.contentEl, SETTING_COPY.transcriptInNote.name)).toHaveLength(2);
        expect(placeholder(settingRow(modal.contentEl, SETTING_COPY.destinationFolder.name))).toBe(SETTING_COPY.destinationFolder.placeholder);
        expect(placeholder(settingRow(modal.contentEl, SETTING_COPY.preferredLanguageCode.name))).toBe(SETTING_COPY.preferredLanguageCode.placeholder);

        const text = visibleText(modal.contentEl);
        expect(text).not.toContain('Manual prompt');
        expect(text).not.toContain('Insert at caret');
        expect(text).not.toContain('Create new note');
        expect(text).not.toContain('Individual notes (per video)');
        expect(text).not.toContain('Combined note (all videos)');
    });
});
