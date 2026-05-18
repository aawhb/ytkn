import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../mocks/obsidian');
	return mod;
});

import { GenerationOptionsModal } from '../../src/ui/modals/GenerationOptionsModal';
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

	it('AI summary toggle element has class ytkn-modal__quick-toggle', () => {
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

	it('shows the TL;DR quick setting only when AI summary is enabled', () => {
		const enabledModal = new GenerationOptionsModal(
			app,
			'',
			[sampleModel],
			{ generateAiSummary: true },
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
			{ generateAiSummary: false },
			onSubmit,
		);
		disabledModal.open();

		const disabledSetting = disabledModal.contentEl.querySelector('.ytkn-modal__tldr-callout-setting') as HTMLElement | null;
		expect(disabledSetting).not.toBeNull();
		expect(disabledSetting?.style.display).toBe('none');
	});

	it('AI model dropdown row has a stable layout class', () => {
		const modal = new GenerationOptionsModal(app, '', [sampleModel], defaultOptions, onSubmit);
		modal.open();

		const modelSetting = modal.contentEl.querySelector('.ytkn-modal__model-setting');
		expect(modelSetting).not.toBeNull();
		expect(modelSetting?.querySelector('select')).not.toBeNull();
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
		expect(urlField).not.toBeNull();
		expect(urlField?.tagName).toBe('TEXTAREA');
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
