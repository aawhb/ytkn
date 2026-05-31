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
import { renderBrandActions } from './components/BrandActions';
import {
	DEFAULT_SETTINGS_TAB_ID,
	SETTINGS_TABS,
	TabGroup,
} from './components/Tabs';
import { ConfirmModal } from './modals/ConfirmModal';
import { WhatsNewModal } from './modals/WhatsNewModal';
import { YTKN } from '../main';
import { ACTIVE_MODEL_SELECT_CLASS } from '../defaults';
import {
	SUPPORT_LINKS,
	getRecentReleaseNotes,
} from '../releaseNotes';
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
import { SETTING_COPY } from './settingCopy';

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
		const headerWrap = intro.createDiv({ cls: 'ytkn-settings__intro-header ytkn-brand-header ytkn-brand-header--settings' });

		const introIcon = headerWrap.createDiv({ cls: 'ytkn-brand-mark' });
		setIcon(introIcon, 'play');

		const introCopy = headerWrap.createDiv({ cls: 'ytkn-settings__intro-copy ytkn-brand-copy ytkn-brand-copy--settings' });
		const introTitle = new Setting(introCopy)
			.setName(this.plugin.manifest?.name ?? 'YT Knowledge Notes')
			.setHeading();
		introTitle.settingEl.addClass('ytkn-settings__intro-title');
		introTitle.settingEl.addClass('ytkn-brand-title-row');
		introTitle.settingEl.addClass('ytkn-brand-title-row--settings');
		introTitle.nameEl.addClass('ytkn-brand-title');
		renderBrandActions(introCopy, this.getBrandActions());

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

	private getBrandActions() {
		return [
			{
				id: 'manage-queue',
				label: 'Manage queue',
				icon: 'list-todo',
				onClick: () => this.plugin.openQueueModal(),
			},
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
				id: 'recent-updates',
				label: 'Recent updates',
				icon: 'history',
				onClick: () => {
					new WhatsNewModal(
						this.app,
						this.plugin.manifest.version,
						getRecentReleaseNotes(),
					).open();
				},
			},
		];
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
			.setName(SETTING_COPY.aiModel.name)
			.setDesc(
				availableModels.length
					? SETTING_COPY.aiModel.defaultDesc
					: SETTING_COPY.aiModel.unavailableDesc,
			)
			.addDropdown((dropdown) => {
				dropdown.selectEl.addClass(ACTIVE_MODEL_SELECT_CLASS);
				if (!availableModels.length) {
					dropdown.addOption('', SETTING_COPY.aiModel.noModelsOption).setValue('');
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
			.setName(SETTING_COPY.mediaEmbed.name)
			.setDesc(SETTING_COPY.mediaEmbed.desc!)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SETTING_COPY.mediaEmbed.options!)
					.setValue(outputDefaults.mediaEmbedMode)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							mediaEmbedMode: value as MediaEmbedMode,
						});
					}),
			);

		new Setting(containerEl)
			.setName(SETTING_COPY.useVideoTitleAsNoteName.name)
			.setDesc(SETTING_COPY.useVideoTitleAsNoteName.desc!)
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
			.setName(SETTING_COPY.includeFrontmatter.name)
			.setDesc(SETTING_COPY.includeFrontmatter.desc!)
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
				.setName(SETTING_COPY.frontmatterTags.name)
				.setDesc(SETTING_COPY.frontmatterTags.desc!)
				.addText((text) =>
					text
						.setPlaceholder(SETTING_COPY.frontmatterTags.placeholder!)
						.setValue(outputDefaults.frontmatterTags)
						.onChange(async (value) => {
							await this.updateOutputDefaults({
								frontmatterTags: value,
							});
						}),
				);

			new Setting(containerEl)
				.setName(SETTING_COPY.frontmatterProperties.name)
				.setDesc(SETTING_COPY.frontmatterProperties.desc!)
				.addText((text) =>
					text
						.setPlaceholder(SETTING_COPY.frontmatterProperties.placeholder!)
						.setValue(outputDefaults.frontmatterPropertyAllowlist)
						.onChange(async (value) => {
							await this.updateOutputDefaults({
								frontmatterPropertyAllowlist: value,
							});
						}),
				);
		}

		new Setting(containerEl)
			.setName(SETTING_COPY.sourceMetadataPosition.name)
			.setDesc(SETTING_COPY.sourceMetadataPosition.desc!)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SETTING_COPY.sourceMetadataPosition.options!)
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
			.setName(SETTING_COPY.outputDestination.name)
			.setDesc(SETTING_COPY.outputDestination.desc!)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SETTING_COPY.outputDestination.options!)
					.setValue(outputDefaults.noteDestinationMode)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							noteDestinationMode: value as NoteDestinationMode,
						});
						this.reload();
					}),
			);

		new Setting(containerEl)
			.setName(SETTING_COPY.destinationFolder.name)
			.setDesc(SETTING_COPY.destinationFolder.desc!)
			.addText((text) =>
				text
					.setPlaceholder(SETTING_COPY.destinationFolder.placeholder!)
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
			.setName(SETTING_COPY.transcriptInNote.name)
			.setDesc(SETTING_COPY.transcriptInNote.desc!)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SETTING_COPY.transcriptInNote.options!)
					.setValue(outputDefaults.transcriptMode)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							transcriptMode: value as TranscriptMode,
						});
					}),
			);

		new Setting(containerEl)
			.setName(SETTING_COPY.linkTimestamps.name)
			.setDesc(SETTING_COPY.linkTimestamps.desc!)
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
			.setName(SETTING_COPY.transcriptLanguage.name)
			.setDesc(SETTING_COPY.transcriptLanguage.desc!)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SETTING_COPY.transcriptLanguage.options!)
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
				.setName(SETTING_COPY.preferredLanguageCode.name)
				.setDesc(SETTING_COPY.preferredLanguageCode.desc!)
				.addText((text) =>
					text
						.setPlaceholder(SETTING_COPY.preferredLanguageCode.placeholder!)
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
			.setName(SETTING_COPY.playlistHandling.name)
			.setDesc(SETTING_COPY.playlistHandling.desc!)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SETTING_COPY.playlistHandling.options!)
					.setValue(outputDefaults.playlistMode)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							playlistMode: value as PlaylistMode,
						});
					}),
			);

		new Setting(containerEl)
			.setName(SETTING_COPY.transcriptFailure.name)
			.setDesc(SETTING_COPY.transcriptFailure.desc!)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SETTING_COPY.transcriptFailure.options!)
					.setValue(outputDefaults.transcriptFailureMode)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							transcriptFailureMode: value as TranscriptFailureMode,
						});
					}),
			);

		new Setting(containerEl)
			.setName(SETTING_COPY.includeRunReport.name)
			.setDesc(SETTING_COPY.includeRunReport.desc!)
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
				.setName(SETTING_COPY.runReportLocation.name)
				.setDesc(SETTING_COPY.runReportLocation.desc!)
				.addDropdown((dropdown) =>
					dropdown
						.addOptions(SETTING_COPY.runReportLocation.options!)
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
			.setName(SETTING_COPY.useAi.name)
			.setDesc(SETTING_COPY.useAi.desc!)
			.addToggle((toggle) =>
				toggle
					.setValue(outputDefaults.useAi)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							useAi: value,
						});
						this.reload();
					}),
			);

		if (!outputDefaults.useAi) {
			return;
		}

		new Setting(containerEl)
			.setName(SETTING_COPY.aiSummary.name)
			.setDesc(SETTING_COPY.aiSummary.desc!)
			.addToggle((toggle) =>
				toggle
					.setValue(outputDefaults.generateAiSummary)
					.onChange(async (value) => {
						await this.updateOutputDefaults({
							generateAiSummary: value,
						});
						this.reload();
					}),
			);

		this.displayInstructionConfigSection(
			containerEl,
			this.settings.getInstructionConfig(),
			outputDefaults.generateAiSummary,
		);
	}

	private displayAdvancedModelTuningSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(SETTING_COPY.temperature.name)
			.setDesc(SETTING_COPY.temperature.desc!)
			.addText((text) => {
				text.setPlaceholder(SETTING_COPY.temperature.placeholder!)
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
			.setName(SETTING_COPY.requestTimeout.name)
			.setDesc(SETTING_COPY.requestTimeout.desc!)
			.addText((text) => {
				const seconds = Math.round(this.settings.getRequestTimeoutMs() / 1000);
				text.setPlaceholder(SETTING_COPY.requestTimeout.placeholder!)
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
		showSummaryConfig = true,
	): void {
		if (showSummaryConfig) {
			new Setting(containerEl)
				.setName(SETTING_COPY.instructionStyle.name)
				.setDesc(SETTING_COPY.instructionStyle.desc!)
				.addDropdown((dropdown) =>
					dropdown
						.addOptions(SETTING_COPY.instructionStyle.options!)
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

				const templateSetting = new Setting(templateCard)
					.setName(SETTING_COPY.contentTemplate.name)
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
					templateSetting.setDesc(choice.subtitle);
					templateSetting.descEl.addClass('ytkn-settings__template-description');
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
					.setName(SETTING_COPY.manualInstructions.name)
					.setDesc(SETTING_COPY.manualInstructions.desc!)
					.addTextArea((text) =>
						text
							.setPlaceholder(SETTING_COPY.manualInstructions.placeholder!)
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
				.setName(SETTING_COPY.tldrCallout.name)
				.setDesc(SETTING_COPY.tldrCallout.desc!)
				.addToggle((toggle) =>
					toggle
						.setValue(outputDefaults.tldrCalloutAtTop)
						.onChange(async (value) => {
							await this.updateOutputDefaults({
								tldrCalloutAtTop: value,
							});
						}),
				);
		}

		new Setting(containerEl)
			.setName(SETTING_COPY.mindmap.name)
			.setDesc(SETTING_COPY.mindmap.desc!)
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
			.setName(SETTING_COPY.memorableQuotes.name)
			.setDesc(SETTING_COPY.memorableQuotes.desc!)
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
