import type { App } from 'obsidian';
import { Modal, Notice, Platform, Setting, setIcon } from 'obsidian';
import { SETTINGS_TABS, TabGroup } from '../shared/tabs';
import { createSettingsCard } from '../shared/cards';
import { renderBrandActions } from '../shared/brandActions';
import { renderTemplateControls } from '../shared/templateControls';
import type { GenerationFormState } from './generationFormState';
import { buildGenerationFormState, seedTemplateControlValues } from './generationFormState';
import { buildGenerationSubmit } from './generationSubmit';
import type {
	ChannelContentType,
	ControlDeclaration,
	GenerationOptions,
	InstructionMode,
	InstructionTemplate,
	MediaEmbedMode,
	ModelConfig,
	NoteDestinationMode,
	ReportLocation,
	PlaylistMode,
	SourceSectionPosition,
	TranscriptFailureMode,
	TranscriptLanguageMode,
	TranscriptMode,
} from '../../types';
import { renderModelChainRows } from '../shared/modelChainRows';
import {
	classifyUrls,
	extractChannelRef,
	extractUnsupportedChannelTab,
	parseUrls,
} from '../../youtube/urls';
import {
	findTemplateChoice,
	getTemplate,
	populateTemplateDropdown,
} from '../../ai/templates/registry';
import {
	SUPPORT_LINKS,
	getRecentReleaseNotes,
} from '../../releaseNotes';
import { WhatsNewModal } from '../releaseNotes/whatsNewModal';
import { stampSettingRowClasses } from '../shared/settingRows';
import { SETTING_COPY } from '../shared/settingCopy';

export class GenerationOptionsModal extends Modal {
	private state!: GenerationFormState;
	private activeTabId: string = 'general';
	private instructionSettingEl?: HTMLElement;
	private aiSummarySettingEl?: HTMLElement;
	private templateSettingEl?: HTMLElement;
	private templateSubtitleEl?: HTMLElement;
	private manualSettingEl?: HTMLElement;
	private aiModelSettingEl?: HTMLElement;
	private aiModelChainEl?: HTMLElement;
	private temperatureSettingEl?: HTMLElement;
	private requestTimeoutSettingEl?: HTMLElement;
	private folderSettingEl?: HTMLElement;
	private openCreatedNoteSettingEl?: HTMLElement;
	private playlistQuickSettingEl?: HTMLElement;
	private channelQuickSettingEls: HTMLElement[] = [];
	private channelContentInputs = new Map<ChannelContentType, HTMLInputElement>();
	private lastExplicitChannelTabKey: string | null = null;
	private perVideoReportSettingEl?: HTMLElement;
	private preferredLangSettingEl?: HTMLElement;
	private tldrCalloutSettingEl?: HTMLElement;
	private mindmapSettingEl?: HTMLElement;
	private memorableQuotesSettingEl?: HTMLElement;
	private aiSectionDividerEl?: HTMLElement;
	private controlsAreaEl?: HTMLElement;
	private frontmatterTagsSettingEl?: HTMLElement;
	private frontmatterPropertyAllowlistSettingEl?: HTMLElement;
	private quickTranscriptModeSelectEl?: HTMLSelectElement;
	private advancedTranscriptModeSelectEl?: HTMLSelectElement;

