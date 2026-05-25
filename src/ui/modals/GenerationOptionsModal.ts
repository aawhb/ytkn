import { App, Modal, Notice, Setting, setIcon } from 'obsidian';
import { SETTINGS_TABS, TabGroup } from '../components/Tabs';
import { createSettingsCard } from '../components/SettingsUIComponents';
import { renderTemplateControls } from '../components/TemplateControls';
import {
	ControlDeclaration,
	GenerationOptions,
	InstructionMode,
	InstructionTemplate,
	MediaEmbedMode,
	ModelConfig,
	NoteDestinationMode,
	RunReportLocation,
	PlaylistMode,
	SourceSectionPosition,
	TranscriptFailureMode,
	TranscriptLanguageMode,
	TranscriptMode,
} from '../../types';
import {
	DEFAULT_GENERATE_AI_SUMMARY,
	DEFAULT_INCLUDE_FRONTMATTER,
	DEFAULT_INCLUDE_MEMORABLE_QUOTES,
	DEFAULT_INCLUDE_MINDMAP,
	DEFAULT_INCLUDE_RUN_REPORT,
	DEFAULT_INSTRUCTION_MODE,
	DEFAULT_INSTRUCTION_TEMPLATE,
	DEFAULT_LINK_TIMESTAMPS,
	DEFAULT_MEDIA_EMBED_MODE,
	DEFAULT_NOTE_DESTINATION_MODE,
	DEFAULT_OUTPUT_TRANSCRIPT_MODE,
	DEFAULT_RUN_REPORT_LOCATION,
	DEFAULT_PLAYLIST_MODE,
	DEFAULT_SOURCE_SECTION_POSITION,
	DEFAULT_TEMPERATURE,
	DEFAULT_TLDR_CALLOUT_AT_TOP,
	DEFAULT_TRANSCRIPT_FAILURE_MODE,
	DEFAULT_TRANSCRIPT_LANGUAGE_MODE,
	DEFAULT_USE_VIDEO_TITLE_AS_NOTE_NAME,
} from '../../defaults';
import { buildModelId } from '../../utils';
import { YouTubeService } from '../../services/youtube';
import {
	findTemplateChoice,
	getTemplate,
	populateTemplateDropdown,
} from '../../services/templates';
import { stampSettingRowClasses } from '../settingRows';

interface FormState {
	url: string;
	generateAiSummary: boolean;
	transcriptMode: TranscriptMode;
	playlistMode: PlaylistMode;
	transcriptLanguageMode: TranscriptLanguageMode;
	preferredTranscriptLanguage: string;
	transcriptFailureMode: TranscriptFailureMode;
	mediaEmbedMode: MediaEmbedMode;
	includeRunReport: boolean;
	runReportLocation: RunReportLocation;
	useVideoTitleAsNoteName: boolean;
	noteDestinationMode: NoteDestinationMode;
	noteDestinationFolder: string;
	includeFrontmatter: boolean;
	frontmatterTags: string;
	frontmatterPropertyAllowlist: string;
	sourceSectionPosition: SourceSectionPosition;
	linkTimestamps: boolean;
	tldrCalloutAtTop: boolean;
	modelId: string;
	instructionMode: InstructionMode;
	instructionTemplate: InstructionTemplate;
	manualInstructions: string;
	includeMindmap: boolean;
	includeMemorableQuotes: boolean;
	temperature: string;
	requestTimeoutSeconds: string;
	controlValues: Record<string, string>;
}

function controlDefaultToString(value: unknown): string {
	if (value === undefined || value === null) {
		return '';
	}
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return `${value}`;
	}
	return JSON.stringify(value) ?? '';
}

export class GenerationOptionsModal extends Modal {
	private state!: FormState;
	private activeTabId: string = 'general';
	private instructionSettingEl?: HTMLElement;
	private templateSettingEl?: HTMLElement;
	private templateSubtitleEl?: HTMLElement;
	private manualSettingEl?: HTMLElement;
	private folderSettingEl?: HTMLElement;
	private playlistQuickSettingEl?: HTMLElement;
	private perVideoReportSettingEl?: HTMLElement;
	private preferredLangSettingEl?: HTMLElement;
	private tldrCalloutSettingEl?: HTMLElement;
	private mindmapSettingEl?: HTMLElement;
	private memorableQuotesSettingEl?: HTMLElement;
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
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ytkn-modal-scroll-container');

