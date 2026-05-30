import { App, Notice, PluginSettingTab, Setting, setIcon } from 'obsidian';
import {
	InstructionConfig,
	InstructionMode,
	InstructionTemplate,
	MediaEmbedMode,
	NoteDestinationMode,
	OutputDefaults,
	RunReportLocation,
	PlaylistMode,
	PluginSettings,
	SourceSectionPosition,
	TranscriptFailureMode,
	TranscriptLanguageMode,
	TranscriptMode,
} from '../types';
import {
	SettingsEventHandlers,
	UICallbacks,
} from './handlers/SettingsEventHandlers';
import { SettingsModalsFactory } from './modals/SettingsModalsFactory';
import {
	createSettingsCard,
	SettingsUIComponents,
} from './components/SettingsUIComponents';
import {
	DEFAULT_SETTINGS_TAB_ID,
	SETTINGS_TABS,
	TabGroup,
} from './components/Tabs';
import { ConfirmModal } from './modals/ConfirmModal';
import { YTKN } from '../main';
import { ACTIVE_MODEL_SELECT_CLASS } from '../defaults';
import {
	buildModelId,
	getErrorMessage,
} from '../utils';
import {
	findTemplateChoice,
	populateTemplateDropdown,
} from '../services/templates';
import { renderTemplateControls } from './components/TemplateControls';
import { stampSettingRowClasses } from './settingRows';

const RESTORE_DEFAULTS_LABEL = 'Restore defaults';

export class SettingsTab extends PluginSettingTab {
	private uiComponents: SettingsUIComponents;
	private eventHandlers: SettingsEventHandlers;
	private modals: SettingsModalsFactory;
	private activeTabId: string = DEFAULT_SETTINGS_TAB_ID;

	constructor(
		app: App,
		private plugin: YTKN,
	) {
		super(app, plugin);
		this.uiComponents = new SettingsUIComponents(app);

		const callbacks: UICallbacks = {
			onModelAdded: () => this.reload(),
			onModelDeleted: () => this.reload(),
			onModelUpdated: () => this.reload(),
			onProviderAdded: () => this.reload(),
			onProviderDeleted: () => this.reload(),
			onProviderUpdated: () => this.reload(),
			onProviderModelsFetched: () => this.reload(),
			onSettingsReset: () => this.reload(),
			onActiveModelChanged: () => this.reload(),
		};

		this.modals = new SettingsModalsFactory(app);
		this.eventHandlers = new SettingsEventHandlers(
			plugin,
			this.modals,
			callbacks,
		);
	}

	private get settings(): PluginSettings {
		return this.plugin.settings;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('ytkn-settings');

		const intro = containerEl.createDiv({ cls: 'ytkn-settings__intro' });
		const headerWrap = intro.createDiv({ cls: 'ytkn-settings__intro-header' });

		const introIcon = headerWrap.createDiv({ cls: 'ytkn-brand-mark' });
		setIcon(introIcon, 'play');

		const introCopy = headerWrap.createDiv({ cls: 'ytkn-settings__intro-copy' });
		const introTitle = new Setting(introCopy)
			.setName(this.plugin.manifest?.name ?? 'YT Knowledge Notes')
			.setHeading();
		introTitle.settingEl.addClass('ytkn-settings__intro-title');
		introCopy.createEl('p', {
			cls: 'ytkn-settings__intro-desc',
			text: 'Turn videos into structured notes with AI',
		});

		const tabGroup = new TabGroup(
			containerEl,
			SETTINGS_TABS,
			this.activeTabId,
			(tabId) => {
				this.activeTabId = tabId;
			},
		);

		const generalPanel = tabGroup.getPanel('general');
		if (generalPanel) {
			this.displayGeneralTab(generalPanel);
		}

		const genAiPanel = tabGroup.getPanel('genai');
		if (genAiPanel) {
			this.displayGenAiTab(genAiPanel);
		}

		this.displayResetSetting(containerEl);
		stampSettingRowClasses(containerEl);
	}

	private displayGeneralTab(containerEl: HTMLElement): void {
		createSettingsCard(containerEl, 'Output destination', (body) =>
			this.displayDestinationSection(body),
		);
		createSettingsCard(containerEl, 'Note structure', (body) =>
			this.displayNoteContentSection(body),
		);
		createSettingsCard(containerEl, 'Transcript in note', (body) =>
			this.displayTranscriptInNoteSection(body),
		);
		createSettingsCard(containerEl, 'Queue and run reports', (body) =>
			this.displayQueueAndRunReportsSection(body),
		);
	}

