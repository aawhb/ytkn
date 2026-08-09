import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../../mocks/obsidian');
	return mod;
});

import { GenerationOptionsModal } from '../../../src/ui/generation/generationOptionsModal';
import { WhatsNewModal } from '../../../src/ui/releaseNotes/whatsNewModal';
import { SUPPORT_LINKS } from '../../../src/releaseNotes';
import { GENERATION_OPTIONS_SCHEMA as OPTIONS } from '../../../src/ui/shared/generationOptionsSchema';
import { ModelPickerModal } from '../../../src/ui/shared/modelPickerModal';
import type { ModelConfig, GenerationOptions } from '../../../src/types';
import { App, Platform } from 'obsidian';

const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PLtest12345';
const CHANNEL_URL = 'https://www.youtube.com/@channel';
const INVALID_URL = 'https://example.com/not-youtube';

const sampleModel: ModelConfig = {
	name: 'gpt-4',
	displayName: 'GPT-4',
	provider: { name: 'OpenAI', type: 'openai', apiKey: 'key' },
};

const fallbackModel: ModelConfig = {
	name: 'gemini-2.5-flash',
	displayName: 'Gemini 2.5 Flash',
	provider: { name: 'Gemini', type: 'gemini', apiKey: 'key' },
};

const defaultOptions: GenerationOptions = {};
type SubmitHandler = (urls: string[], options: GenerationOptions) => void;

function findSetting(root: ParentNode, name: string): HTMLElement | undefined {
	return Array.from(root.querySelectorAll<HTMLElement>('.setting-item'))
		.find((setting) => setting.querySelector('.setting-item-name')?.textContent === name);
}

function findSettingGroup(root: ParentNode, heading: string): HTMLElement | undefined {
	return Array.from(root.querySelectorAll<HTMLElement>('.ytkn-settings__section-card'))
		.find((group) => group.querySelector('.setting-item-heading')?.textContent === heading);
}

function findAdditionalSectionsSetting(root: ParentNode): HTMLElement | undefined {
	return Array.from(root.querySelectorAll<HTMLElement>('.setting-item')).find((setting) => {
		const labels = Array.from(setting.querySelectorAll<HTMLElement>('.ytkn-checkbox-group-option'))
			.map((option) => option.textContent?.trim());
		return labels.join('|') === 'TL;DR|Mind Map|Memorable Quotes';
	});
}