		this.state = this.buildInitialState();

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

		const brand = headerWrap.createDiv({ cls: 'ytkn-modal__brand' });
		const brandIcon = brand.createDiv({ cls: 'ytkn-brand-mark' });
		setIcon(brandIcon, 'play');
		const brandCopy = brand.createDiv({ cls: 'ytkn-modal__brand-copy' });
		brandCopy.createEl('h2', {
			text: 'YT Knowledge Notes',
			cls: 'ytkn-modal__title ytkn-modal__title--inline',
		});
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

	private buildInitialState(): FormState {
		const init = this.initialOptions;
		const instructionTemplate = init.instructionTemplate ?? DEFAULT_INSTRUCTION_TEMPLATE;
		const controlValues: Record<string, string> = { ...(init.controlValues ?? {}) };
		for (const control of getTemplate(instructionTemplate).controls ?? []) {
			if (controlValues[control.id] === undefined && control.default !== undefined) {
				controlValues[control.id] = controlDefaultToString(control.default);
			}
		}

		return {
			url: this.initialUrl,
			generateAiSummary: init.generateAiSummary ?? DEFAULT_GENERATE_AI_SUMMARY,
			transcriptMode: init.transcriptMode ?? DEFAULT_OUTPUT_TRANSCRIPT_MODE,
			playlistMode: init.playlistMode ?? DEFAULT_PLAYLIST_MODE,
			transcriptLanguageMode: init.transcriptLanguageMode ?? DEFAULT_TRANSCRIPT_LANGUAGE_MODE,
			preferredTranscriptLanguage: init.preferredTranscriptLanguage ?? '',
			transcriptFailureMode: init.transcriptFailureMode ?? DEFAULT_TRANSCRIPT_FAILURE_MODE,
			mediaEmbedMode: init.mediaEmbedMode ?? DEFAULT_MEDIA_EMBED_MODE,
			includeRunReport: init.includeRunReport ?? DEFAULT_INCLUDE_RUN_REPORT,
			runReportLocation: init.runReportLocation ?? DEFAULT_RUN_REPORT_LOCATION,
			useVideoTitleAsNoteName: init.useVideoTitleAsNoteName ?? DEFAULT_USE_VIDEO_TITLE_AS_NOTE_NAME,
			noteDestinationMode: this.hasActiveNote
				? (init.noteDestinationMode ?? DEFAULT_NOTE_DESTINATION_MODE)
				: 'folder',
			noteDestinationFolder: init.noteDestinationFolder ?? '',
			includeFrontmatter: init.includeFrontmatter ?? DEFAULT_INCLUDE_FRONTMATTER,
			frontmatterTags: init.frontmatterTags ?? '',
			frontmatterPropertyAllowlist: init.frontmatterPropertyAllowlist ?? '',
			sourceSectionPosition: init.sourceSectionPosition ?? DEFAULT_SOURCE_SECTION_POSITION,
			linkTimestamps: init.linkTimestamps ?? DEFAULT_LINK_TIMESTAMPS,
			tldrCalloutAtTop: init.tldrCalloutAtTop ?? DEFAULT_TLDR_CALLOUT_AT_TOP,
			modelId: init.modelId ?? (this.availableModels[0] ? buildModelId(this.availableModels[0]) : ''),
			instructionMode: init.instructionMode ?? DEFAULT_INSTRUCTION_MODE,
			instructionTemplate,
			manualInstructions: init.manualInstructions ?? '',
			includeMindmap: init.includeMindmap ?? DEFAULT_INCLUDE_MINDMAP,
			includeMemorableQuotes: init.includeMemorableQuotes ?? DEFAULT_INCLUDE_MEMORABLE_QUOTES,
			temperature: String(init.temperature ?? DEFAULT_TEMPERATURE),
			requestTimeoutSeconds: String(init.requestTimeoutMs != null ? Math.round(init.requestTimeoutMs / 1000) : ''),
			controlValues,
		};
	}

