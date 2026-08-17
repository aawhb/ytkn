import type { App, ExtraButtonComponent } from 'obsidian';
import { Modal, Notice, Platform, Setting, SettingGroup, setIcon } from 'obsidian';
import { SETTINGS_TABS, TabGroup } from '../shared/tabs';
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
import { SUPPORT_LINKS } from '../../releaseNotes';
import { WhatsNewModal } from '../releaseNotes/whatsNewModal';
import {
	ADDITIONAL_SECTION_IDS,
	GENERATION_OPTIONS_SCHEMA as OPTIONS,
	type AdditionalSectionId,
} from '../shared/generationOptionsSchema';
import {
	renderCheckboxGroupControl,
	renderChannelContentControl,
	type ChannelContentControl,
} from '../shared/checkboxGroupControl';
import { ModelPickerModal } from '../shared/modelPickerModal';
import { buildModelId } from '../../modelId';

export class GenerationOptionsModal extends Modal {
	private state!: GenerationFormState;
	private activeTabId: string = 'general';
	private instructionSettingEl?: HTMLElement;
	private aiSummarySettingEl?: HTMLElement;
	private templateSettingEl?: HTMLElement;
	private templateSubtitleEl?: HTMLElement;
	private manualSettingEl?: HTMLElement;
	private aiModelGroupEl?: HTMLElement;
	private generationParametersGroupEl?: HTMLElement;
	private folderSettingEl?: HTMLElement;
	private openCreatedNoteSettingEl?: HTMLElement;
	private playlistQuickSettingEl?: HTMLElement;
	private channelQuickSettingEls: HTMLElement[] = [];
	private channelContentControl?: ChannelContentControl;
	private lastExplicitChannelTabKey: string | null = null;
	private perVideoReportSettingEl?: HTMLElement;
	private preferredLangSettingEl?: HTMLElement;
	private linkTimestampsSettingEl?: HTMLElement;
	private additionalSectionsSettingEl?: HTMLElement;
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
		const brandCopy = brand.createDiv({ cls: 'ytkn-modal__brand-copy ytkn-brand-copy' });
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

		const aiPanel = tabGroup.getPanel('ai');
		if (aiPanel) {
			this.renderAiTab(aiPanel);
		}