	constructor(
		app: App,
		private initialUrl: string,
		private availableModels: ModelConfig[],
		private initialOptions: GenerationOptions,
		private onSubmit: (urls: string[], options: GenerationOptions) => void,
		private hasActiveNote: boolean = true,
		private currentVersion: string = 'current version',
		private onOpenQueue?: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ytkn-modal-scroll-container');

		this.state = buildGenerationFormState({
			initialUrl: this.initialUrl,
			availableModels: this.availableModels,
			initialOptions: this.initialOptions,
			hasActiveNote: this.hasActiveNote,
		});
		this.lastExplicitChannelTabKey = this.explicitChannelTabSelection(this.state.url)?.key ?? null;

		const wrap = contentEl.createDiv({ cls: 'ytkn-modal' });

		const sentinel = wrap.createDiv({ cls: 'ytkn-modal__scroll-sentinel' });
		const headerWrap = wrap.createDiv({ cls: 'ytkn-modal__header-wrap' });

		const observer = new IntersectionObserver(
			([entry]) => {
				headerWrap.toggleClass('is-scrolled', !entry.isIntersecting);
			},
			{ root: contentEl, rootMargin: '0px' },
		);
		observer.observe(sentinel);

		const brand = headerWrap.createDiv({ cls: 'ytkn-modal__brand ytkn-brand-header ytkn-brand-header--modal' });
		const brandIcon = brand.createDiv({ cls: 'ytkn-brand-mark' });
		setIcon(brandIcon, 'play');
		const brandCopy = brand.createDiv({ cls: 'ytkn-modal__brand-copy ytkn-brand-copy ytkn-brand-copy--modal' });
		brandCopy.createEl('h2', {
			text: 'YT Knowledge Notes',
			cls: 'ytkn-modal__title ytkn-brand-title',
		});
		renderBrandActions(brandCopy, this.getBrandActions());
		this.renderActionRow(headerWrap);

		const quickWrap = wrap.createDiv({ cls: 'ytkn-modal__quick-area' });
		this.renderQuickArea(quickWrap);

		wrap.createEl('h3', {
			text: 'Advanced settings',
			cls: 'ytkn-modal__advanced-title',
		});

		const tabGroup = new TabGroup(wrap, SETTINGS_TABS, this.activeTabId, (tabId) => {
			this.activeTabId = tabId;
		});

		const generalPanel = tabGroup.getPanel('general');
		if (generalPanel) {
			this.renderGeneralTab(generalPanel);
		}

		const genAiPanel = tabGroup.getPanel('genai');
		if (genAiPanel) {
			this.renderGenAiTab(genAiPanel);
		}

		this.syncPlaylistContextVisibility();
		this.refreshAiVisibility();
		this.refreshDestinationVisibility();
		this.refreshPlaylistVisibility();
		this.refreshFrontmatterVisibility();
		stampSettingRowClasses(wrap);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderSourceField(urlContainer: HTMLElement, hintContainer: HTMLElement): void {
		const urlSetting = new Setting(urlContainer).addTextArea((textarea) => {
			textarea.setPlaceholder('URL(s)')
				.setValue(this.state.url)
				.onChange((value) => {
					this.state.url = value;
					this.syncChannelSelectionFromUrl(value);
					this.autoGrowUrlField(textarea.inputEl);
					this.setHint(playlistHintEl);
				});
			textarea.inputEl.addClass('ytkn-form__input');
			textarea.inputEl.addClass('ytkn-modal__url-input');
			textarea.inputEl.setAttribute('aria-label', 'YouTube links');
			textarea.inputEl.rows = 1;
			textarea.inputEl.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
					e.preventDefault();
					this.submit();
				}
			});
			if (!Platform.isPhone) {
				window.setTimeout(() => textarea.inputEl.focus(), 0);
			}
			this.autoGrowUrlField(textarea.inputEl);
		});
		urlSetting.settingEl.addClass('ytkn-modal__input-only');
		urlSetting.settingEl.addClass('ytkn-modal__url-setting');

		const playlistHintEl = hintContainer.createDiv({
			cls: 'ytkn-modal__helper-text ytkn-modal__url-hint',
		});

		this.setHint(playlistHintEl);
	}

	private autoGrowUrlField(el: HTMLTextAreaElement): void {
		const lines = el.value.split('\n').length;
		el.rows = Math.max(1, Math.min(6, lines));
	}

	private setHint(hintEl: HTMLElement): void {
		const trimmed = this.state.url.trim();

		if (!trimmed) {
			hintEl.setText('');
			hintEl.hide();
			this.syncPlaylistContextVisibility();
			return;
		}

		const urls = parseUrls(trimmed);
		if (urls.length > 1) {
			const classifications = classifyUrls(urls);
			const videos = classifications.filter((c) => c === 'video').length;
			const playlists = classifications.filter((c) => c === 'playlist').length;
			const channels = classifications.filter((c) => c === 'channel').length;
			const invalid = classifications.filter((c) => c === 'invalid').length;
			const parts: string[] = [];
			if (videos > 0) parts.push(`${videos} video${videos > 1 ? 's' : ''}`);
			if (playlists > 0) parts.push(`${playlists} playlist${playlists > 1 ? 's' : ''}`);
			if (channels > 0) parts.push(`${channels} channel${channels > 1 ? 's' : ''}`);
			if (invalid > 0) parts.push(`${invalid} invalid URL${invalid > 1 ? 's' : ''}`);
			hintEl.setText(`${urls.length} URLs detected: ${parts.join(', ')}.`);
			hintEl.show();
		} else {
			const classification = classifyUrls([trimmed])[0];
			const unsupportedChannelTab = extractUnsupportedChannelTab(trimmed);
			if (classification === 'playlist') {
				hintEl.setText('Playlist detected.');
				hintEl.show();
			} else if (classification === 'channel') {
				hintEl.setText('Channel detected.');
				hintEl.show();
			} else if (classification === 'video') {
				hintEl.setText('Single video detected.');
				hintEl.show();
			} else if (unsupportedChannelTab) {
				hintEl.setText(`The channel ${unsupportedChannelTab} tab isn't supported. Use a Home, Videos, Shorts, or Live channel link.`);
				hintEl.show();
			} else {
				hintEl.setText('URL is not a supported YouTube link.');
				hintEl.show();
			}
		}

		this.syncPlaylistContextVisibility();
	}

	private syncPlaylistContextVisibility(): void {
		const classifications = classifyUrls(parseUrls(this.state.url.trim()));
		const hasPlaylist = classifications.includes('playlist');
		const hasChannel = classifications.includes('channel');
		this.playlistQuickSettingEl?.toggle(hasPlaylist || hasChannel);
		for (const settingEl of this.channelQuickSettingEls) {
			settingEl.toggle(hasChannel);
		}
	}

	private explicitChannelTabSelection(value: string): { key: string; contentType: ChannelContentType } | null {
		const urls = parseUrls(value.trim());
		if (urls.length !== 1) {
			return null;
		}
		const ref = extractChannelRef(urls[0]);
		const contentType = ref?.tab === 'videos'
			? 'videos'
			: ref?.tab === 'shorts'
				? 'shorts'
				: ref?.tab === 'streams' ? 'streams' : null;
		return ref && contentType
			? { key: `${ref.kind}:${ref.value}:${ref.tab}`, contentType }
			: null;
	}

	private syncChannelSelectionFromUrl(value: string): void {
		const selection = this.explicitChannelTabSelection(value);
		if (!selection || selection.key === this.lastExplicitChannelTabKey) {
			return;
		}
		this.lastExplicitChannelTabKey = selection.key;
		this.state.channelContentTypes = [selection.contentType];
		for (const [contentType, input] of this.channelContentInputs) {
			input.checked = contentType === selection.contentType;
		}
	}

	private renderQuickArea(wrap: HTMLElement): void {
		const section = this.createSection(wrap, 'Quick setup');
		section.addClass('ytkn-modal__quick-card');

		const quickTop = section.createDiv({ cls: 'ytkn-modal__quick-top' });
		const urlZone = quickTop.createDiv({ cls: 'ytkn-modal__quick-top-url' });
		const toggleZone = quickTop.createDiv({ cls: 'ytkn-modal__quick-top-toggle' });
		new Setting(toggleZone)
			.setName(SETTING_COPY.useAi.name)
			.addToggle((toggle) => {
				toggle
					.setValue(this.state.useAi)
					.onChange((value) => {
						this.state.useAi = value;
						this.refreshAiVisibility();
					});
			})
			.settingEl.addClass('ytkn-modal__quick-toggle');

		this.renderSourceField(urlZone, section);

		const quickGrid = section.createDiv({ cls: 'ytkn-modal__quick-grid' });

		const aiSummarySetting = new Setting(quickGrid)
			.setName(SETTING_COPY.aiSummary.name)
			.addToggle((toggle) => {
				toggle
					.setValue(this.state.generateAiSummary)
					.onChange((value) => {
						this.state.generateAiSummary = value;
						this.refreshAiVisibility();
					});
			});
		this.aiSummarySettingEl = aiSummarySetting.settingEl;
		aiSummarySetting.settingEl.addClass('ytkn-modal__quick-full');
		aiSummarySetting.settingEl.addClass('ytkn-modal__ai-summary-setting');

		const instructionSetting = new Setting(quickGrid)
			.setName(SETTING_COPY.instructionStyle.name)
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(SETTING_COPY.instructionStyle.options!)
					.setValue(this.state.instructionMode)
					.onChange((value) => {
						this.state.instructionMode = value as InstructionMode;
						this.refreshAiVisibility();
					});
			});
		this.instructionSettingEl = instructionSetting.settingEl;

		const templateSetting = new Setting(quickGrid)
			.setName(SETTING_COPY.contentTemplate.name)
			.addDropdown((dropdown) => {
				populateTemplateDropdown(dropdown.selectEl);
				dropdown
					.setValue(this.state.instructionTemplate)
					.onChange((value) => {
						this.state.instructionTemplate = value as InstructionTemplate;
						this.state.controlValues = seedTemplateControlValues(this.state.instructionTemplate);
						this.updateTemplateSubtitle();
						this.updateControlsArea();
					});
			});
		this.templateSettingEl = templateSetting.settingEl;

		const templateSubtitle = quickGrid.createDiv({
			cls: 'ytkn-modal__helper-text ytkn-modal__template-subtitle ytkn-modal__quick-full',
		});
		this.templateSubtitleEl = templateSubtitle;
		this.updateTemplateSubtitle();

		const controlsArea = quickGrid.createDiv({ cls: 'ytkn-modal__controls-area ytkn-modal__quick-full' });
		this.controlsAreaEl = controlsArea;
		this.updateControlsArea();

		const manualSetting = new Setting(quickGrid)
			.setName(SETTING_COPY.manualInstructions.name)
			.addTextArea((text) => {
				text.setPlaceholder(SETTING_COPY.manualInstructions.placeholder!)
					.setValue(this.state.manualInstructions)
					.onChange((value) => {
						this.state.manualInstructions = value;
					});
				text.inputEl.rows = 4;
				text.inputEl.addClass('ytkn-form__input');
				text.inputEl.addClass('ytkn-modal__manual-prompt');
			});
		this.manualSettingEl = manualSetting.settingEl;
		manualSetting.settingEl.addClass('ytkn-modal__quick-full');

		const tldrCalloutSetting = new Setting(quickGrid)
			.setName(SETTING_COPY.tldrCallout.name)
			.addToggle((toggle) =>
				toggle
					.setValue(this.state.tldrCalloutAtTop)
					.onChange((v) => (this.state.tldrCalloutAtTop = v)),
			);
		this.tldrCalloutSettingEl = tldrCalloutSetting.settingEl;
		tldrCalloutSetting.settingEl.addClass('ytkn-modal__quick-full');
		tldrCalloutSetting.settingEl.addClass('ytkn-modal__tldr-callout-setting');

		const mindmapSetting = new Setting(quickGrid)
			.setName(SETTING_COPY.mindmap.name)
			.addToggle((toggle) =>
				toggle
					.setValue(this.state.includeMindmap)
					.onChange((v) => (this.state.includeMindmap = v)),
			);
		this.mindmapSettingEl = mindmapSetting.settingEl;
		mindmapSetting.settingEl.addClass('ytkn-modal__quick-full');

		const memorableQuotesSetting = new Setting(quickGrid)
			.setName(SETTING_COPY.memorableQuotes.name)
			.addToggle((toggle) =>
				toggle
					.setValue(this.state.includeMemorableQuotes)
					.onChange((v) => (this.state.includeMemorableQuotes = v)),
			);
		this.memorableQuotesSettingEl = memorableQuotesSetting.settingEl;
		memorableQuotesSetting.settingEl.addClass('ytkn-modal__quick-full');

		this.aiSectionDividerEl = quickGrid.createDiv({ cls: 'ytkn-modal__quick-divider' });

		new Setting(quickGrid)
			.setName(SETTING_COPY.outputDestination.name)
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(SETTING_COPY.outputDestination.options!)
					.setValue(this.state.noteDestinationMode)
					.onChange((v: string) => {
						this.state.noteDestinationMode = v as NoteDestinationMode;
						this.refreshDestinationVisibility();
					});
				if (!this.hasActiveNote) {
					for (const val of ['current-note', 'append-to-active-note'] as const) {
						const opt = dropdown.selectEl.querySelector<HTMLOptionElement>(`option[value="${val}"]`);
						if (opt) opt.disabled = true;
					}
				}
			});

		new Setting(quickGrid)
			.setName(SETTING_COPY.transcriptInNote.name)
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(SETTING_COPY.transcriptInNote.options!)
					.setValue(this.state.transcriptMode)
					.onChange((value) => {
						this.state.transcriptMode = value as TranscriptMode;
						if (this.advancedTranscriptModeSelectEl) {
							this.advancedTranscriptModeSelectEl.value = value;
						}
					});
				this.quickTranscriptModeSelectEl = dropdown.selectEl;
			});

		const folderSettingEl = new Setting(quickGrid)
			.setName(SETTING_COPY.destinationFolder.name)
			.addText((text) =>
				text
					.setPlaceholder(SETTING_COPY.destinationFolder.placeholder!)
					.setValue(this.state.noteDestinationFolder)
					.onChange((v) => (this.state.noteDestinationFolder = v)),
			).settingEl;
		folderSettingEl.addClass('ytkn-modal__input-only');
		folderSettingEl.addClass('ytkn-modal__quick-full');
		this.folderSettingEl = folderSettingEl;

		const openCreatedNoteSettingEl = new Setting(quickGrid)
			.setName(SETTING_COPY.openCreatedNote.name)
			.addToggle((toggle) =>
				toggle
					.setValue(this.state.openCreatedNote)
					.onChange((v) => (this.state.openCreatedNote = v)),
			).settingEl;
		openCreatedNoteSettingEl.addClass('ytkn-modal__quick-full');
		this.openCreatedNoteSettingEl = openCreatedNoteSettingEl;

		const playlistSetting = new Setting(quickGrid)
			.setName(SETTING_COPY.playlistHandling.name)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SETTING_COPY.playlistHandling.options!)
					.setValue(this.state.playlistMode)
					.onChange((v) => {
						this.state.playlistMode = v as PlaylistMode;
						this.refreshPlaylistVisibility();
					}),
			);
		this.playlistQuickSettingEl = playlistSetting.settingEl;
		playlistSetting.settingEl.addClass('ytkn-modal__quick-full');

		this.renderChannelControls(quickGrid);
	}

	private renderChannelControls(containerEl: HTMLElement): void {
		const contentSetting = new Setting(containerEl)
			.setName(SETTING_COPY.channelContent.name);
		contentSetting.settingEl.addClass('ytkn-modal__quick-full');
		contentSetting.settingEl.addClass('ytkn-channel-content-setting');

		for (const contentType of ['videos', 'shorts', 'streams'] as const) {
			const label = contentSetting.controlEl.createEl('label', { cls: 'ytkn-channel-content-option' });
			const checkbox = label.createEl('input', { attr: { type: 'checkbox' } });
			checkbox.checked = this.state.channelContentTypes.includes(contentType);
			this.channelContentInputs.set(contentType, checkbox);
			checkbox.addEventListener('change', () => {
				const selected = new Set(this.state.channelContentTypes);
				if (checkbox.checked) {
					selected.add(contentType);
				} else {
					selected.delete(contentType);
				}
				this.state.channelContentTypes = (['videos', 'shorts', 'streams'] as ChannelContentType[])
					.filter((type) => selected.has(type));
			});
			label.createSpan({ text: SETTING_COPY.channelContent.options![contentType] });
		}

		let limitInput: HTMLInputElement;
		const limitSetting = new Setting(containerEl)
			.setName(SETTING_COPY.channelItemsPerType.name)
			.addDropdown((dropdown) => dropdown
				.addOptions(SETTING_COPY.channelItemsPerType.options!)
				.setValue(this.state.channelVideoLimit ? 'limited' : 'all')
				.onChange((value) => {
					const unlimited = value === 'all';
					limitSetting.settingEl.toggleClass('ytkn-channel-limit-setting--unlimited', unlimited);
					limitInput.hidden = unlimited;
					if (value === 'all') {
						this.state.channelVideoLimit = '';
						limitInput.disabled = true;
					} else {
						this.state.channelVideoLimit = limitInput.value || '10';
						limitInput.value = this.state.channelVideoLimit;
						limitInput.disabled = false;
					}
				}))
			.addText((text) => {
				text
					.setPlaceholder(SETTING_COPY.channelItemsPerType.placeholder!)
					.setValue(this.state.channelVideoLimit || '10')
					.setDisabled(!this.state.channelVideoLimit)
					.onChange((value) => (this.state.channelVideoLimit = value));
				limitInput = text.inputEl;
				limitInput.type = 'number';
				limitInput.min = '1';
				limitInput.step = '1';
				limitInput.hidden = !this.state.channelVideoLimit;
			});
		limitSetting.settingEl.addClass('ytkn-modal__quick-full');
		limitSetting.settingEl.addClass('ytkn-channel-limit-setting');
		limitSetting.settingEl.toggleClass('ytkn-channel-limit-setting--unlimited', !this.state.channelVideoLimit);

		this.channelQuickSettingEls = [contentSetting.settingEl, limitSetting.settingEl];
	}

	private createSection(containerEl: HTMLElement, title: string): HTMLElement {
		const section = containerEl.createDiv({ cls: 'ytkn-modal__section' });
		const header = section.createDiv({ cls: 'ytkn-modal__section-header' });
		const iconEl = header.createSpan({ cls: 'ytkn-modal__section-icon' });
		setIcon(iconEl, 'zap');
		header.createEl('h3', {
			text: title,
			cls: 'ytkn-modal__section-title',
		});
		return section;
	}

	private renderGeneralTab(containerEl: HTMLElement): void {
		createSettingsCard(containerEl, 'Note structure', (body) => this.renderNoteCustomizationGroup(body), 'h4');
		createSettingsCard(containerEl, 'Transcript in note', (body) => this.renderTranscriptInNoteGroup(body), 'h4');
		createSettingsCard(containerEl, 'Playlists, channels, and reports', (body) => this.renderCollectionsAndReportsGroup(body), 'h4');
	}

	private renderNoteCustomizationGroup(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(SETTING_COPY.mediaEmbed.name)
			.setDesc(SETTING_COPY.mediaEmbed.desc!)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SETTING_COPY.mediaEmbed.options!)
					.setValue(this.state.mediaEmbedMode)
					.onChange((v) => (this.state.mediaEmbedMode = v as MediaEmbedMode)),
			);

		new Setting(containerEl)
			.setName(SETTING_COPY.useVideoTitleAsNoteName.name)
			.setDesc(SETTING_COPY.useVideoTitleAsNoteName.desc!)
			.addToggle((toggle) =>
				toggle
					.setValue(this.state.useVideoTitleAsNoteName)
					.onChange((v) => (this.state.useVideoTitleAsNoteName = v)),
			);

		new Setting(containerEl)
			.setName(SETTING_COPY.includeFrontmatter.name)
			.setDesc(SETTING_COPY.includeFrontmatter.desc!)
			.addToggle((toggle) =>
				toggle.setValue(this.state.includeFrontmatter).onChange((v) => {
					this.state.includeFrontmatter = v;
					this.refreshFrontmatterVisibility();
				}),
			);

		const stretchInput = (settingEl: HTMLElement) => {
			settingEl.addClass('ytkn-modal__stretch-input');
		};

		const tagsSettingEl = new Setting(containerEl)
			.setName(SETTING_COPY.frontmatterTags.name)
			.setDesc(SETTING_COPY.frontmatterTags.desc!)
			.addText((text) => {
				text
					.setPlaceholder(SETTING_COPY.frontmatterTags.placeholder!)
					.setValue(this.state.frontmatterTags)
					.onChange((v) => (this.state.frontmatterTags = v));
			}).settingEl;
		stretchInput(tagsSettingEl);
		this.frontmatterTagsSettingEl = tagsSettingEl;

		const allowlistSettingEl = new Setting(containerEl)
			.setName(SETTING_COPY.frontmatterProperties.name)
			.setDesc(SETTING_COPY.frontmatterProperties.desc!)
			.addText((text) => {
				text
					.setPlaceholder(SETTING_COPY.frontmatterProperties.placeholder!)
					.setValue(this.state.frontmatterPropertyAllowlist)
					.onChange((value) => {
						this.state.frontmatterPropertyAllowlist = value;
					});
			}).settingEl;
		stretchInput(allowlistSettingEl);
		this.frontmatterPropertyAllowlistSettingEl = allowlistSettingEl;

		new Setting(containerEl)
			.setName(SETTING_COPY.sourceMetadataPosition.name)
			.setDesc(SETTING_COPY.sourceMetadataPosition.desc!)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SETTING_COPY.sourceMetadataPosition.options!)
					.setValue(this.state.sourceSectionPosition)
					.onChange(
						(v: string) => (this.state.sourceSectionPosition = v as SourceSectionPosition),
					),
			);
	}

	private renderTranscriptInNoteGroup(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(SETTING_COPY.transcriptInNote.name)
			.setDesc(SETTING_COPY.transcriptInNote.desc!)
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(SETTING_COPY.transcriptInNote.options!)
					.setValue(this.state.transcriptMode)
					.onChange((value) => {
						this.state.transcriptMode = value as TranscriptMode;
						if (this.quickTranscriptModeSelectEl) {
							this.quickTranscriptModeSelectEl.value = value;
						}
					});
				this.advancedTranscriptModeSelectEl = dropdown.selectEl;
			});

		new Setting(containerEl)
			.setName(SETTING_COPY.linkTimestamps.name)
			.setDesc(SETTING_COPY.linkTimestamps.desc!)
			.addToggle((toggle) =>
				toggle
					.setValue(this.state.linkTimestamps)
					.onChange((v) => (this.state.linkTimestamps = v)),
			);

		new Setting(containerEl)
			.setName(SETTING_COPY.transcriptLanguage.name)
			.setDesc(SETTING_COPY.transcriptLanguage.desc!)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SETTING_COPY.transcriptLanguage.options!)
					.setValue(this.state.transcriptLanguageMode)
					.onChange((v) => {
						this.state.transcriptLanguageMode = v as TranscriptLanguageMode;
						this.refreshPlaylistVisibility();
					}),
			);

		const langSetting = new Setting(containerEl)
			.setName(SETTING_COPY.preferredLanguageCode.name)
			.setDesc(SETTING_COPY.preferredLanguageCode.desc!)
			.addText((text) =>
				text
					.setPlaceholder(SETTING_COPY.preferredLanguageCode.placeholder!)
					.setValue(this.state.preferredTranscriptLanguage)
					.onChange((v) => (this.state.preferredTranscriptLanguage = v)),
			);
		this.preferredLangSettingEl = langSetting.settingEl;
	}

	private renderCollectionsAndReportsGroup(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(SETTING_COPY.transcriptFailure.name)
			.setDesc(SETTING_COPY.transcriptFailure.desc!)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SETTING_COPY.transcriptFailure.options!)
					.setValue(this.state.transcriptFailureMode)
					.onChange((v) => {
						this.state.transcriptFailureMode = v as TranscriptFailureMode;
					}),
			);

		new Setting(containerEl)
			.setName(SETTING_COPY.includeReport.name)
			.setDesc(SETTING_COPY.includeReport.desc!)
			.addToggle((toggle) =>
				toggle.setValue(this.state.includeReport).onChange((v) => {
					this.state.includeReport = v;
					this.refreshPlaylistVisibility();
				}),
			);

		const reportLocation = new Setting(containerEl)
			.setName(SETTING_COPY.reportLocation.name)
			.setDesc(SETTING_COPY.reportLocation.desc!)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SETTING_COPY.reportLocation.options!)
					.setValue(this.state.reportLocation)
					.onChange((v) => {
						this.state.reportLocation = v as ReportLocation;
					}),
			);
		this.perVideoReportSettingEl = reportLocation.settingEl;
	}

	private renderGenAiTab(containerEl: HTMLElement): void {
		createSettingsCard(containerEl, 'AI setup', (body) => this.renderAiGroup(body), 'h4');
	}

	private renderAiGroup(containerEl: HTMLElement): void {
		const chainHeading = new Setting(containerEl)
			.setName(SETTING_COPY.aiModels.name)
			.setDesc(this.availableModels.length ? SETTING_COPY.aiModels.desc : SETTING_COPY.aiModels.unavailableDesc);
		chainHeading.settingEl.addClass('ytkn-modal__model-setting');

		const chainRowsEl = containerEl.createDiv({ cls: 'ytkn-modal__model-chain' });
		const renderChain = (): void => {
			chainRowsEl.empty();
			renderModelChainRows(chainRowsEl, {
				availableModels: this.availableModels,
				modelIds: this.state.modelIds,
				onChange: (next) => {
					this.state.modelIds = next;
					renderChain();
				},
			});
		};
		renderChain();
		this.aiModelSettingEl = chainHeading.settingEl;
		this.aiModelChainEl = chainRowsEl;

		this.temperatureSettingEl = new Setting(containerEl)
			.setName(SETTING_COPY.temperature.name)
			.setDesc(SETTING_COPY.temperature.desc!)
			.addText((text) => {
				text.setValue(this.state.temperature).onChange(
					(v) => (this.state.temperature = v),
				);
				text.inputEl.type = 'number';
				text.inputEl.min = '0';
				text.inputEl.max = '2';
				text.inputEl.step = '0.1';
			}).settingEl;

		this.requestTimeoutSettingEl = new Setting(containerEl)
			.setName(SETTING_COPY.requestTimeout.name)
			.setDesc(SETTING_COPY.requestTimeout.desc!)
			.addText((text) => {
				text.setValue(this.state.requestTimeoutSeconds).onChange(
					(v) => (this.state.requestTimeoutSeconds = v),
				);
				text.inputEl.type = 'number';
				text.inputEl.min = '5';
				text.inputEl.step = '30';
			}).settingEl;
	}

	private updateTemplateSubtitle(): void {
		const choice = findTemplateChoice(this.state.instructionTemplate);
		if (!choice) return;

		this.templateSubtitleEl?.setText(choice.subtitle);
	}

	private renderControlsArea(controls: ControlDeclaration[]): void {
		if (!this.controlsAreaEl) {
			return;
		}
		this.controlsAreaEl.empty();
		renderTemplateControls(
			this.controlsAreaEl,
			controls,
			this.state.controlValues,
			(id, val) => { this.state.controlValues = { ...this.state.controlValues, [id]: val }; },
		);
	}

	private updateControlsArea(): void {
		if (!this.controlsAreaEl) {
			return;
		}

		const shouldShow =
			this.state.useAi &&
			this.state.generateAiSummary &&
			this.state.instructionMode === 'template';

		if (!shouldShow) {
			this.controlsAreaEl.hide();
			return;
		}

		const controls = getTemplate(this.state.instructionTemplate).controls ?? [];
		if (!controls.length) {
			this.controlsAreaEl.hide();
			return;
		}

		this.controlsAreaEl.show();
		this.renderControlsArea(controls);
		stampSettingRowClasses(this.controlsAreaEl);
	}

	private renderActionRow(wrap: HTMLElement): void {
		const actions = wrap.createDiv({ cls: 'ytkn-modal__actions' });
		new Setting(actions)
			.addButton((button) =>
				button
					.setButtonText('Generate')
					.setCta()
					.onClick(() => this.submit()),
			);
	}

	private refreshAiVisibility(): void {
		const showSummaryControls = this.state.useAi && this.state.generateAiSummary;

		this.aiSummarySettingEl?.toggle(this.state.useAi);
		this.instructionSettingEl?.toggle(showSummaryControls);
		this.tldrCalloutSettingEl?.toggle(this.state.useAi);
		this.mindmapSettingEl?.toggle(this.state.useAi);
		this.memorableQuotesSettingEl?.toggle(this.state.useAi);
		this.aiSectionDividerEl?.toggle(this.state.useAi);
		this.aiModelSettingEl?.toggle(this.state.useAi);
		this.aiModelChainEl?.toggle(this.state.useAi);
		this.temperatureSettingEl?.toggle(this.state.useAi);
		this.requestTimeoutSettingEl?.toggle(this.state.useAi);

		if (this.templateSettingEl) {
			this.templateSettingEl.toggle(
				showSummaryControls &&
				this.state.instructionMode === 'template',
			);
		}
		if (this.templateSubtitleEl) {
			this.templateSubtitleEl.toggle(
				showSummaryControls &&
				this.state.instructionMode === 'template',
			);
		}
		if (this.manualSettingEl) {
			this.manualSettingEl.toggle(
				showSummaryControls &&
				this.state.instructionMode === 'manual',
			);
		}

		this.updateControlsArea();
	}

	private refreshDestinationVisibility(): void {
		if (this.state.noteDestinationMode === 'folder') {
			this.folderSettingEl?.show();
			this.openCreatedNoteSettingEl?.show();
		} else {
			this.folderSettingEl?.hide();
			this.openCreatedNoteSettingEl?.hide();
		}
	}

	private refreshFrontmatterVisibility(): void {
		this.frontmatterTagsSettingEl?.toggle(this.state.includeFrontmatter);
		this.frontmatterPropertyAllowlistSettingEl?.toggle(this.state.includeFrontmatter);
	}

	private refreshPlaylistVisibility(): void {
		if (this.preferredLangSettingEl) {
			this.preferredLangSettingEl.toggle(
				this.state.transcriptLanguageMode === 'preferred',
			);
		}
		if (this.perVideoReportSettingEl) {
			this.perVideoReportSettingEl.toggle(this.state.includeReport);
		}
	}

	private submit(): void {
		const result = buildGenerationSubmit(this.state);
		if (result.duplicateCount > 0) {
			new Notice(`Removed ${result.duplicateCount} duplicate URL${result.duplicateCount > 1 ? 's' : ''}.`);
		}
		if (!result.ok) {
			new Notice(result.message);
			return;
		}

		this.onSubmit(result.urls, result.options);
		this.close();
	}

	private getBrandActions() {
		const queueActions = this.onOpenQueue
			? [{
				id: 'manage-queue',
				label: 'Manage queue',
				icon: 'list-todo',
				onClick: this.onOpenQueue,
			}]
			: [];

		return [
			...queueActions,
			{
				id: 'sponsor',
				label: 'Sponsor',
				icon: 'heart-handshake',
				href: SUPPORT_LINKS.githubSponsors,
			},
			{
				id: 'buy-me-a-coffee',
				label: 'Buy Me a Coffee',
				icon: 'coffee',
				href: SUPPORT_LINKS.buyMeACoffee,
			},
			{
				id: 'about',
				label: 'About YT Knowledge Notes',
				icon: 'info',
				onClick: () => {
					new WhatsNewModal(
						this.app,
						this.currentVersion,
						getRecentReleaseNotes(),
					).open();
				},
			},
		];
	}
}