	private renderSourceField(urlContainer: HTMLElement, hintContainer: HTMLElement): void {
		const urlSetting = new Setting(urlContainer).addTextArea((textarea) => {
			textarea.setPlaceholder('URL(s)')
				.setValue(this.state.url)
				.onChange((value) => {
					this.state.url = value;
					this.autoGrowUrlField(textarea.inputEl);
					this.setHint(playlistHintEl);
				});
			textarea.inputEl.addClass('ytkn__input');
			textarea.inputEl.addClass('ytkn-modal__url-input');
			textarea.inputEl.rows = 1;
			textarea.inputEl.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
					e.preventDefault();
					this.submit();
				}
			});
			window.setTimeout(() => textarea.inputEl.focus(), 0);
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

		const urls = YouTubeService.parseUrls(trimmed);
		if (urls.length > 1) {
			const classifications = YouTubeService.classifyUrls(urls);
			const videos = classifications.filter((c) => c === 'video').length;
			const playlists = classifications.filter((c) => c === 'playlist').length;
			const invalid = classifications.filter((c) => c === 'invalid').length;
			const parts: string[] = [];
			if (videos > 0) parts.push(`${videos} video${videos > 1 ? 's' : ''}`);
			if (playlists > 0) parts.push(`${playlists} playlist${playlists > 1 ? 's' : ''}`);
			if (invalid > 0) parts.push(`${invalid} invalid`);
			hintEl.setText(`${urls.length} URLs detected: ${parts.join(', ')}.`);
			hintEl.show();
		} else {
			const isPlaylist = YouTubeService.isPlaylistUrl(trimmed);
			if (isPlaylist) {
				hintEl.setText('Playlist detected. Combined mode requires AI summary.');
				hintEl.show();
			} else if (YouTubeService.isYouTubeUrl(trimmed)) {
				hintEl.setText('Single video detected.');
				hintEl.show();
			} else {
				hintEl.setText('URL does not look like a YouTube link.');
				hintEl.show();
			}
		}