		this.syncPlaylistContextVisibility();
		this.refreshAiVisibility();
		this.refreshDestinationVisibility();
		this.refreshPlaylistVisibility();
		this.refreshFrontmatterVisibility();
		this.refreshTranscriptVisibility();
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
		this.channelContentControl?.setValue(this.state.channelContentTypes);
	}

	private renderQuickArea(wrap: HTMLElement): void {
		const section = this.createSection(wrap, 'Quick setup');
		section.addClass('ytkn-modal__quick-card');

		const quickTop = section.createDiv({ cls: 'ytkn-modal__quick-top' });
		const urlZone = quickTop.createDiv({ cls: 'ytkn-modal__quick-top-url' });
		const toggleZone = quickTop.createDiv({ cls: 'ytkn-modal__quick-top-toggle' });
		new Setting(toggleZone)
			.setName(OPTIONS.useAi.name)
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
			.setName(OPTIONS.aiSummary.name)
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

		const instructionSetting = new Setting(quickGrid)
			.setName(OPTIONS.instructionStyle.name)
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(OPTIONS.instructionStyle.options)
					.setValue(this.state.instructionMode)
					.onChange((value) => {
						this.state.instructionMode = value as InstructionMode;
						this.refreshAiVisibility();
					});
			});
		this.instructionSettingEl = instructionSetting.settingEl;

		const templateSetting = new Setting(quickGrid)
			.setName(OPTIONS.contentTemplate.name)
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
			cls: 'ytkn-modal__helper-text ytkn-modal__quick-full',
		});
		this.templateSubtitleEl = templateSubtitle;
		this.updateTemplateSubtitle();

		const controlsArea = quickGrid.createDiv({ cls: 'ytkn-modal__controls-area ytkn-modal__quick-full' });
		this.controlsAreaEl = controlsArea;
		this.updateControlsArea();

		const manualSetting = new Setting(quickGrid)
			.setName(OPTIONS.manualInstructions.name)
			.addTextArea((text) => {
				text.setPlaceholder(OPTIONS.manualInstructions.placeholder)
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
		manualSetting.settingEl.addClass('ytkn-control-row--textarea');

		this.renderAdditionalSections(quickGrid);

		this.aiSectionDividerEl = quickGrid.createDiv({ cls: 'ytkn-modal__quick-divider' });

		new Setting(quickGrid)
			.setName(OPTIONS.outputDestination.name)
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(OPTIONS.outputDestination.options)
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
			.setName(OPTIONS.transcriptInNote.name)
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(OPTIONS.transcriptInNote.options)
					.setValue(this.state.transcriptMode)
					.onChange((value) => {
						this.state.transcriptMode = value as TranscriptMode;
						if (this.advancedTranscriptModeSelectEl) {
							this.advancedTranscriptModeSelectEl.value = value;
						}
						this.refreshTranscriptVisibility();
					});
				this.quickTranscriptModeSelectEl = dropdown.selectEl;
			});

		const folderSettingEl = new Setting(quickGrid)
			.setName(OPTIONS.destinationFolder.name)
			.addText((text) =>
				text
					.setPlaceholder(OPTIONS.destinationFolder.placeholder)
					.setValue(this.state.noteDestinationFolder)
					.onChange((v) => (this.state.noteDestinationFolder = v)),
			).settingEl;
		folderSettingEl.addClass('ytkn-modal__input-only');
		folderSettingEl.addClass('ytkn-modal__quick-full');
		this.folderSettingEl = folderSettingEl;

		const openCreatedNoteSettingEl = new Setting(quickGrid)
			.setName(OPTIONS.openCreatedNote.name)
			.addToggle((toggle) =>
				toggle
					.setValue(this.state.openCreatedNote)
					.onChange((v) => (this.state.openCreatedNote = v)),
			).settingEl;
		openCreatedNoteSettingEl.addClass('ytkn-modal__quick-full');
		this.openCreatedNoteSettingEl = openCreatedNoteSettingEl;

		const playlistSetting = new Setting(quickGrid)
			.setName(OPTIONS.playlistHandling.name)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(OPTIONS.playlistHandling.options)
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

	private renderAdditionalSections(containerEl: HTMLElement): void {
		const setting = new Setting(containerEl);
		setting.infoEl.remove();
		setting.settingEl.addClass('ytkn-modal__quick-full');
		this.additionalSectionsSettingEl = setting.settingEl;
		renderCheckboxGroupControl(setting, {
			value: this.getSelectedAdditionalSections(),
			order: ADDITIONAL_SECTION_IDS,
			labels: OPTIONS.additionalSections.options,
			onChange: (value) => {
				this.state.tldrCalloutAtTop = value.includes('tldr');
				this.state.includeMindmap = value.includes('mind-map');
				this.state.includeMemorableQuotes = value.includes('memorable-quotes');
			},
		});
	}

	private getSelectedAdditionalSections(): AdditionalSectionId[] {
		return ADDITIONAL_SECTION_IDS.filter((section) => {
			switch (section) {
				case 'tldr': return this.state.tldrCalloutAtTop;
				case 'mind-map': return this.state.includeMindmap;
				case 'memorable-quotes': return this.state.includeMemorableQuotes;
			}
		});
	}

	private renderChannelControls(containerEl: HTMLElement): void {
		const contentSetting = new Setting(containerEl)
			.setName(OPTIONS.channelContent.name);
		contentSetting.settingEl.addClass('ytkn-modal__quick-full');
		this.channelContentControl = renderChannelContentControl(contentSetting, {
			value: this.state.channelContentTypes,
			labels: OPTIONS.channelContent.options,
			onChange: (value) => {
				this.state.channelContentTypes = value;
			},
		});

		let limitInput: HTMLInputElement;
		const limitSetting = new Setting(containerEl)
			.setName(OPTIONS.channelItemsPerType.name)
			.addDropdown((dropdown) => dropdown
				.addOptions(OPTIONS.channelItemsPerType.options)
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
					.setPlaceholder(OPTIONS.channelItemsPerType.placeholder)
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
		const section = containerEl.createDiv();
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
		const noteFormatGroup = new SettingGroup(containerEl)
			.setHeading('Note format')
			.addClass('ytkn-settings__section-card');
		this.renderNoteCustomizationGroup(noteFormatGroup.listEl);

		const transcriptGroup = new SettingGroup(containerEl)
			.setHeading('Transcript')
			.addClass('ytkn-settings__section-card');
		this.renderTranscriptInNoteGroup(transcriptGroup.listEl);

		const collectionsGroup = new SettingGroup(containerEl)
			.setHeading('Playlists and channels')
			.addClass('ytkn-settings__section-card');
		this.renderCollectionsGroup(collectionsGroup.listEl);

		const reportsGroup = new SettingGroup(containerEl)
			.setHeading('Reports')
			.addClass('ytkn-settings__section-card');
		this.renderReportsGroup(reportsGroup.listEl);
	}

	private renderNoteCustomizationGroup(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(OPTIONS.mediaEmbed.name)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(OPTIONS.mediaEmbed.options)
					.setValue(this.state.mediaEmbedMode)
					.onChange((v) => (this.state.mediaEmbedMode = v as MediaEmbedMode)),
			);

		new Setting(containerEl)
			.setName(OPTIONS.useVideoTitleAsNoteName.name)
			.addToggle((toggle) =>
				toggle
					.setValue(this.state.useVideoTitleAsNoteName)
					.onChange((v) => (this.state.useVideoTitleAsNoteName = v)),
			);

		new Setting(containerEl)
			.setName(OPTIONS.includeFrontmatter.name)
			.addToggle((toggle) =>
				toggle.setValue(this.state.includeFrontmatter).onChange((v) => {
					this.state.includeFrontmatter = v;
					this.refreshFrontmatterVisibility();
				}),
			);

		const tagsSettingEl = new Setting(containerEl)
			.setName(OPTIONS.frontmatterTags.name)
			.addText((text) => {
				text
					.setPlaceholder(OPTIONS.frontmatterTags.placeholder)
					.setValue(this.state.frontmatterTags)
					.onChange((v) => (this.state.frontmatterTags = v));
			}).settingEl;
		this.frontmatterTagsSettingEl = tagsSettingEl;

		const allowlistSettingEl = new Setting(containerEl)
			.setName(OPTIONS.frontmatterProperties.name)
			.addTextArea((text) => {
				text
					.setPlaceholder(OPTIONS.frontmatterProperties.placeholder)
					.setValue(this.state.frontmatterPropertyAllowlist)
					.onChange((value) => {
						this.state.frontmatterPropertyAllowlist = value;
					});
				text.inputEl.rows = 3;
			}).settingEl;
		allowlistSettingEl.addClass('ytkn-control-row--textarea');
		this.frontmatterPropertyAllowlistSettingEl = allowlistSettingEl;

		new Setting(containerEl)
			.setName(OPTIONS.sourceMetadataPosition.name)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(OPTIONS.sourceMetadataPosition.options)
					.setValue(this.state.sourceSectionPosition)
					.onChange(
						(v: string) => (this.state.sourceSectionPosition = v as SourceSectionPosition),
					),
			);
	}

	private renderTranscriptInNoteGroup(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(OPTIONS.transcriptInNote.name)
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(OPTIONS.transcriptInNote.options)
					.setValue(this.state.transcriptMode)
					.onChange((value) => {
						this.state.transcriptMode = value as TranscriptMode;
						if (this.quickTranscriptModeSelectEl) {
							this.quickTranscriptModeSelectEl.value = value;
						}
						this.refreshTranscriptVisibility();
					});
				this.advancedTranscriptModeSelectEl = dropdown.selectEl;
			});

		const linkTimestampsSetting = new Setting(containerEl)
			.setName(OPTIONS.linkTimestamps.name)
			.addToggle((toggle) =>
				toggle
					.setValue(this.state.linkTimestamps)
					.onChange((v) => (this.state.linkTimestamps = v)),
			);
		this.linkTimestampsSettingEl = linkTimestampsSetting.settingEl;

		new Setting(containerEl)
			.setName(OPTIONS.transcriptLanguage.name)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(OPTIONS.transcriptLanguage.options)
					.setValue(this.state.transcriptLanguageMode)
					.onChange((v) => {
						this.state.transcriptLanguageMode = v as TranscriptLanguageMode;
						this.refreshPlaylistVisibility();
					}),
			);

		const langSetting = new Setting(containerEl)
			.setName(OPTIONS.preferredLanguageCode.name)
			.addText((text) =>
				text
					.setPlaceholder(OPTIONS.preferredLanguageCode.placeholder)
					.setValue(this.state.preferredTranscriptLanguage)
					.onChange((v) => (this.state.preferredTranscriptLanguage = v)),
			);
		this.preferredLangSettingEl = langSetting.settingEl;
	}

	private renderCollectionsGroup(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(OPTIONS.transcriptFailure.name)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(OPTIONS.transcriptFailure.options)
					.setValue(this.state.transcriptFailureMode)
					.onChange((v) => {
						this.state.transcriptFailureMode = v as TranscriptFailureMode;
					}),
			);
	}

	private renderReportsGroup(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(OPTIONS.includeReport.name)
			.addToggle((toggle) =>
				toggle.setValue(this.state.includeReport).onChange((v) => {
					this.state.includeReport = v;
					this.refreshPlaylistVisibility();
				}),
			);

		const reportLocation = new Setting(containerEl)
			.setName(OPTIONS.reportLocation.name)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(OPTIONS.reportLocation.options)
					.setValue(this.state.reportLocation)
					.onChange((v) => {
						this.state.reportLocation = v as ReportLocation;
					}),
			);
		this.perVideoReportSettingEl = reportLocation.settingEl;
	}

	private renderAiTab(containerEl: HTMLElement): void {
		this.renderModelOrderGroup(containerEl);
		this.renderGenerationParametersGroup(containerEl);
	}

	private renderModelOrderGroup(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl)
			.setHeading(OPTIONS.modelOrder.name)
			.addClass(
				'ytkn-settings__section-card',
				'ytkn-settings__native-list',
			);
		this.aiModelGroupEl = group.listEl.parentElement ?? group.listEl;

		let addButton: ExtraButtonComponent | undefined;
		const renderChain = (): void => {
			group.listEl.empty();
			const selectedModels = this.state.modelIds.filter((modelId) =>
				this.availableModels.some((model) => buildModelId(model) === modelId),
			);
			if (!selectedModels.length) {
				new Setting(group.listEl)
					.setName(this.availableModels.length ? 'No models selected.' : OPTIONS.modelOrder.unavailableDesc);
			} else {
				renderModelChainRows(group.listEl, {
				availableModels: this.availableModels,
				modelIds: this.state.modelIds,
				onChange: (next) => {
					this.state.modelIds = next;
					renderChain();
				},
				});
			}
			addButton?.setDisabled(this.getUnselectedModels().length === 0);
		};
		group.addExtraButton((button) => {
			addButton = button;
			button
				.setIcon('plus')
				.setTooltip(OPTIONS.modelOrder.addLabel)
				.onClick(() => {
					const remaining = this.getUnselectedModels();
					if (!remaining.length) return;
					new ModelPickerModal(this.app, remaining, async (modelId) => {
						this.state.modelIds = [...this.state.modelIds, modelId];
						renderChain();
					}).open();
				});
		});
		renderChain();
	}

	private renderGenerationParametersGroup(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl)
			.setHeading('Generation parameters')
			.addClass('ytkn-settings__section-card');
		this.generationParametersGroupEl = group.listEl.parentElement ?? group.listEl;

		group
			.addSetting((setting) => {
				setting.setName(OPTIONS.temperature.name).addText((text) => {
					text.setValue(this.state.temperature).onChange(
						(v) => (this.state.temperature = v),
					);
					text.inputEl.type = 'number';
					text.inputEl.min = '0';
					text.inputEl.max = '2';
					text.inputEl.step = '0.1';
				});
			})
			.addSetting((setting) => {
				setting.setName(OPTIONS.requestTimeout.name).addText((text) => {
					text.setValue(this.state.requestTimeoutSeconds).onChange(
						(v) => (this.state.requestTimeoutSeconds = v),
					);
					text.inputEl.type = 'number';
					text.inputEl.min = '5';
					text.inputEl.step = '30';
				});
			});
	}

	private getUnselectedModels(): ModelConfig[] {
		const selected = new Set(this.state.modelIds);
		return this.availableModels.filter((model) => !selected.has(buildModelId(model)));
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
		this.additionalSectionsSettingEl?.toggle(this.state.useAi);
		this.aiSectionDividerEl?.toggle(this.state.useAi);
		this.aiModelGroupEl?.toggle(this.state.useAi);
		this.generationParametersGroupEl?.toggle(this.state.useAi);

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

	private refreshTranscriptVisibility(): void {
		this.linkTimestampsSettingEl?.toggle(this.state.transcriptMode === 'timestamped');
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
					new WhatsNewModal(this.app).open();
				},
			},
		];
	}
}
