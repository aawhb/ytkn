import type { App, Plugin, SettingDefinitionItem } from 'obsidian';
import { ConfirmationModal, Notice, PluginSettingTab, Setting, setIcon } from 'obsidian';
import type {
	InstructionConfig,
	OutputDefaults,
	PluginSettings,
} from '../../types';
import { DEFAULT_CHANNEL_VIDEO_LIMIT } from '../../defaults';
import { getTemplate } from '../../ai/templates/registry';
import { controlDefaultToString } from '../shared/templateControls';
import { renderBrandActions } from '../shared/brandActions';
import { SUPPORT_LINKS, getRecentReleaseNotes } from '../../releaseNotes';
import { WhatsNewModal } from '../releaseNotes/whatsNewModal';
import { getErrorMessage } from '../../utils';
import { optionFromStoredValue, optionToStoredValue } from '../shared/generationOptionsSchema';
import { getGeneralDefinitions } from './general';
import { AiSettingsPage } from './ai/page';
import { ProviderManager } from './ai/providerManager';

const OUTPUT_PREFIX = 'output.';
const INSTRUCTION_PREFIX = 'instruction.';
const TEMPLATE_CONTROL_PREFIX = 'instruction.control.';

export class SettingsScreen extends PluginSettingTab {
	private providerManager: ProviderManager;
	private aiPage: AiSettingsPage;

	constructor(
		app: App,
		private plugin: Plugin,
		private settings: PluginSettings,
		private openQueueModal: () => void,
	) {
		super(app, plugin);
		this.containerEl.addClass('ytkn-settings');
		this.providerManager = new ProviderManager(
			app,
			settings,
			() => this.update(),
			() => this.refreshDomState(),
		);
		this.aiPage = new AiSettingsPage({
			app,
			settings,
			manager: this.providerManager,
			resetAiDefaults: () => this.confirmResetAiDefaults(),
		});
	}