		this.syncPlaylistContextVisibility();
	}

	private syncPlaylistContextVisibility(): void {
		const isPlaylist = YouTubeService.isPlaylistUrl(this.state.url.trim());
		this.playlistQuickSettingEl?.toggle(isPlaylist);
	}

	private renderQuickArea(wrap: HTMLElement): void {
		const section = this.createSection(wrap, 'Quick setup');
		section.addClass('ytkn-modal__quick-card');

		const quickTop = section.createDiv({ cls: 'ytkn-modal__quick-top' });
		const urlZone = quickTop.createDiv({ cls: 'ytkn-modal__quick-top-url' });
		const toggleZone = quickTop.createDiv({ cls: 'ytkn-modal__quick-top-toggle' });
		new Setting(toggleZone)
			.setName('AI summary')
			.addToggle((toggle) => {
				toggle
					.setValue(this.state.generateAiSummary)
					.onChange((value) => {
						this.state.generateAiSummary = value;
						this.refreshAiVisibility();
					});
			})
			.settingEl.addClass('ytkn-modal__quick-toggle');

		this.renderSourceField(urlZone, section);

		const quickGrid = section.createDiv({ cls: 'ytkn-modal__quick-grid' });

		const instructionSetting = new Setting(quickGrid)
			.setName('Instruction style')
			.addDropdown((dropdown) => {
				dropdown
					.addOption('template', 'Built-in template')
					.addOption('manual', 'Manual prompt')
					.setValue(this.state.instructionMode)
					.onChange((value) => {
						this.state.instructionMode = value as InstructionMode;
						this.refreshAiVisibility();
					});
			});
		this.instructionSettingEl = instructionSetting.settingEl;

		const templateSetting = new Setting(quickGrid)
			.setName('Content template')
			.addDropdown((dropdown) => {
				populateTemplateDropdown(dropdown.selectEl);
				dropdown
					.setValue(this.state.instructionTemplate)
					.onChange((value) => {
						this.state.instructionTemplate = value as InstructionTemplate;
						// Reset control values to defaults for the new template
						this.state.controlValues = {};
						for (const control of getTemplate(this.state.instructionTemplate).controls ?? []) {
							if (control.default !== undefined) {
								this.state.controlValues[control.id] = controlDefaultToString(control.default);
							}
						}
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
			.setName('Manual prompt')
			.addTextArea((text) => {
				text.setPlaceholder('Provide specific instructions for the note...')
					.setValue(this.state.manualInstructions)
					.onChange((value) => {
						this.state.manualInstructions = value;
					});
				text.inputEl.rows = 4;
				text.inputEl.addClass('ytkn__input');
				text.inputEl.addClass('ytkn-modal__manual-prompt');
			});
		this.manualSettingEl = manualSetting.settingEl;
		manualSetting.settingEl.addClass('ytkn-modal__quick-full');

		const tldrCalloutSetting = new Setting(quickGrid)
			.setName('Add summary callout')
			.addToggle((toggle) =>
				toggle
					.setValue(this.state.tldrCalloutAtTop)
					.onChange((v) => (this.state.tldrCalloutAtTop = v)),
			);
		this.tldrCalloutSettingEl = tldrCalloutSetting.settingEl;
		tldrCalloutSetting.settingEl.addClass('ytkn-modal__quick-full');
		tldrCalloutSetting.settingEl.addClass('ytkn-modal__tldr-callout-setting');

		const mindmapSetting = new Setting(quickGrid)
			.setName('Add mermaid mindmap')
			.addToggle((toggle) =>
				toggle
					.setValue(this.state.includeMindmap)
					.onChange((v) => (this.state.includeMindmap = v)),
			);
		this.mindmapSettingEl = mindmapSetting.settingEl;
		mindmapSetting.settingEl.addClass('ytkn-modal__quick-full');

		const memorableQuotesSetting = new Setting(quickGrid)
			.setName('Add memorable quotes')
			.addToggle((toggle) =>
				toggle
					.setValue(this.state.includeMemorableQuotes)
					.onChange((v) => (this.state.includeMemorableQuotes = v)),
			);
		this.memorableQuotesSettingEl = memorableQuotesSetting.settingEl;
		memorableQuotesSetting.settingEl.addClass('ytkn-modal__quick-full');

		quickGrid.createDiv({ cls: 'ytkn-modal__quick-divider' });

		new Setting(quickGrid)
			.setName('Output destination')
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({
						'current-note': 'Insert at caret',
						'append-to-active-note': 'Append to active note',
						folder: 'Create new note',
					})
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
			.setName('Transcript in note')
			.addDropdown((dropdown) => {
				dropdown
					.addOption('none', 'Off')
					.addOption('readable', 'Readable')
					.addOption('timestamped', 'Timestamped')
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
			.setName('Destination folder')
			.addText((text) =>
				text
					.setPlaceholder('Inbox or folder/subfolder')
					.setValue(this.state.noteDestinationFolder)
					.onChange((v) => (this.state.noteDestinationFolder = v)),
			).settingEl;
		folderSettingEl.addClass('ytkn-modal__input-only');
		folderSettingEl.addClass('ytkn-modal__quick-full');
		this.folderSettingEl = folderSettingEl;

		const playlistSetting = new Setting(quickGrid)
			.setName('Playlist handling')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						'per-video': 'Individual notes (per video)',
						combined: 'Combined note (all videos)',
					})
					.setValue(this.state.playlistMode)
					.onChange((v) => {
						this.state.playlistMode = v as PlaylistMode;
						this.refreshPlaylistVisibility();
					}),
			);
		this.playlistQuickSettingEl = playlistSetting.settingEl;
		playlistSetting.settingEl.addClass('ytkn-modal__quick-full');
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
		createSettingsCard(containerEl, 'Queue and run reports', (body) => this.renderQueueAndRunReportsGroup(body), 'h4');
	}

	private renderNoteCustomizationGroup(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Media embed')
			.setDesc('Embed the YouTube video, thumbnail, or no media near the top of the note.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						video: 'Video',
						thumbnail: 'Thumbnail',
						none: 'Off',
					})
					.setValue(this.state.mediaEmbedMode)
					.onChange((v) => (this.state.mediaEmbedMode = v as MediaEmbedMode)),
			);

		new Setting(containerEl)
			.setName('Use video title as note title')
			.setDesc('Renames the destination note to the video\'s title after generation. Applies to single-URL "insert at caret" runs and all "folder" destination runs. Multi-URL editor-target batches never rename to avoid breaking subsequent runs.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.state.useVideoTitleAsNoteName)
					.onChange((v) => (this.state.useVideoTitleAsNoteName = v)),
			);

		new Setting(containerEl)
			.setName('Include frontmatter')
			.setDesc('Add a YAML frontmatter block (title, channel, video URL, generated, …) so the note works with properties, Dataview, and search.')
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
			.setName('Frontmatter tags')
			.setDesc('Comma- or space-separated tags added to the frontmatter. Example: YouTube, AI/summary')
			.addText((text) => {
				text
					.setPlaceholder('YouTube, AI/summary')
					.setValue(this.state.frontmatterTags)
					.onChange((v) => (this.state.frontmatterTags = v));
			}).settingEl;
		stretchInput(tagsSettingEl);
		this.frontmatterTagsSettingEl = tagsSettingEl;

		const allowlistSettingEl = new Setting(containerEl)
			.setName('Frontmatter properties')
			.setDesc('Space- or comma-separated list of property keys the plugin will write. Remove a key to suppress it. Allowed keys: title, aliases, source, channel, channelUrl, videoUrl, playlistUrl, videoId, playlistId, generated, videoCount.')
			.addText((text) => {
				text
					.setPlaceholder('Title channel channelUrl videoId …')
					.setValue(this.state.frontmatterPropertyAllowlist)
					.onChange((value) => {
						this.state.frontmatterPropertyAllowlist = value;
					});
			}).settingEl;
		stretchInput(allowlistSettingEl);
		this.frontmatterPropertyAllowlistSettingEl = allowlistSettingEl;

		new Setting(containerEl)
			.setName('Source metadata position')
			.setDesc('Render the source block (title, channel, URL) above or below the AI summary.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						top: 'Top',
						bottom: 'Bottom',
					})
					.setValue(this.state.sourceSectionPosition)
					.onChange(
						(v: string) => (this.state.sourceSectionPosition = v as SourceSectionPosition),
					),
			);
	}

	private renderTranscriptInNoteGroup(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Transcript in note')
			.setDesc('How transcript content appears in the generated note.')
			.addDropdown((dropdown) => {
				dropdown
					.addOption('none', 'Off')
					.addOption('readable', 'Readable')
					.addOption('timestamped', 'Timestamped')
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
			.setName('Link timestamps to YouTube')
			.setDesc('When using the timestamped transcript, wrap each timestamp as a deep-link to the video at that time.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.state.linkTimestamps)
					.onChange((v) => (this.state.linkTimestamps = v)),
			);

		new Setting(containerEl)
			.setName('Transcript language')
			.setDesc('Auto picks any available transcript. Preferred tries your language first, then falls back.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						auto: 'Auto-detect best available',
						preferred: 'Preferred language with fallback',
					})
					.setValue(this.state.transcriptLanguageMode)
					.onChange((v) => {
						this.state.transcriptLanguageMode = v as TranscriptLanguageMode;
						this.refreshPlaylistVisibility();
					}),
			);

		const langSetting = new Setting(containerEl)
			.setName('Preferred language code')
			.setDesc('Used when transcript language is set to preferred. Example: en, hi, fr.')
			.addText((text) =>
				text
					.setPlaceholder('En, es, etc.')
					.setValue(this.state.preferredTranscriptLanguage)
					.onChange((v) => (this.state.preferredTranscriptLanguage = v)),
			);
		this.preferredLangSettingEl = langSetting.settingEl;
	}

	private renderQueueAndRunReportsGroup(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('When a transcript fails')
			.setDesc('Skip the video with a missing transcript, or stop the entire run.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						skip: 'Skip and keep going',
						fail: 'Stop the whole run',
					})
					.setValue(this.state.transcriptFailureMode)
					.onChange((v) => {
						this.state.transcriptFailureMode = v as TranscriptFailureMode;
					}),
			);

		new Setting(containerEl)
			.setName('Include run report')
			.setDesc('Add a collapsible report listing completed, skipped, failed, and canceled runs after each batch.')
			.addToggle((toggle) =>
				toggle.setValue(this.state.includeRunReport).onChange((v) => {
					this.state.includeRunReport = v;
					this.refreshPlaylistVisibility();
				}),
			);

		const runReport = new Setting(containerEl)
			.setName('Run report location')
			.setDesc('Where to put the run report after all generations in a batch complete.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						'generated-note': 'Generated note',
						'separate-note': 'Separate report note',
					})
					.setValue(this.state.runReportLocation)
					.onChange((v) => {
						this.state.runReportLocation = v as RunReportLocation;
					}),
			);
		this.perVideoReportSettingEl = runReport.settingEl;
	}

	private renderGenAiTab(containerEl: HTMLElement): void {
		createSettingsCard(containerEl, 'AI setup', (body) => this.renderAiGroup(body), 'h4');
	}

	private renderAiGroup(containerEl: HTMLElement): void {
		const modelSetting = new Setting(containerEl)
			.setName('AI model')
			.addDropdown((dropdown) => {
				if (!this.availableModels.length) {
					dropdown.addOption('', 'No models available').setValue('');
					dropdown.setDisabled(true);
					return;
				}

				const options: Record<string, string> = {
					'': 'Plugin Default',
				};

				for (const model of this.availableModels) {
					const displayName = model.displayName || model.name;
					options[buildModelId(model)] = `${model.provider.name} / ${displayName}`;
				}

				dropdown
					.addOptions(options)
					.setValue(this.state.modelId)
					.onChange((v) => {
						this.state.modelId = v;
						this.refreshAiVisibility();
					});
			});
		modelSetting.settingEl.addClass('ytkn-modal__model-setting');

		new Setting(containerEl)
			.setName('Temperature')
			.setDesc('If supported by the provider; 0 = deterministic. 0.3 (default) = focused. 1 = more varied.')
			.addText((text) => {
				text.setValue(this.state.temperature).onChange(
					(v) => (this.state.temperature = v),
				);
				text.inputEl.type = 'number';
				text.inputEl.min = '0';
				text.inputEl.max = '2';
				text.inputEl.step = '0.1';
			});

		new Setting(containerEl)
			.setName('Request timeout (seconds)')
			.setDesc('Increase for slow local models or long runs. 300 = 5 minutes.')
			.addText((text) => {
				text.setValue(this.state.requestTimeoutSeconds).onChange(
					(v) => (this.state.requestTimeoutSeconds = v),
				);
				text.inputEl.type = 'number';
				text.inputEl.min = '5';
				text.inputEl.step = '30';
			});
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
				button.setButtonText('Cancel').onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText('Generate')
					.setCta()
					.onClick(() => this.submit()),
			);
	}

	private getSelectedModel(): ModelConfig | null {
		if (!this.state.modelId) return null;
		return (
			this.availableModels.find(
				(model) => buildModelId(model) === this.state.modelId,
			) ?? null
		);
	}

	private refreshAiVisibility(): void {
		this.instructionSettingEl?.toggle(this.state.generateAiSummary);
		this.tldrCalloutSettingEl?.toggle(this.state.generateAiSummary);
		this.mindmapSettingEl?.toggle(this.state.generateAiSummary);
		this.memorableQuotesSettingEl?.toggle(this.state.generateAiSummary);

		if (this.templateSettingEl) {
			this.templateSettingEl.toggle(
				this.state.generateAiSummary &&
				this.state.instructionMode === 'template',
			);
		}
		if (this.templateSubtitleEl) {
			this.templateSubtitleEl.toggle(
				this.state.generateAiSummary &&
				this.state.instructionMode === 'template',
			);
		}
		if (this.manualSettingEl) {
			this.manualSettingEl.toggle(
				this.state.generateAiSummary &&
				this.state.instructionMode === 'manual',
			);
		}

		this.updateControlsArea();
	}

	private refreshDestinationVisibility(): void {
		if (this.state.noteDestinationMode === 'folder') {
			this.folderSettingEl?.show();
		} else {
			this.folderSettingEl?.hide();
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
			this.perVideoReportSettingEl.toggle(this.state.includeRunReport);
		}
	}

	private submit(): void {
		const trimmedUrl = this.state.url.trim();
		const parsedTemperature = Number(this.state.temperature.trim());
		const parsedTimeoutSecs = this.state.requestTimeoutSeconds.trim() ? Number(this.state.requestTimeoutSeconds.trim()) : undefined;
		const trimmedManualInstructions = this.state.manualInstructions.trim();
		const trimmedFolder = this.state.noteDestinationFolder.trim();

		if (!trimmedUrl) {
			new Notice('Paste a YouTube video or playlist URL to continue.');
			return;
		}

		const parsedUrls = YouTubeService.parseUrls(trimmedUrl);
		const seen = new Set<string>();
		const urls: string[] = [];
		for (const url of parsedUrls) {
			if (!seen.has(url)) {
				seen.add(url);
				urls.push(url);
			}
		}
		const dropped = parsedUrls.length - urls.length;
		if (dropped > 0) {
			new Notice(`Removed ${dropped} duplicate URL${dropped > 1 ? 's' : ''}.`);
		}

		if (
			!Number.isFinite(parsedTemperature) ||
			parsedTemperature < 0 ||
			parsedTemperature > 2
		) {
			new Notice('Temperature must be between 0 and 2.');
			return;
		}

		if (this.state.noteDestinationMode === 'folder' && !trimmedFolder) {
			new Notice('Enter a destination folder, or switch to "current note".');
			return;
		}

		if (
			!this.state.generateAiSummary &&
			this.state.transcriptMode === 'none'
		) {
			new Notice('Enable transcript inclusion or AI summary — both cannot be off.');
			return;
		}

		if (
			!this.state.generateAiSummary &&
			this.state.playlistMode === 'combined' &&
			urls.some((u) => YouTubeService.isPlaylistUrl(u))
		) {
			new Notice('Combined playlist notes require AI summary. Switch to per-video for transcript-only runs.');
			return;
		}

		if (this.state.generateAiSummary && !this.state.modelId) {
			new Notice('Select an AI model, or turn off AI summary for transcript-only output.');
			return;
		}

		if (
			this.state.generateAiSummary &&
			this.state.instructionMode === 'manual' &&
			!trimmedManualInstructions
		) {
			new Notice('Enter manual instructions, or switch back to a built-in template.');
			return;
		}

		if (
			this.state.generateAiSummary &&
			this.state.instructionMode === 'template'
		) {
			for (const control of getTemplate(this.state.instructionTemplate).controls ?? []) {
				if (control.required) {
					const v = this.state.controlValues[control.id];
					if (!v || !v.trim()) {
						new Notice(`"${control.label}" is required for this template. Please fill it in.`);
						return;
					}
				}
			}
		}

		this.onSubmit(urls, {
			generateAiSummary: this.state.generateAiSummary,
			transcriptMode: this.state.transcriptMode,
			playlistMode: this.state.playlistMode,
			transcriptLanguageMode: this.state.transcriptLanguageMode,
			preferredTranscriptLanguage: this.state.preferredTranscriptLanguage,
			transcriptFailureMode: this.state.transcriptFailureMode,
			mediaEmbedMode: this.state.mediaEmbedMode,
			includeRunReport: this.state.includeRunReport,
			runReportLocation: this.state.runReportLocation,
			useVideoTitleAsNoteName: this.state.useVideoTitleAsNoteName,
			noteDestinationMode: this.state.noteDestinationMode,
			noteDestinationFolder: this.state.noteDestinationFolder,
			includeFrontmatter: this.state.includeFrontmatter,
			frontmatterTags: this.state.frontmatterTags,
			frontmatterPropertyAllowlist: this.state.frontmatterPropertyAllowlist,
			sourceSectionPosition: this.state.sourceSectionPosition,
			linkTimestamps: this.state.linkTimestamps,
			tldrCalloutAtTop: this.state.tldrCalloutAtTop,
			modelId: this.state.modelId,
			instructionMode: this.state.instructionMode,
			instructionTemplate: this.state.instructionTemplate,
			manualInstructions: trimmedManualInstructions,
			includeMindmap: this.state.includeMindmap,
			includeMemorableQuotes: this.state.includeMemorableQuotes,
			controlValues: Object.keys(this.state.controlValues).length > 0
				? Object.fromEntries(
					Object.entries(this.state.controlValues).filter(([, v]) => v.trim() !== ''),
				)
				: undefined,
			temperature: parsedTemperature,
			...(Number.isFinite(parsedTimeoutSecs) && (parsedTimeoutSecs ?? 0) > 0 ? { requestTimeoutMs: Math.round((parsedTimeoutSecs ?? 0) * 1000) } : {}),
		});
		this.close();
	}
}
