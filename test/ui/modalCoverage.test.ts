import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../mocks/obsidian');
	return mod;
});

import { GenerationOptionsModal } from '../../src/ui/modals/GenerationOptionsModal';
import { WhatsNewModal } from '../../src/ui/modals/WhatsNewModal';
import { SUPPORT_LINKS } from '../../src/releaseNotes';
import type { ModelConfig, GenerationOptions } from '../../src/types';
import { App } from 'obsidian';

const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const VIDEO_URL_2 = 'https://www.youtube.com/watch?v=oHg5SJYRHA0';
const PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PLtest12345';
const INVALID_URL = 'https://example.com/not-youtube';

const sampleModel: ModelConfig = {
	name: 'gpt-4',
	displayName: 'GPT-4',
	provider: { name: 'OpenAI', type: 'openai', apiKey: 'key' },
};

const defaultOptions: GenerationOptions = {};
type SubmitHandler = (urls: string[], options: GenerationOptions) => void;

describe('GenerationOptionsModal.onOpen', () => {
	let app: App;
	let onSubmit: ReturnType<typeof vi.fn<SubmitHandler>>;

	beforeEach(() => {
		app = new App();
		onSubmit = vi.fn<SubmitHandler>();
	});

	it('mounts the Quick-setup card with class ytkn-modal__quick-card', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const quickCard = modal.contentEl.querySelector('.ytkn-modal__quick-card');
		expect(quickCard).not.toBeNull();
	});

	it('renders the "Advanced settings" h3 heading', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const headings = Array.from(modal.contentEl.querySelectorAll('h3'));
		const advancedHeading = headings.find((h) => h.textContent === 'Advanced settings');
		expect(advancedHeading).not.toBeUndefined();
	});

	it('renders advanced setting cards with generic card classes and legacy hooks', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const card = modal.contentEl.querySelector('.ytkn-card.ytkn-settings__group');
		const title = card?.querySelector('.ytkn-card__title.ytkn-settings__group-title');
		const body = card?.querySelector('.ytkn-card__body.ytkn-settings__group-cards');

		expect(card).not.toBeNull();
		expect(title).not.toBeNull();
		expect(body).not.toBeNull();
	});

	it('renders tab nav with class ytkn-tabs containing at least 2 tabs', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const tabsEl = modal.contentEl.querySelector('.ytkn-tabs');
		expect(tabsEl).not.toBeNull();
		const tabs = tabsEl!.querySelectorAll('.ytkn-tab');
		expect(tabs.length).toBeGreaterThanOrEqual(2);
	});

	it('marks the default tab and panel as active', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const activeTab = modal.contentEl.querySelector('.ytkn-tab.is-active');
		const activePanel = modal.contentEl.querySelector('.ytkn-tab-panel.is-active');

		expect(activeTab?.textContent?.trim()).toBe('General');
		expect(activeTab?.getAttribute('aria-selected')).toBe('true');
		expect(activePanel?.getAttribute('aria-labelledby')).toBe('ytkn-tab-general');
	});

	it('renders sticky-header scroll contract elements', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		expect(modal.contentEl.querySelector('.ytkn-modal__scroll-sentinel')).not.toBeNull();
		expect(modal.contentEl.querySelector('.ytkn-modal__header-wrap')).not.toBeNull();
	});

	it('renders Generate as the only generation modal action', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const actionButtons = Array.from(
			modal.contentEl.querySelectorAll('.ytkn-modal__actions button'),
		);
		const actionLabels = actionButtons.map((button) => button.textContent);

		expect(actionLabels).toEqual(['Generate']);
		expect(actionLabels).not.toContain('Cancel');
	});

	it('renders icon-only brand actions in the modal header', () => {
		const openQueue = vi.fn();
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit, true, '1.7.0', openQueue);
		const openSpy = vi.spyOn(WhatsNewModal.prototype, 'open').mockImplementation(() => undefined);
		modal.open();

		const headerWrap = modal.contentEl.querySelector('.ytkn-modal__header-wrap');
		const brand = modal.contentEl.querySelector('.ytkn-modal__brand');
		const copy = brand?.children.item(1);
		const brandActions = copy?.querySelector('.ytkn-brand-actions');
		const actions = Array.from(modal.contentEl.querySelectorAll('.ytkn-brand-action'));

		expect(brand?.classList.contains('ytkn-brand-header')).toBe(true);
		expect(brand?.classList.contains('ytkn-brand-header--modal')).toBe(true);
		expect(copy?.classList.contains('ytkn-brand-copy')).toBe(true);
		expect(copy?.classList.contains('ytkn-brand-copy--modal')).toBe(true);
		expect(copy?.children.item(0)?.classList.contains('ytkn-brand-title')).toBe(true);
		expect(copy?.children.item(1)).toBe(brandActions);
		expect(headerWrap?.querySelector('.ytkn-modal__actions')?.contains(brandActions ?? null)).toBe(false);
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

		(actions[0] as HTMLButtonElement).click();
		expect(openQueue).toHaveBeenCalledOnce();

		(actions[3] as HTMLButtonElement).click();
		expect(openSpy).toHaveBeenCalledOnce();
		openSpy.mockRestore();
	});

	it('Use AI toggle element has class ytkn-modal__quick-toggle', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const quickToggle = modal.contentEl.querySelector('.ytkn-modal__quick-toggle');
		expect(quickToggle).not.toBeNull();
	});

	it('renders the TL;DR quick setting with the same full-width styling as mindmap rows', () => {
		const modal = new GenerationOptionsModal(
			app,
			'',
			[sampleModel],
			{ generateAiSummary: true },
			onSubmit,
		);
		modal.open();

		const tldrSetting = modal.contentEl.querySelector('.ytkn-modal__tldr-callout-setting');
		expect(tldrSetting).not.toBeNull();
		expect(tldrSetting?.classList.contains('ytkn-modal__quick-full')).toBe(true);
	});

	it('shows the TL;DR quick setting when AI is enabled even if AI summary is disabled', () => {
		const enabledModal = new GenerationOptionsModal(
			app,
			'',
			[sampleModel],
			{ useAi: true, generateAiSummary: false },
			onSubmit,
		);
		enabledModal.open();

		const enabledSetting = enabledModal.contentEl.querySelector('.ytkn-modal__tldr-callout-setting') as HTMLElement | null;
		expect(enabledSetting).not.toBeNull();
		expect(enabledSetting?.style.display).toBe('');

		const disabledModal = new GenerationOptionsModal(
			app,
			'',
			[sampleModel],
			{ useAi: false, generateAiSummary: false },
			onSubmit,
		);
		disabledModal.open();

		const disabledSetting = disabledModal.contentEl.querySelector('.ytkn-modal__tldr-callout-setting') as HTMLElement | null;
		expect(disabledSetting).not.toBeNull();
		expect(disabledSetting?.style.display).toBe('none');
	});

	it('keeps AI add-ons visible when AI is enabled and summary is disabled', () => {
		const modal = new GenerationOptionsModal(
			app,
			'',
			[sampleModel],
			{ useAi: true, generateAiSummary: false, includeMindmap: true, includeMemorableQuotes: true },
			onSubmit,
		);
		modal.open();

		const settings = Array.from(modal.contentEl.querySelectorAll('.setting-item'));
		const mindmapSetting = settings.find((setting) => setting.textContent?.includes('Add mindmap')) as HTMLElement | undefined;
		const quotesSetting = settings.find((setting) => setting.textContent?.includes('Add memorable quotes')) as HTMLElement | undefined;
		const instructionSetting = settings.find((setting) => setting.textContent?.includes('Instruction style')) as HTMLElement | undefined;

		expect(mindmapSetting?.style.display).toBe('');
		expect(quotesSetting?.style.display).toBe('');
		expect(instructionSetting?.style.display).toBe('none');
	});

	it('auto-disables AI on submit when no AI outputs are selected', () => {
		const modal = new GenerationOptionsModal(
			app,
			VIDEO_URL,
			[sampleModel],
			{
				useAi: true,
				generateAiSummary: false,
				tldrCalloutAtTop: false,
				includeMindmap: false,
				includeMemorableQuotes: false,
				transcriptMode: 'readable',
				noteDestinationMode: 'folder',
				noteDestinationFolder: 'Notes',
			},
			onSubmit,
		);
		modal.open();

		const buttons = Array.from(modal.contentEl.querySelectorAll('button'));
		buttons.find((button) => button.textContent === 'Generate')?.click();

		expect(onSubmit).toHaveBeenCalledOnce();
		const [, options] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(options.useAi).toBe(false);
		expect(options.generateAiSummary).toBe(false);
		expect(options.includeMindmap).toBe(false);
		expect(options.includeMemorableQuotes).toBe(false);
	});

	it('keeps AI enabled for TL;DR-only submits', () => {
		const modal = new GenerationOptionsModal(
			app,
			VIDEO_URL,
			[sampleModel],
			{
				useAi: true,
				generateAiSummary: false,
				tldrCalloutAtTop: true,
				includeMindmap: false,
				includeMemorableQuotes: false,
				transcriptMode: 'readable',
				noteDestinationMode: 'folder',
				noteDestinationFolder: 'Notes',
			},
			onSubmit,
		);
		modal.open();

		const buttons = Array.from(modal.contentEl.querySelectorAll('button'));
		buttons.find((button) => button.textContent === 'Generate')?.click();

		expect(onSubmit).toHaveBeenCalledOnce();
		const [, options] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(options.useAi).toBe(true);
		expect(options.generateAiSummary).toBe(false);
		expect(options.tldrCalloutAtTop).toBe(true);
		expect(options.includeMindmap).toBe(false);
		expect(options.includeMemorableQuotes).toBe(false);
	});

	it('AI model dropdown row has a stable layout class', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const modelSetting = modal.contentEl.querySelector('.ytkn-modal__model-setting');
		expect(modelSetting).not.toBeNull();
		expect(modelSetting?.querySelector('select')).not.toBeNull();
		expect(modelSetting?.classList.contains('ytkn-setting-row--select')).toBe(true);
		expect(modelSetting?.classList.contains('ytkn-setting-row--stacked')).toBe(true);
		expect(modelSetting?.classList.contains('ytkn-setting-row--fit-control')).toBe(false);
	});

	it('stamps modal select and number setting rows with explicit layout classes', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const transcriptSelect = Array.from(modal.contentEl.querySelectorAll('select')).find((select) => {
			const values = Array.from(select.options).map((option) => option.value);
			return ['none', 'readable', 'timestamped'].every((value) => values.includes(value));
		});
		const temperatureInput = modal.contentEl.querySelector('input[type="number"]');
		const transcriptRow = transcriptSelect?.closest('.setting-item');
		const temperatureRow = temperatureInput?.closest('.setting-item');

		expect(transcriptRow?.classList.contains('ytkn-setting-row--select')).toBe(true);
		expect(transcriptRow?.classList.contains('ytkn-setting-row--stacked')).toBe(true);
		expect(transcriptRow?.classList.contains('ytkn-setting-row--fit-control')).toBe(false);
		expect(temperatureRow?.classList.contains('ytkn-setting-row--number')).toBe(true);
		expect(temperatureRow?.classList.contains('ytkn-setting-row--fit-control')).toBe(true);
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

	it('renders transcript mode dropdowns without a raw option', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const transcriptSelects = Array.from(modal.contentEl.querySelectorAll('select')).filter((select) => {
			const values = Array.from(select.options).map((option) => option.value);
			return ['none', 'readable', 'timestamped'].every((value) => values.includes(value));
		});

		expect(transcriptSelects.length).toBeGreaterThanOrEqual(2);
		for (const select of transcriptSelects) {
			const values = Array.from(select.options).map((option) => option.value);
			expect(values).not.toContain('raw');
		}
	});

	it('renders tab buttons labelled General and GenAI', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const tabs = Array.from(modal.contentEl.querySelectorAll('.ytkn-tab'));
		const labels = tabs.map((t) => t.textContent?.trim());
		expect(labels).toContain('General');
		expect(labels).toContain('GenAI');
	});

	it('URL field is a textarea element', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const urlField = modal.contentEl.querySelector('textarea.ytkn-modal__url-input');
		const manualPrompt = modal.contentEl.querySelector('textarea.ytkn-modal__manual-prompt');
		expect(urlField).not.toBeNull();
		expect(urlField?.tagName).toBe('TEXTAREA');
		expect(urlField?.classList.contains('ytkn-form__input')).toBe(true);
		expect(manualPrompt?.classList.contains('ytkn-form__input')).toBe(true);
	});

	it('URL input field is present in the quick area', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const urlInput = modal.contentEl.querySelector('.ytkn-modal__url-input');
		expect(urlInput).not.toBeNull();
	});

	it('clears contentEl on close', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();
		modal.close();

		expect(modal.contentEl.children.length).toBe(0);
	});
});