	getSettingDefinitions(): SettingDefinitionItem<string>[] {
		return [
			{
				type: 'group',
				cls: 'ytkn-settings__landing',
				items: [
					{
						name: this.plugin.manifest?.name ?? 'YT Knowledge Notes',
						aliases: [
							'YTKN',
							'YouTube Knowledge Notes',
							'Manage queue',
							'About YT Knowledge Notes',
							'Sponsor',
							'Buy Me a Coffee',
						],
						render: (setting) => this.renderSettingsHero(setting),
					},
					{
						type: 'page',
						name: 'General',
						desc: 'Destinations, note format, transcripts, playlists, channels, and reports.',
						aliases: ['output', 'notes', 'transcript', 'playlist', 'channel', 'report'],
						items: getGeneralDefinitions({
							app: this.app,
							settings: this.settings,
							onStructureChanged: () => this.update(),
							resetGeneralDefaults: () => this.confirmResetGeneralDefaults(),
						}),
					},
					{
						type: 'page',
						name: 'AI',
						desc: 'AI output, instructions, providers, model order, and request behavior.',
						aliases: ['artificial intelligence', 'provider', 'model', 'fallback', 'instructions'],
						status: () => this.settings.getOutputDefaults().useAi
							&& !this.providerManager.hasUsableSelectedModel()
							? 'warning'
							: null,
						items: this.aiPage.getDefinitions(),
					},
				],
			},
			{
				type: 'group',
				cls: 'ytkn-settings__reset-all',
				items: [{
					name: 'Reset everything',
					desc: 'Remove every provider, model, secret selection, model order entry, and preference. Obsidian secrets, generated notes, and the last-seen release notes marker are preserved.',
					aliases: ['restore defaults', 'factory reset', 'clear settings'],
					render: (setting) => {
						setting
							.setName('Reset everything')
							.setDesc('Remove every provider, model, secret selection, model order entry, and preference. Obsidian secrets, generated notes, and the last-seen release notes marker are preserved.')
							.addButton((button) => button
								.setButtonText('Reset everything')
								.setDestructive()
								.onClick(() => this.confirmResetEverything()));
					},
				}],
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key.startsWith(TEMPLATE_CONTROL_PREFIX)) {
			const controlId = key.slice(TEMPLATE_CONTROL_PREFIX.length);
			const config = this.settings.getInstructionConfig();
			const stored = config.controlValues?.[controlId];
			if (stored !== undefined) return stored;
			const control = getTemplate(config.template).controls?.find((item) => item.id === controlId);
			return controlDefaultToString(control?.default);
		}

		if (key.startsWith(OUTPUT_PREFIX)) {
			const field = key.slice(OUTPUT_PREFIX.length) as keyof OutputDefaults;
			return this.settings.getOutputDefaults()[field];
		}

		if (key.startsWith(INSTRUCTION_PREFIX)) {
			const field = key.slice(INSTRUCTION_PREFIX.length) as Exclude<keyof InstructionConfig, 'controlValues'>;
			return this.settings.getInstructionConfig()[field];
		}

		switch (key) {
			case 'channel-limit-mode':
				return this.settings.getOutputDefaults().channelVideoLimit === null ? 'all' : 'limited';
			case 'temperature':
				return this.settings.getTemperature();
			case 'request-timeout-seconds':
				return optionFromStoredValue('requestTimeout', this.settings.getRequestTimeoutMs());
			default:
				return undefined;
		}
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key.startsWith(TEMPLATE_CONTROL_PREFIX)) {
			const controlId = key.slice(TEMPLATE_CONTROL_PREFIX.length);
			const config = this.settings.getInstructionConfig();
			await this.settings.updateInstructionConfig({
				controlValues: {
					...config.controlValues,
					[controlId]: typeof value === 'string' ? value : controlDefaultToString(value),
				},
			});
			return;
		}

		if (key.startsWith(OUTPUT_PREFIX)) {
			const field = key.slice(OUTPUT_PREFIX.length) as keyof OutputDefaults;
			await this.updateOutputDefaults({ [field]: value });
			this.afterOutputChange(field);
			return;
		}

		if (key.startsWith(INSTRUCTION_PREFIX)) {
			const field = key.slice(INSTRUCTION_PREFIX.length) as Exclude<keyof InstructionConfig, 'controlValues'>;
			await this.settings.updateInstructionConfig({ [field]: value });
			this.afterInstructionChange(field);
			return;
		}

		switch (key) {
			case 'channel-limit-mode': {
				const current = this.settings.getOutputDefaults().channelVideoLimit;
				await this.updateOutputDefaults({
					channelVideoLimit: value === 'all' ? null : (current ?? DEFAULT_CHANNEL_VIDEO_LIMIT),
				});
				this.refreshDomState();
				return;
			}
			case 'temperature':
				await this.settings.updateTemperature(Number(value));
				return;
			case 'request-timeout-seconds':
				await this.settings.updateRequestTimeoutMs(Number(optionToStoredValue('requestTimeout', Number(value))));
				return;
			default:
				throw new Error(`Unknown settings control key: ${key}`);
		}
	}

	private renderSettingsHero(setting: Setting): void {
		setting.settingEl.empty();
		setting.settingEl.addClass('ytkn-settings__hero');
		const identity = setting.settingEl.createDiv({ cls: 'ytkn-settings__hero-identity' });
		const mark = identity.createDiv({ cls: 'ytkn-brand-mark ytkn-settings__hero-mark' });
		setIcon(mark, 'play');
		const copy = identity.createDiv({ cls: 'ytkn-settings__hero-copy' });
		const title = new Setting(copy)
			.setName(this.plugin.manifest?.name ?? 'YT Knowledge Notes')
			.setHeading();
		title.settingEl.addClass('ytkn-brand-title-row');
		title.settingEl.addClass('ytkn-settings__hero-title-row');
		title.nameEl.addClass('ytkn-brand-title');
		title.nameEl.addClass('ytkn-settings__hero-title');
		renderBrandActions(copy, this.getBrandActions()).addClass('ytkn-settings__hero-actions');
	}