describe('GenerationOptionsModal', () => {
	let app: App;
	let onSubmit: ReturnType<typeof vi.fn<SubmitHandler>>;

	beforeEach(() => {
		app = new App();
		onSubmit = vi.fn<SubmitHandler>();
		Platform.isPhone = false;
	});

	it('renders the "Advanced settings" h3 heading', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const headings = Array.from(modal.contentEl.querySelectorAll('h3'));
		const advancedHeading = headings.find((h) => h.textContent === 'Advanced settings');
		expect(advancedHeading).not.toBeUndefined();
	});

	it('uses the full product name in the modal header on every device size', () => {
		Platform.isPhone = true;
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);

		modal.open();

		const title = modal.contentEl.querySelector('.ytkn-modal__title');
		expect(title?.textContent).toBe('YT Knowledge Notes');
		expect(title?.hasAttribute('data-mobile-title')).toBe(false);
	});

	it('marks the default tab and panel as active', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const activeTab = modal.contentEl.querySelector('[role="tab"][aria-selected="true"]');
		const activePanel = modal.contentEl.querySelector('[role="tabpanel"]:not([hidden])');

		expect(activeTab?.textContent?.trim()).toBe('General');
		expect(activePanel?.getAttribute('aria-labelledby')).toBe('ytkn-tab-general');
	});

	it('renders Generate as the only generation modal action', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const actionButtons = Array.from(
			modal.contentEl.querySelectorAll('.ytkn-modal__actions button'),
		);
		const actionLabels = actionButtons.map((button) => button.textContent);

		expect(actionLabels).toEqual(['Generate']);
	});

	it('renders icon-only brand actions in the modal header', () => {
		const openQueue = vi.fn();
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit, true, '1.7.0', openQueue);
		const openSpy = vi.spyOn(WhatsNewModal.prototype, 'open').mockImplementation(() => undefined);
		modal.open();

		const actions = Array.from(modal.contentEl.querySelectorAll('.ytkn-brand-action'));

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

		(actions[0] as HTMLButtonElement).click();
		expect(openQueue).toHaveBeenCalledOnce();

		(actions[3] as HTMLButtonElement).click();
		expect(openSpy).toHaveBeenCalledOnce();
		openSpy.mockRestore();
	});

	it('shows additional sections when AI is enabled even if AI summary is disabled', () => {
		const enabledModal = new GenerationOptionsModal(
			app,
			'',
			[sampleModel],
			{ useAi: true, generateAiSummary: false },
			onSubmit,
		);
		enabledModal.open();

		const enabledSetting = findAdditionalSectionsSetting(enabledModal.contentEl);
		expect(enabledSetting).toBeDefined();
		expect(enabledSetting?.style.display).toBe('');

		const disabledModal = new GenerationOptionsModal(
			app,
			'',
			[sampleModel],
			{ useAi: false, generateAiSummary: false },
			onSubmit,
		);
		disabledModal.open();

		const disabledSetting = findAdditionalSectionsSetting(disabledModal.contentEl);
		expect(disabledSetting).toBeDefined();
		expect(disabledSetting?.style.display).toBe('none');
	});

	it('hides the AI section divider when Use AI is turned off', () => {
		const modal = new GenerationOptionsModal(
			app,
			'',
			[sampleModel],
			{ useAi: true },
			onSubmit,
		);
		modal.open();

		const divider = modal.contentEl.querySelector<HTMLElement>('.ytkn-modal__quick-divider');
		const useAiToggle = modal.contentEl.querySelector<HTMLInputElement>(
			'.ytkn-modal__quick-toggle input[type="checkbox"]',
		);
		expect(divider?.style.display).toBe('');

		useAiToggle!.checked = false;
		useAiToggle!.dispatchEvent(new Event('change'));

		expect(divider?.style.display).toBe('none');
	});

	it('keeps additional sections visible when AI is enabled and summary is disabled', () => {
		const modal = new GenerationOptionsModal(
			app,
			'',
			[sampleModel],
			{ useAi: true, generateAiSummary: false, includeMindmap: true, includeMemorableQuotes: true },
			onSubmit,
		);
		modal.open();

		const settings = Array.from(modal.contentEl.querySelectorAll('.setting-item'));
		const additionalSections = findAdditionalSectionsSetting(modal.contentEl);
		const options = Array.from(additionalSections?.querySelectorAll<HTMLElement>('.ytkn-checkbox-group-option') ?? []);
		const instructionSetting = settings.find((setting) => setting.textContent?.includes('AI instructions')) as HTMLElement | undefined;

		expect(additionalSections?.style.display).toBe('');
		expect(additionalSections?.querySelector('.setting-item-info')).toBeNull();
		expect(additionalSections?.textContent).not.toContain('Additional sections');
		expect(options.map((option) => option.textContent?.trim())).toEqual([
			'TL;DR',
			'Mind Map',
			'Memorable Quotes',
		]);
		expect(options.map((option) => option.querySelector<HTMLInputElement>('input')?.checked))
			.toEqual([true, true, true]);
		expect(instructionSetting?.style.display).toBe('none');
	});

	it('renders the media embed dropdown with video, thumbnail, and off choices', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const selects = Array.from(modal.contentEl.querySelectorAll('select'));
		const mediaSelect = selects.find((select) => {
			const values = Array.from(select.options).map((option) => option.value);
			return ['video', 'thumbnail', 'none'].every((value) => values.includes(value));
		});

		expect(mediaSelect).not.toBeUndefined();
		expect(mediaSelect?.value).toBe('video');
	});

	it('uses a multiline frontmatter property override', () => {
		const modal = new GenerationOptionsModal(
			app,
			'',
			[sampleModel],
			{ includeFrontmatter: true, frontmatterPropertyAllowlist: 'title channel topic' },
			onSubmit,
		);
		modal.open();
		const row = findSetting(modal.contentEl, 'Frontmatter properties');
		const textarea = row?.querySelector<HTMLTextAreaElement>('textarea');

		expect(textarea?.value).toBe('title channel topic');
		expect(textarea?.rows).toBe(3);
		expect(row?.classList.contains('ytkn-control-row--textarea')).toBe(true);
	});

	it('uses settings-style groups for every advanced General section', () => {
		const modal = new GenerationOptionsModal(
			app,
			'',
			[sampleModel],
			{
				includeFrontmatter: true,
				transcriptMode: 'timestamped',
				transcriptLanguageMode: 'preferred',
				includeReport: true,
				modelIds: ['OpenAI:gpt-4'],
			},
			onSubmit,
		);
		modal.open();
		const generalPanel = modal.contentEl.querySelector<HTMLElement>('#ytkn-tab-panel-general')!;
		const groups = Array.from(generalPanel.querySelectorAll<HTMLElement>('.ytkn-settings__section-card'));

		expect(groups.map((group) => group.querySelector('.setting-item-heading')?.textContent)).toEqual([
			'Note format',
			'Transcript',
			'Playlists and channels',
			'Reports',
		]);
		for (const name of [
			'Frontmatter tags',
			'Frontmatter properties',
			'Link timestamps to YouTube',
			'Preferred language code',
			'Report location',
		]) {
			expect(findSetting(generalPanel, name)?.style.display).toBe('');
		}
	});

	it('uses settings-style model order and generation parameter groups', () => {
		const openSpy = vi.spyOn(ModelPickerModal.prototype, 'open').mockImplementation(() => undefined);
		const modal = new GenerationOptionsModal(
			app,
			'',
			[sampleModel, fallbackModel],
			{ modelIds: ['OpenAI:gpt-4'] },
			onSubmit,
		);
		modal.open();

		const aiPanel = modal.contentEl.querySelector<HTMLElement>('#ytkn-tab-panel-ai')!;
		const modelGroup = findSettingGroup(aiPanel, 'Model order');
		const parameterGroup = findSettingGroup(aiPanel, 'Generation parameters');
		const modelRow = modelGroup?.querySelector('.ytkn-model-chain__row');
		const addButton = modelGroup?.querySelector<HTMLButtonElement>('button[data-icon="plus"]');

		expect(modelGroup).toBeDefined();
		expect(modelRow?.querySelector('.setting-item-name')?.textContent).toBe('GPT-4');
		expect(modelRow?.querySelector('.setting-item-description')?.textContent).toBe('OpenAI');
		expect(modelGroup?.querySelector('select')).toBeNull();
		expect(addButton?.title).toBe('Add model');
		expect(addButton?.disabled).toBe(false);
		expect(parameterGroup).not.toBeUndefined();

		addButton?.click();
		expect(openSpy).toHaveBeenCalledOnce();
		openSpy.mockRestore();
	});

	it('shows link timestamps only for timestamped transcripts through either transcript selector', () => {
		const modal = new GenerationOptionsModal(
			app,
			'',
			[sampleModel],
			{ transcriptMode: 'readable' },
			onSubmit,
		);
		modal.open();
		const row = (container: ParentNode, name: string) =>
			Array.from(container.querySelectorAll<HTMLElement>('.setting-item'))
				.find((setting) => setting.querySelector('.setting-item-name')?.textContent === name);
		const quickGrid = modal.contentEl.querySelector('.ytkn-modal__quick-grid')!;
		const generalPanel = modal.contentEl.querySelector('#ytkn-tab-panel-general')!;
		const quickSelect = row(quickGrid, 'Transcript in note')?.querySelector<HTMLSelectElement>('select');
		const advancedSelect = row(generalPanel, 'Transcript in note')?.querySelector<HTMLSelectElement>('select');
		const linkTimestampsRow = row(generalPanel, 'Link timestamps to YouTube');

		expect(linkTimestampsRow?.style.display).toBe('none');

		quickSelect!.value = 'timestamped';
		quickSelect!.dispatchEvent(new Event('change'));
		expect(advancedSelect?.value).toBe('timestamped');
		expect(linkTimestampsRow?.style.display).toBe('');

		advancedSelect!.value = 'none';
		advancedSelect!.dispatchEvent(new Event('change'));
		expect(quickSelect?.value).toBe('none');
		expect(linkTimestampsRow?.style.display).toBe('none');
	});

	it('renders tab buttons labelled General and AI', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const tabs = Array.from(modal.contentEl.querySelectorAll('[role="tab"]'));
		const labels = tabs.map((t) => t.textContent?.trim());
		expect(labels).toContain('General');
		expect(labels).toContain('AI');
	});

	it('uses advanced descriptions only for model provider labels', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const descriptions = (panelId: string) => Array.from(modal.contentEl.querySelectorAll<HTMLElement>(
			`#ytkn-tab-panel-${panelId} .setting-item-description`,
		)).map((description) => description.textContent?.trim()).filter(Boolean);

		expect(descriptions('general')).toEqual([]);
		expect(descriptions('ai')).toEqual(['OpenAI']);
	});

	it('keeps unavailable-model guidance in the advanced AI tab', () => {
		const modal = new GenerationOptionsModal(app, '', [], defaultOptions, onSubmit);
		modal.open();

		const panel = modal.contentEl.querySelector<HTMLElement>('#ytkn-tab-panel-ai');
		expect(panel?.textContent).toContain(OPTIONS.modelOrder.unavailableDesc);
	});

	it('renders the compact URL field and AI label', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const urlField = modal.contentEl.querySelector<HTMLTextAreaElement>('textarea.ytkn-modal__url-input');
		const aiSetting = modal.contentEl.querySelector('.ytkn-modal__quick-toggle .setting-item-name');
		expect(urlField).not.toBeNull();
		expect(urlField?.tagName).toBe('TEXTAREA');
		expect(urlField?.placeholder).toBe('URL(s)');
		expect(urlField?.getAttribute('aria-label')).toBe('YouTube links');
		expect(aiSetting?.textContent).toBe('AI');
	});

	it('does not autofocus the URL field on phones', () => {
		vi.useFakeTimers();
		Platform.isPhone = true;
		const focusSpy = vi.spyOn(HTMLTextAreaElement.prototype, 'focus');
		try {
			const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);

			modal.open();
			vi.runAllTimers();

			expect(focusSpy).not.toHaveBeenCalled();
		} finally {
			focusSpy.mockRestore();
			vi.useRealTimers();
		}
	});

	it('clears contentEl on close', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();
		modal.close();

		expect(modal.contentEl.children.length).toBe(0);
	});
});