	private displayGenAiTab(containerEl: HTMLElement): void {
		createSettingsCard(containerEl, 'Generation defaults', (body) =>
			this.displayGenAiDefaultsSection(body),
		);
		createSettingsCard(containerEl, 'AI setup', (body) => {
			this.displayAiProvidersSection(body);
			this.displayAdvancedModelTuningSection(body);
		});
	}

	private displayAiProvidersSection(containerEl: HTMLElement): void {
		const availableModels = this.settings.getModels();
		const selectedModel = this.settings.getSelectedModel();
		const selectedModelId = selectedModel ? buildModelId(selectedModel) : null;
		const providers = this.settings.getProviders();

		const providersSetting = new Setting(containerEl)
			.setName('Configured providers')
			.setDesc(
				'Add an OpenAI, Anthropic, Gemini, or an OpenAI-compatible endpoint.',
			)
			.addButton((button) =>
				button
					.setButtonText('Add provider')
					.setCta()
					.onClick(() => {
						this.modals
							.createAddProviderModal(this.eventHandlers)
							.open();
					}),
			);
		providersSetting.settingEl.addClass('ytkn-settings__providers-header');

		if (!providers.length) {
			containerEl.createDiv({
				cls: 'ytkn-settings__empty-panel',
				text: 'No AI providers yet.',
			});
		} else {
			const accordionsContainer = containerEl.createDiv({
				cls: 'ytkn-settings__provider-accordions',
			});

			for (const provider of providers) {
				this.uiComponents.addProviderAccordion(
					accordionsContainer,
					provider,
					this.eventHandlers,
				);
			}
		}

		new Setting(containerEl)
			.setName('Default AI model')
			.setDesc(
				availableModels.length
					? 'Used by every generation unless overridden per run.'
					: 'Add a provider and at least one model to enable AI generation.',
			)
			.addDropdown((dropdown) => {
				dropdown.selectEl.addClass(ACTIVE_MODEL_SELECT_CLASS);
				if (!availableModels.length) {
					dropdown.addOption('', 'No models available').setValue('');
					dropdown.setDisabled(true);
					return;
				}

				const options: Record<string, string> = {};
				for (const model of availableModels) {
					const displayText = model.displayName || model.name;
					options[buildModelId(model)] =
						`${model.provider.name} / ${displayText}`;
				}

				dropdown
					.addOptions(options)
					.setValue(selectedModelId ?? '')
					.onChange(async (value) => {
						await this.eventHandlers.handleModelSelection(value);
					});
			});
	}