	private getBrandActions() {
		return [
			{ id: 'manage-queue', label: 'Manage queue', icon: 'list-todo', onClick: this.openQueueModal },
			{
				id: 'about',
				label: 'About YT Knowledge Notes',
				icon: 'info',
				onClick: () => new WhatsNewModal(
					this.app,
					this.plugin.manifest.version,
					getRecentReleaseNotes(),
				).open(),
			},
			{ id: 'sponsor', label: 'Sponsor', icon: 'heart-handshake', href: SUPPORT_LINKS.githubSponsors },
			{ id: 'buy-me-a-coffee', label: 'Buy Me a Coffee', icon: 'coffee', href: SUPPORT_LINKS.buyMeACoffee },
		];
	}

	private afterOutputChange(field: keyof OutputDefaults): void {
		if (field === 'generateAiSummary' || field === 'tldrCalloutAtTop') {
			this.aiPage.generation.refreshPreview();
		}
		if (
			field === 'useAi'
			|| field === 'generateAiSummary'
			|| field === 'noteDestinationMode'
			|| field === 'includeFrontmatter'
			|| field === 'transcriptMode'
			|| field === 'transcriptLanguageMode'
			|| field === 'includeReport'
		) {
			this.refreshDomState();
		}
	}

	private afterInstructionChange(
		field: Exclude<keyof InstructionConfig, 'controlValues'>,
	): void {
		if (field === 'template') {
			this.update();
			return;
		}
		if (field === 'mode') this.refreshDomState();
		if (field === 'mode' || field === 'includeMindmap' || field === 'includeMemorableQuotes') {
			this.aiPage.generation.refreshPreview();
		}
	}

	private async updateOutputDefaults(patch: Partial<OutputDefaults>): Promise<void> {
		await this.settings.updateOutputDefaults({
			...this.settings.getOutputDefaults(),
			...patch,
		});
	}

	private confirmResetGeneralDefaults(): void {
		this.openResetConfirmation(
			'Restore General defaults?',
			'Restore destination, note format, transcript, playlist, channel, and report settings? AI settings are preserved.',
			'Restore General defaults',
			async () => {
				await this.settings.resetGeneralDefaults();
				this.update();
				new Notice('General settings restored to defaults.');
			},
		);
	}

	private confirmResetAiDefaults(): void {
		this.openResetConfirmation(
			'Restore AI defaults?',
			'Restore AI output, instructions, temperature, and timeout? Providers, models, secrets, and model order are preserved.',
			'Restore AI defaults',
			async () => {
				await this.settings.resetAiDefaults();
				this.update();
				new Notice('AI settings restored to defaults.');
			},
		);
	}

	private confirmResetEverything(): void {
		this.openResetConfirmation(
			'Reset everything?',
			'Remove every provider, model, secret selection, model order entry, and preference? Obsidian secrets, generated notes, and the last-seen release notes marker are preserved.',
			'Reset everything',
			async () => {
				await this.settings.resetAllSettings();
				this.update();
				new Notice('All plugin settings were reset.');
			},
		);
	}

	private openResetConfirmation(
		title: string,
		message: string,
		confirmText: string,
		action: () => Promise<void>,
	): void {
		new ConfirmationModal(this.app)
			.setTitle(title)
			.setContent(message)
			.addCancelButton()
			.addButton((button) => button
				.setButtonText(confirmText)
				.setDestructive()
				.setCta()
				.onClick(async () => {
					try {
						await action();
						return false;
					} catch (error) {
						new Notice(`Couldn't reset settings: ${getErrorMessage(error)}.`);
						return true;
					}
				}))
			.open();
	}
}