describe('GenerationOptionsModal submit: multi-URL', () => {
	let app: App;
	let onSubmit: ReturnType<typeof vi.fn<SubmitHandler>>;

	function openWithUrl(url: string, extraOptions: GenerationOptions = {}): GenerationOptionsModal {
		const modal = new GenerationOptionsModal(
			app,
			url,
			[sampleModel],
			{
				generateAiSummary: false,
				transcriptMode: 'readable',
				noteDestinationMode: 'folder',
				noteDestinationFolder: 'Notes',
				...extraOptions,
			},
			onSubmit,
		);
		modal.open();
		return modal;
	}

	function clickSubmit(modal: GenerationOptionsModal): void {
		const buttons = Array.from(modal.contentEl.querySelectorAll('button'));
		const submitBtn = buttons.find((b) => b.textContent === 'Generate');
		submitBtn?.click();
	}

	function pressEnterOnUrlField(modal: GenerationOptionsModal): void {
		const textarea = modal.contentEl.querySelector('textarea.ytkn-modal__url-input') as HTMLTextAreaElement;
		textarea?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	}

	function pressShiftEnterOnUrlField(modal: GenerationOptionsModal): void {
		const textarea = modal.contentEl.querySelector('textarea.ytkn-modal__url-input') as HTMLTextAreaElement;
		textarea?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
	}

	beforeEach(() => {
		app = new App();
		onSubmit = vi.fn<SubmitHandler>();
	});

	it('single valid video URL passes array of one URL to onSubmit', () => {
		const modal = openWithUrl(VIDEO_URL);
		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [urls] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(urls).toEqual([VIDEO_URL]);
	});

	it('passes mediaEmbedMode through on submit', () => {
		const modal = openWithUrl(VIDEO_URL, { mediaEmbedMode: 'thumbnail' });
		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [, options] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(options.mediaEmbedMode).toBe('thumbnail');
	});

	it('renders the open-created-note toggle for folder destination and passes it through on submit', () => {
		const modal = openWithUrl(VIDEO_URL, { openCreatedNote: true });
		const row = Array.from(modal.contentEl.querySelectorAll('.setting-item')).find(
			(el) => el.querySelector('.setting-item-name')?.textContent === 'Open created note',
		);
		expect(row).toBeDefined();

		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [, options] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(options.openCreatedNote).toBe(true);
	});

	it('passes tldrCalloutAtTop through on submit', () => {
		const modal = openWithUrl(VIDEO_URL, {
			generateAiSummary: true,
			tldrCalloutAtTop: false,
		});
		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [, options] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(options.tldrCalloutAtTop).toBe(false);
	});

	it('updates every add-on through the additional sections checkboxes', () => {
		const modal = openWithUrl(VIDEO_URL, {
			useAi: true,
			generateAiSummary: false,
			tldrCalloutAtTop: false,
			includeMindmap: false,
			includeMemorableQuotes: false,
		});
		const inputs = Array.from(findAdditionalSectionsSetting(modal.contentEl)
			?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? []);

		expect(inputs).toHaveLength(3);
		for (const input of inputs) {
			input.checked = true;
			input.dispatchEvent(new Event('change'));
		}

		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [, options] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(options.tldrCalloutAtTop).toBe(true);
		expect(options.includeMindmap).toBe(true);
		expect(options.includeMemorableQuotes).toBe(true);
	});

	it('allows metadata-only video output when AI and transcript are off', () => {
		const modal = openWithUrl(VIDEO_URL, {
			useAi: false,
			generateAiSummary: false,
			includeMindmap: false,
			includeMemorableQuotes: false,
			transcriptMode: 'none',
		});
		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [, options] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(options.useAi).toBe(false);
		expect(options.generateAiSummary).toBe(false);
		expect(options.transcriptMode).toBe('none');
	});

	it('allows combined playlist output when AI and transcript are both off', () => {
		const modal = openWithUrl(PLAYLIST_URL, {
			useAi: false,
			generateAiSummary: false,
			includeMindmap: false,
			includeMemorableQuotes: false,
			transcriptMode: 'none',
			playlistMode: 'combined',
		});
		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [, options] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(options.playlistMode).toBe('combined');
		expect(options.useAi).toBe(false);
		expect(options.transcriptMode).toBe('none');
	});

	it('allows combined playlist transcript-only output', () => {
		const modal = openWithUrl(PLAYLIST_URL, {
			useAi: false,
			generateAiSummary: false,
			includeMindmap: false,
			includeMemorableQuotes: false,
			transcriptMode: 'readable',
			playlistMode: 'combined',
		});
		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [, options] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(options.playlistMode).toBe('combined');
		expect(options.useAi).toBe(false);
		expect(options.transcriptMode).toBe('readable');
	});

	it('uses a neutral hint for playlist URLs', () => {
		const modal = openWithUrl(PLAYLIST_URL);
		const text = modal.contentEl.textContent ?? '';

		expect(text).toContain('Playlist detected.');
		expect(text).not.toContain('requires AI');
		expect(text).not.toContain('transcript-only');
	});

	it('distinguishes unsupported channel tabs from videos', () => {
		const modal = openWithUrl('https://www.youtube.com/@channel/playlists');
		const text = modal.contentEl.textContent ?? '';

		expect(text).toContain("The channel playlists tab isn't supported.");
		expect(text).not.toContain('Single video detected.');
		expect(findSetting(modal.contentEl, 'Channel')?.style.display).toBe('none');
	});

	it('shows channel content checkboxes and unlimited per-type selection for channel URLs', () => {
		const modal = openWithUrl(CHANNEL_URL, {
			channelContentTypes: ['videos', 'streams'],
			channelVideoLimit: null,
		});

		expect(modal.contentEl.textContent).toContain('Channel detected.');
		const contentRow = findSetting(modal.contentEl, 'Channel');
		expect(contentRow?.querySelector('.setting-item-name')?.textContent).toBe('Channel');
		expect(contentRow?.querySelector('.setting-item-description')?.textContent).toBe('');
		const options = Array.from(contentRow?.querySelectorAll('.ytkn-checkbox-group-option') ?? []);
		expect(options.map((option) => option.textContent?.trim())).toEqual(['Videos', 'Shorts', 'Streams']);
		expect(options.map((option) => (option.querySelector('input') as HTMLInputElement).checked)).toEqual([true, false, true]);
		const limitRow = modal.contentEl.querySelector('.ytkn-channel-limit-setting');
		expect(limitRow?.querySelector('.setting-item-name')?.textContent).toBe('Items per selected type');
		expect(limitRow?.querySelector('.setting-item-description')?.textContent).toBe('');
		const limitSelect = limitRow?.querySelector('select') as HTMLSelectElement;
		const limitInput = limitRow?.querySelector('input[type="number"]') as HTMLInputElement;
		expect(limitSelect.value).toBe('all');
		expect(limitInput.hidden).toBe(true);

		limitSelect.value = 'limited';
		limitSelect.dispatchEvent(new Event('change'));
		expect(limitInput.hidden).toBe(false);
		expect(limitInput.value).toBe('10');

		limitSelect.value = 'all';
		limitSelect.dispatchEvent(new Event('change'));
		expect(limitInput.hidden).toBe(true);

		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [, submitted] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(submitted.channelContentTypes).toEqual(['videos', 'streams']);
		expect(submitted.channelVideoLimit).toBeNull();
	});

	it('selects the matching content type when an explicit channel tab is pasted', () => {
		const modal = openWithUrl('', {
			channelContentTypes: ['videos', 'shorts', 'streams'],
		});
		const textarea = modal.contentEl.querySelector('textarea.ytkn-modal__url-input') as HTMLTextAreaElement;
		textarea.value = 'https://www.youtube.com/@channel/streams';
		textarea.dispatchEvent(new Event('input'));

		const channel = findSetting(modal.contentEl, 'Channel');
		const options = Array.from(channel?.querySelectorAll('.ytkn-checkbox-group-option') ?? []);
		expect(options.map((option) => (option.querySelector('input') as HTMLInputElement).checked)).toEqual([false, false, true]);
	});

	it('multi-URL valid paste passes all URLs to onSubmit', () => {
		const modal = openWithUrl(`${VIDEO_URL}, ${PLAYLIST_URL}`);
		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [urls] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(urls).toEqual([VIDEO_URL, PLAYLIST_URL]);
	});

	it('empty URL shows notice and does not call onSubmit', () => {
		const modal = openWithUrl('');
		clickSubmit(modal);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('invalid URL is passed through to onSubmit (plugin validates, not modal)', () => {
		const modal = openWithUrl(INVALID_URL);
		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [urls] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(urls).toEqual([INVALID_URL]);
	});

	it('Enter key on URL field submits', () => {
		const modal = openWithUrl(VIDEO_URL);
		pressEnterOnUrlField(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
	});

	it('Shift+Enter on URL field does not submit', () => {
		const modal = openWithUrl(VIDEO_URL);
		pressShiftEnterOnUrlField(modal);
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