	private displayNoteContentSection(containerEl: HTMLElement): void {
		const outputDefaults = this.settings.getOutputDefaults();

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
					.setValue(outputDefaults.mediaEmbedMode)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							mediaEmbedMode: value as MediaEmbedMode,
						});
					}),
			);

		new Setting(containerEl)
			.setName('Use video title as note title')
			.setDesc(
				'Renames the destination note to the video\'s title after generation. Applies to single-URL "insert at caret" runs and all "folder" destination runs. Multi-URL editor-target batches never rename to avoid breaking subsequent runs.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(outputDefaults.useVideoTitleAsNoteName)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							useVideoTitleAsNoteName: value,
						});
					}),
			);

		new Setting(containerEl)
			.setName('Include frontmatter')
			.setDesc(
				'Add a YAML frontmatter block (title, channel, video URL, generated, …) so the note works with properties, Dataview, and search.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(outputDefaults.includeFrontmatter)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							includeFrontmatter: value,
						});
						this.reload();
					}),
			);

		if (outputDefaults.includeFrontmatter) {
			new Setting(containerEl)
				.setName('Frontmatter tags')
				.setDesc(
					'Comma- or space-separated tags added to the frontmatter. Example: YouTube, AI/summary',
				)
				.addText((text) =>
					text
						.setPlaceholder('YouTube, AI/summary')
						.setValue(outputDefaults.frontmatterTags)
						.onChange(async (value) => {
							await this.updateOutputDefaults({
								frontmatterTags: value,
							});
						}),
				);

			new Setting(containerEl)
				.setName('Frontmatter properties')
				.setDesc(
					'Space- or comma-separated list of property keys the plugin will write. Remove a key to suppress it. Allowed keys: title, aliases, source, channel, channelUrl, channelId, videoUrl, playlistUrl, videoId, playlistId, thumbnailUrl, videoDescription, durationSeconds, keywords, generated, videoCount.',
				)
				.addText((text) =>
					text
						.setPlaceholder('Title channel channelUrl videoId …')
						.setValue(outputDefaults.frontmatterPropertyAllowlist)
						.onChange(async (value) => {
							await this.updateOutputDefaults({
								frontmatterPropertyAllowlist: value,
							});
						}),
				);
		}

		new Setting(containerEl)
			.setName('Source metadata position')
			.setDesc(
				'Render the source block (title, channel, URL) above or below the AI summary.',
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						top: 'Top',
						bottom: 'Bottom',
					})
					.setValue(outputDefaults.sourceSectionPosition)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							sourceSectionPosition: value as SourceSectionPosition,
						});
					}),
			);
	}

	private displayDestinationSection(containerEl: HTMLElement): void {
		const outputDefaults = this.settings.getOutputDefaults();

		new Setting(containerEl)
			.setName('Default destination')
			.setDesc('Use the current note or create new notes in a folder.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						'current-note': 'Current note',
						'append-to-active-note': 'Append to active note',
						folder: 'Folder',
					})
					.setValue(outputDefaults.noteDestinationMode)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							noteDestinationMode: value as NoteDestinationMode,
						});
						this.reload();
					}),
			);

		new Setting(containerEl)
			.setName('Folder for new notes')
			.setDesc(
				'Created automatically if it does not exist. Vault root if left empty (not recommended).',
			)
			.addText((text) =>
				text
					.setPlaceholder('YouTube notes')
					.setValue(outputDefaults.noteDestinationFolder)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							noteDestinationFolder: value,
						});
					}),
			);
	}

	private displayTranscriptInNoteSection(containerEl: HTMLElement): void {
		const outputDefaults = this.settings.getOutputDefaults();

		new Setting(containerEl)
			.setName('Transcript in note')
			.setDesc('How transcript content appears in the generated note.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						none: 'Off',
						'readable': 'Readable',
						'timestamped': 'Timestamped',
					})
					.setValue(outputDefaults.transcriptMode)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							transcriptMode: value as TranscriptMode,
						});
					}),
			);

		new Setting(containerEl)
			.setName('Link timestamps to YouTube')
			.setDesc(
				'When using the timestamped transcript, wrap each timestamp as a deep-link to the video at that time.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(outputDefaults.linkTimestamps)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							linkTimestamps: value,
						});
					}),
			);

		new Setting(containerEl)
			.setName('Transcript language')
			.setDesc(
				'Auto picks any available transcript. Preferred tries your language first, then falls back.',
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						auto: 'Auto-detect best available',
						preferred: 'Preferred language with fallback',
					})
					.setValue(outputDefaults.transcriptLanguageMode)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							transcriptLanguageMode: value as TranscriptLanguageMode,
						});
						this.reload();
					}),
			);

		if (outputDefaults.transcriptLanguageMode === 'preferred') {
			new Setting(containerEl)
				.setName('Preferred language code')
				.setDesc(
					'Used when transcript language is set to preferred. Example: en, hi, fr.',
				)
				.addText((text) =>
					text
						.setPlaceholder('En')
						.setValue(outputDefaults.preferredTranscriptLanguage)
						.onChange(async (value) => {
							await this.updateOutputDefaults({
								preferredTranscriptLanguage: value,
							});
						}),
				);
		}
	}

	private displayQueueAndRunReportsSection(containerEl: HTMLElement): void {
		const outputDefaults = this.settings.getOutputDefaults();

		new Setting(containerEl)
			.setName('Playlist handling')
			.setDesc(
				'Create a single combined note for the whole playlist, or one note per video.',
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						'per-video': 'Per video: multiple individual notes',
						combined: 'Combined: single aggregated note',
					})
					.setValue(outputDefaults.playlistMode)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							playlistMode: value as PlaylistMode,
						});
					}),
			);

		new Setting(containerEl)
			.setName('When a transcript fails')
			.setDesc('Skip the video with a missing transcript, or stop the entire run.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						skip: 'Skip and keep going',
						fail: 'Stop the whole run',
					})
					.setValue(outputDefaults.transcriptFailureMode)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							transcriptFailureMode: value as TranscriptFailureMode,
						});
					}),
			);

		new Setting(containerEl)
			.setName('Include run report')
			.setDesc(
				'Add a collapsible report listing completed, skipped, failed, and canceled runs after each batch.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(outputDefaults.includeRunReport)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							includeRunReport: value,
						});
						this.reload();
					}),
			);

		if (outputDefaults.includeRunReport) {
			new Setting(containerEl)
				.setName('Run report location')
				.setDesc(
					'Where to put the run report after all generations in a batch complete.',
				)
				.addDropdown((dropdown) =>
					dropdown
						.addOptions({
							'generated-note': 'Generated note',
							'separate-note': 'Separate report note',
						})
						.setValue(outputDefaults.runReportLocation)
						.onChange(async (value) => {
							await this.updateOutputDefaults({
								runReportLocation: value as RunReportLocation,
							});
						}),
				);
		}
	}

	private displayGenAiDefaultsSection(containerEl: HTMLElement): void {
		const outputDefaults = this.settings.getOutputDefaults();
		new Setting(containerEl)
			.setName('Generate AI summary by default')
			.setDesc('Off = transcript-only notes when transcript inclusion is enabled.')
			.addToggle((toggle) =>
				toggle
					.setValue(outputDefaults.generateAiSummary)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							generateAiSummary: value,
						});
					}),
			);

		this.displayInstructionConfigSection(
			containerEl,
			this.settings.getInstructionConfig(),
		);
	}

	private displayAdvancedModelTuningSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Temperature')
			.setDesc('If supported by the provider; 0 = deterministic. 0.3 (default) = focused. 1 = more varied.')
			.addText((text) => {
				text.setPlaceholder('0.3')
					.setValue(String(this.settings.getTemperature()))
					.onChange(async (value) => {
						await this.settings.updateTemperature(Number(value));
					});
				text.inputEl.type = 'number';
				text.inputEl.min = '0';
				text.inputEl.max = '2';
				text.inputEl.step = '0.1';
			});

		new Setting(containerEl)
			.setName('Request timeout (seconds)')
			.setDesc(
				'Increase for slow local models or long runs. 300 = 5 minutes.',
			)
			.addText((text) => {
				const seconds = Math.round(this.settings.getRequestTimeoutMs() / 1000);
				text.setPlaceholder('300')
					.setValue(String(seconds))
					.onChange(async (value) => {
						const parsed = Number(value);
						if (!Number.isFinite(parsed) || parsed <= 0) {
							return;
						}
						await this.settings.updateRequestTimeoutMs(
							Math.round(parsed * 1000),
						);
					});
				text.inputEl.type = 'number';
				text.inputEl.min = '5';
			});
	}

	private displayResetSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(RESTORE_DEFAULTS_LABEL)
			.setDesc(
				'Removes all providers, models, secret selections, and per-feature defaults. Saved obsidian secrets are not deleted.',
			)
			.addButton((button) =>
				button
					.setButtonText(RESTORE_DEFAULTS_LABEL)
					.setWarning()
					.onClick(() => {
						this.resetSettings();
					}),
			);
	}

	private displayInstructionConfigSection(
		containerEl: HTMLElement,
		instructionConfig: InstructionConfig,
	): void {
		new Setting(containerEl)
			.setName('Instruction style')
			.setDesc(
				'Pick a built-in template or write your own instructions for the AI.',
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						template: 'Built-in template',
						manual: 'Fully manual',
					})
					.setValue(instructionConfig.mode)
					.onChange(async (value) => {
						await this.updateInstructionConfig({
							...instructionConfig,
							mode: value as InstructionMode,
						});
						this.reload();
					}),
			);

		if (instructionConfig.mode === 'template') {
			const choice = findTemplateChoice(instructionConfig.template);
			const templateCard = containerEl.createDiv({ cls: 'ytkn-settings__template-card' });

			new Setting(templateCard)
				.setName('Default content template')
				.addDropdown((dropdown) => {
					populateTemplateDropdown(dropdown.selectEl);
					dropdown
						.setValue(instructionConfig.template)
						.onChange(async (value) => {
							await this.updateInstructionConfig({
								...instructionConfig,
								template: value as InstructionTemplate,
							});
							this.reload();
						});
				});
			if (choice) {
				templateCard.createEl('p', {
					cls: 'ytkn-settings__template-description',
					text: choice.subtitle,
				});
			}

			if (choice && (choice.controls?.length ?? 0) > 0) {
				renderTemplateControls(templateCard, choice.controls!, instructionConfig.controlValues ?? {}, (id, val) => {
					void this.updateInstructionConfig({
						...instructionConfig,
						controlValues: { ...instructionConfig.controlValues, [id]: val },
					}).then(() => this.reload());
				});
			}

			if (choice) {
				const previewWrap = templateCard.createDiv({ cls: 'ytkn-settings__collapsible' });
				const previewDetails = previewWrap.createEl('details');
				previewDetails.createEl('summary', { text: 'Show preview' });
				const previewBox = previewDetails.createDiv({ cls: 'ytkn-settings__template-preview' });
				renderTemplatePreview(previewBox, choice.body);
			}
		} else {
			new Setting(containerEl)
				.setName('Manual instructions')
				.setDesc(
					'Custom prompt. The video metadata block is still added automatically.',
				)
				.addTextArea((text) =>
					text
						.setPlaceholder('You are an assistant that extracts ...')
						.setValue(instructionConfig.manualInstructions)
						.onChange(async (value) => {
							await this.updateInstructionConfig({
								...instructionConfig,
								manualInstructions: value,
							});
						})
						.then((textArea) => {
							textArea.inputEl.addClass(
								'ytkn-settings__summary-prompt',
							);
						}),
				);
		}

		const outputDefaults = this.settings.getOutputDefaults();

		new Setting(containerEl)
			.setName('Add summary callout')
			.setDesc(
				'Tl;dr section in a summary callout',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(outputDefaults.tldrCalloutAtTop)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							tldrCalloutAtTop: value,
						});
					}),
			);

		new Setting(containerEl)
			.setName('Add mermaid mindmap')
			.setDesc(
				'Adds a final `## Mindmap` section with a Mermaid mindmap, independent of the selected template.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(instructionConfig.includeMindmap)
					.onChange(async (value) => {
						await this.updateInstructionConfig({
							...instructionConfig,
							includeMindmap: value,
						});
					}),
			);

		new Setting(containerEl)
			.setName('Add memorable quotes')
			.setDesc(
				'Adds a final `## Memorable quotes` section with 3–7 verbatim quotes. Independent of the selected template.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(instructionConfig.includeMemorableQuotes)
					.onChange(async (value) => {
						await this.updateInstructionConfig({
							...instructionConfig,
							includeMemorableQuotes: value,
						});
					}),
			);

	}

	private async updateOutputDefaults(
		patch: Partial<OutputDefaults>,
	): Promise<void> {
		await this.settings.updateOutputDefaults({
			...this.settings.getOutputDefaults(),
			...patch,
		});
	}

	private async updateInstructionConfig(
		config: InstructionConfig,
	): Promise<void> {
		await this.settings.updateInstructionConfig(config);
	}

	private resetSettings(): void {
		new ConfirmModal(
			this.app,
			'Restore default settings?',
			'This removes all providers, models, secret selections, and per-feature defaults. Saved obsidian secrets and generated notes already in your vault are not touched.',
			RESTORE_DEFAULTS_LABEL,
			async () => {
				try {
					await this.eventHandlers.handleResetSettings();
					new Notice('Settings restored to defaults.');
				} catch (error) {
					new Notice(
						`Could not restore defaults: ${getErrorMessage(error)}`,
					);
				}
			},
		).open();
	}

	private reload(): void {
		const openedAccordion = this.containerEl.querySelector(
			'.ytkn-settings__provider-accordion.is-expanded',
		);
		const openedProviderName =
			openedAccordion?.getAttribute('data-provider-name') ?? null;

		this.display();

		if (openedProviderName) {
			this.containerEl
				.querySelector(`[data-provider-name="${openedProviderName}"]`)
				?.addClass('is-expanded');
		}
	}
}

function renderTemplatePreview(host: HTMLElement, body: string): void {
	const previewLines = body
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.startsWith('## ') || line.startsWith('- '));

	for (const line of previewLines) {
		if (line.startsWith('## ')) {
			host.createDiv({
				cls: 'ytkn-settings__template-preview-h2',
				text: line.replace('##', '').trim(),
			});
		} else {
			host.createDiv({
				cls: 'ytkn-settings__template-preview-li',
				text: `• ${line.replace('- ', '').trim()}`,
			});
		}
	}
}
