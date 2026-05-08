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

function makeFakeSettings() {
    return {
        getModels: vi.fn().mockReturnValue([]),
        getSelectedModel: vi.fn().mockReturnValue(null),
        getProviders: vi.fn().mockReturnValue([]),
        getOutputDefaults: vi.fn().mockReturnValue({
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

describe('SettingsTab', () => {
    it('renders the plugin name from the manifest above the intro slogan', () => {
        const plugin = {
            manifest: { name: 'YouTube Knowledge Notes' },
            settings: makeFakeSettings(),
        };
        const tab = new SettingsTab(new App(), plugin as any);

        tab.display();

        const heading = tab.containerEl.querySelector('.ytkn-settings__intro-title .setting-item-name');
        const slogan = tab.containerEl.querySelector('.ytkn-settings__intro-desc');

        expect(heading?.textContent).toBe('YouTube Knowledge Notes');
        expect(slogan?.textContent).toBe('Turn videos into structured notes with AI');
    });
});
