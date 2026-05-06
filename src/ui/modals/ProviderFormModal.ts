import { App, Modal, Setting } from 'obsidian';
import { ProviderConfig, ProviderType } from '../../types';
import { SettingsEventHandlers } from '../handlers/SettingsEventHandlers';

type ProviderFormMode =
	| { kind: 'add' }
	| { kind: 'edit'; provider: ProviderConfig; originalName: string };

const PROVIDER_TYPE_OPTIONS: Record<ProviderType, string> = {
	openai: 'OpenAI',
	anthropic: 'Anthropic',
	gemini: 'Google Gemini',
	'openai-compatible': 'OpenAI compatible (Ollama, LM Studio, etc.)',
};

export class ProviderFormModal extends Modal {
	private name: string;
	private type: ProviderType;
	private apiKey: string;
	private url: string;

	constructor(
		app: App,
		private mode: ProviderFormMode,
		private handlers: SettingsEventHandlers,
	) {
		super(app);

		const seed = mode.kind === 'edit' ? mode.provider : null;
		this.name = seed?.name ?? '';
		this.type = (seed?.type as ProviderType) ?? 'openai';
		this.apiKey = seed?.apiKey ?? '';
		this.url = seed?.url ?? '';
	}

	onOpen(): void {
		this.renderForm();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderForm(): void {
		const { contentEl } = this;
		contentEl.empty();

		const isAdd = this.mode.kind === 'add';
		contentEl.createEl('h2', {
			text: isAdd ? 'Add AI provider' : 'Edit provider',
			cls: 'ytkn-modal__title',
		});
		if (isAdd) {
			contentEl.createEl('p', {
				cls: 'ytkn-modal__section-description ytkn-modal__intro',
				text: 'Connect to an AI provider like OpenAI, Anthropic, Gemini, or a local model via Ollama/LM Studio.',
			});
		}

		new Setting(contentEl)
			.setName('Provider name')
			.setDesc('A friendly name to identify this connection.')
			.addText((text) => {
				text.setPlaceholder('E.g. My OpenAI')
					.setValue(this.name)
					.onChange((value) => (this.name = value));
				text.inputEl.addClass('ytkn__input');
			});

		new Setting(contentEl)
			.setName('Provider type')
			.setDesc('Select the AI provider protocol.')
			.addDropdown((dropdown) => {
				for (const [value, label] of Object.entries(PROVIDER_TYPE_OPTIONS)) {
					dropdown.addOption(value, label);
				}
				dropdown
					.setValue(this.type)
					.onChange((value) => {
						this.type = value as ProviderType;
						this.renderForm();
					});
			});

		// API key: shown for all types; optional only for openai-compatible
		if (isAdd) {
			const isCompat = this.type === 'openai-compatible';
			new Setting(contentEl)
				.setName('API key')
				.setDesc(isCompat ? 'API key (optional for local servers like Ollama)' : `Your ${this.type === 'openai' ? 'OpenAI' : this.type === 'anthropic' ? 'Anthropic' : 'Google Gemini'} API key`)
				.addText((text) => {
					text.setPlaceholder(isCompat ? 'sk-... (optional)' : 'sk-...')
						.setValue(this.apiKey)
						.onChange((value) => (this.apiKey = value));
					text.inputEl.type = 'password';
					text.inputEl.addClass('ytkn__input');
				});
		}

		// URL: only for openai-compatible
		if (this.type === 'openai-compatible') {
			new Setting(contentEl)
				.setName('URL')
				.setDesc('Base URL of the OpenAI-compatible endpoint.')
				.addText((text) => {
					text.setPlaceholder('HTTP://localhost:11434/v1')
						.setValue(this.url)
						.onChange((value) => (this.url = value));
					text.inputEl.addClass('ytkn__input');
				});
		}

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText('Save')
					.setCta()
					.onClick(async () => {
						try {
							await this.save();
							this.close();
						} catch (error) {
							console.error(
								`Failed to ${isAdd ? 'add' : 'update'} provider:`,
								error,
							);
						}
					}),
			)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => this.close()),
			);
	}

	private async save(): Promise<void> {
		if (this.mode.kind === 'add') {
			const newProvider: ProviderConfig = {
				name: this.name.trim(),
				type: this.type,
				apiKey: this.apiKey.trim(),
				url: this.type === 'openai-compatible' ? (this.url.trim() || undefined) : undefined,
				models: [],
			};
			await this.handlers.handleProviderAdd(newProvider);
			return;
		}

		const updatedProvider: ProviderConfig = {
			...this.mode.provider,
			name: this.name.trim(),
			type: this.type,
			url: this.type === 'openai-compatible' ? (this.url.trim() || undefined) : undefined,
		};
		await this.handlers.handleProviderEdit(updatedProvider, this.mode.originalName);
	}
}
