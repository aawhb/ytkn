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
		setIcon: vi.fn(),
	};
});

import { App } from 'obsidian';
import {
	GENERATION_OPTIONS_SCHEMA as OPTIONS,
	optionFromStoredValue,
	optionIsVisible,
	optionToStoredValue,
} from '../../../src/ui/shared/generationOptionsSchema';
import { SettingsScreen } from '../../../src/ui/settings/settingsScreen';
import { GenerationOptionsModal } from '../../../src/ui/generation/generationOptionsModal';
import type { GenerationOptions, ModelConfig } from '../../../src/types';

const REQUIRED_SCHEMA_KEYS: Array<keyof typeof OPTIONS> = [
	'modelOrder',
	'useAi',
	'aiSummary',
	'instructionStyle',
	'contentTemplate',
	'manualInstructions',
	'additionalSections',
	'noteStructurePreview',
	'mediaEmbed',
	'useVideoTitleAsNoteName',
	'includeFrontmatter',
	'frontmatterTags',
	'frontmatterProperties',
	'sourceMetadataPosition',
	'outputDestination',
	'destinationFolder',
	'openCreatedNote',
	'transcriptInNote',
	'linkTimestamps',
	'transcriptLanguage',
	'preferredLanguageCode',
	'playlistHandling',
	'channelContent',
	'channelItemsPerType',
	'channelItemLimit',
	'transcriptFailure',
	'includeReport',
	'reportLocation',
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
		getModelIds: vi.fn().mockReturnValue(['OpenAI:gpt-4']),
		getSelectedModels: vi.fn().mockReturnValue([sampleModel]),
		updateModelIds: vi.fn().mockResolvedValue(undefined),
		getProviders: vi.fn().mockReturnValue([]),
		getOutputDefaults: vi.fn().mockReturnValue({
			useAi: true,
			generateAiSummary: true,
			transcriptMode: 'readable',
			playlistMode: 'per-video',
			channelContentTypes: ['videos', 'shorts', 'streams'],
			channelVideoLimit: 10,
			transcriptLanguageMode: 'preferred',
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
			frontmatterProperties: [
				{ key: 'title', enabled: true },
				{ key: 'channel', enabled: true },
				{ key: 'videoUrl', enabled: true },
			],
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
		resetGeneralDefaults: vi.fn().mockResolvedValue(undefined),
		resetAiDefaults: vi.fn().mockResolvedValue(undefined),
		resetAllSettings: vi.fn().mockResolvedValue(undefined),
	};
}

function makeFakePlugin() {
	return {
		manifest: { name: 'YT Knowledge Notes', version: '1.7.0' },
		settings: makeFakeSettings(),
		openQueueModal: vi.fn(),
	};
}

interface CopyDefinition {
	name?: string;
	desc?: string | DocumentFragment;
	control?: {
		options?: Record<string, string>;
		placeholder?: string;
	};
	items?: CopyDefinition[];
}

function findDefinition(tab: SettingsScreen, label: string): CopyDefinition {
	const pending = [...tab.getSettingDefinitions()] as CopyDefinition[];
	while (pending.length > 0) {
		const definition = pending.shift();
		if (!definition) {
			continue;
		}
		if (definition.name === label) {
			return definition;
		}
		pending.push(...(definition.items ?? []));
	}
	throw new Error(`Missing setting definition: ${label}`);
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

function selectLabels(row: HTMLElement): string[] {
	return Array.from(row.querySelectorAll('option')).map((option) => option.textContent ?? '');
}

function placeholder(row: HTMLElement): string | null | undefined {
	return row.querySelector('input, textarea')?.getAttribute('placeholder');
}

describe('shared generation options schema', () => {
	it('keeps one typed metadata entry for each shared settings/modal field', () => {
		expect(Object.keys(OPTIONS).sort()).toEqual([...REQUIRED_SCHEMA_KEYS].sort());
		expect(OPTIONS.outputDestination.options).toEqual({
			'current-note': 'Current note',
			'append-to-active-note': 'Append to active note',
			folder: 'Folder',
		});
		expect(OPTIONS.instructionStyle.options).toEqual({
			template: 'Built-in template',
			manual: 'Custom instructions',
		});
		expect(OPTIONS.additionalSections.controlType).toBe('checkbox-group');
		expect(OPTIONS.channelContent.controlType).toBe('checkbox-group');
		expect(OPTIONS.preferredLanguageCode.placeholder).toBe('en');
		expect(optionFromStoredValue('requestTimeout', 45000)).toBe(45);
		expect(optionToStoredValue('requestTimeout', 45)).toBe(45000);
		expect(optionIsVisible('openCreatedNote', {
			useAi: true,
			generateAiSummary: true,
			instructionMode: 'template',
			noteDestinationMode: 'folder',
			includeFrontmatter: true,
			transcriptMode: 'timestamped',
			transcriptLanguageMode: 'auto',
			channelVideoLimit: 10,
			includeReport: true,
		})).toBe(true);
	});

	it('renders canonical copy in settings', () => {
		const plugin = makeFakePlugin();
		const tab = new SettingsScreen(
			new App(),
			plugin as any,
			plugin.settings as any,
			plugin.openQueueModal,
		);

		const destination = findDefinition(tab, OPTIONS.outputDestination.name);
		expect(destination.desc).toBe(OPTIONS.outputDestination.desc);
		expect(destination.control?.options).toEqual(OPTIONS.outputDestination.options);

		const template = findDefinition(tab, OPTIONS.contentTemplate.name);
		expect(template.desc).toBe('Balanced summary, takeaways, where it applies, and limits. Best default.');

		expect(findDefinition(tab, OPTIONS.aiSummary.name).desc).toBe(OPTIONS.aiSummary.desc);
		expect(findDefinition(tab, OPTIONS.additionalSections.name).desc)
			.toBe(OPTIONS.additionalSections.desc);
		expect(findDefinition(tab, OPTIONS.preferredLanguageCode.name).control?.placeholder)
			.toBe(OPTIONS.preferredLanguageCode.placeholder);
		expect(findDefinition(tab, OPTIONS.destinationFolder.name).control?.placeholder)
			.toBe(OPTIONS.destinationFolder.placeholder);
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
				includeReport: true,
			} satisfies GenerationOptions,
			vi.fn(),
		);

		modal.open();

		const destinationRow = settingRow(modal.contentEl, OPTIONS.outputDestination.name);
		expect(selectLabels(destinationRow)).toEqual(Object.values(OPTIONS.outputDestination.options));

		const playlistRow = settingRow(modal.contentEl, OPTIONS.playlistHandling.name);
		expect(selectLabels(playlistRow)).toEqual(Object.values(OPTIONS.playlistHandling.options));

		const instructionRow = settingRow(modal.contentEl, OPTIONS.instructionStyle.name);
		expect(selectLabels(instructionRow)).toEqual(Object.values(OPTIONS.instructionStyle.options));

		expect(settingRows(modal.contentEl, OPTIONS.transcriptInNote.name)).toHaveLength(2);
		expect(placeholder(settingRow(modal.contentEl, OPTIONS.destinationFolder.name))).toBe(OPTIONS.destinationFolder.placeholder);
		expect(placeholder(settingRow(modal.contentEl, OPTIONS.preferredLanguageCode.name))).toBe(OPTIONS.preferredLanguageCode.placeholder);
	});
});