describe('GenerationOptionsModal submit — multi-URL', () => {
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

	it('blocks combined playlist transcript-only output', () => {
		const modal = openWithUrl(PLAYLIST_URL, {
			useAi: false,
			generateAiSummary: false,
			includeMindmap: false,
			includeMemorableQuotes: false,
			transcriptMode: 'readable',
			playlistMode: 'combined',
		});
		clickSubmit(modal);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('multi-URL valid paste passes all URLs to onSubmit', () => {
		const modal = openWithUrl(`${VIDEO_URL}, ${PLAYLIST_URL}`);
		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [urls] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(urls).toEqual([VIDEO_URL, PLAYLIST_URL]);
	});

	it('newline-separated URLs are parsed correctly', () => {
		const modal = openWithUrl(`${VIDEO_URL}\n${VIDEO_URL_2}`);
		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [urls] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(urls).toEqual([VIDEO_URL, VIDEO_URL_2]);
	});

	it('empty URL shows notice and does not call onSubmit', () => {
		const modal = openWithUrl('');
		clickSubmit(modal);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('whitespace-only URL shows notice and does not call onSubmit', () => {
		const modal = openWithUrl('   ');
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

	it('multi-URL with one invalid URL still passes all to onSubmit', () => {
		const input = `${VIDEO_URL} ${INVALID_URL}`;
		const modal = openWithUrl(input);
		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [urls] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(urls).toHaveLength(2);
		expect(urls[0]).toBe(VIDEO_URL);
		expect(urls[1]).toBe(INVALID_URL);
	});

	it('whitespace and comma separators all produce same URL array', () => {
		const commas = openWithUrl(`${VIDEO_URL},${PLAYLIST_URL}`);
		clickSubmit(commas);

		const spaces = openWithUrl(`${VIDEO_URL} ${PLAYLIST_URL}`);
		clickSubmit(spaces);

		const [urlsCommas] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		const [urlsSpaces] = onSubmit.mock.calls[1] as [string[], GenerationOptions];
		expect(urlsCommas).toEqual(urlsSpaces);
	});

	it('duplicate URLs are deduped before calling onSubmit', () => {
		const modal = openWithUrl(`${VIDEO_URL}, ${VIDEO_URL}, ${PLAYLIST_URL}`);
		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [urls] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(urls).toEqual([VIDEO_URL, PLAYLIST_URL]);
	});

	it('single URL after dedup still calls onSubmit with array of one', () => {
		const modal = openWithUrl(`${VIDEO_URL} ${VIDEO_URL}`);
		clickSubmit(modal);
		expect(onSubmit).toHaveBeenCalledOnce();
		const [urls] = onSubmit.mock.calls[0] as [string[], GenerationOptions];
		expect(urls).toEqual([VIDEO_URL]);
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
