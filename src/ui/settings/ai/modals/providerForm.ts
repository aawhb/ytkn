import type { App } from 'obsidian';
import { Modal, SecretComponent, Setting } from 'obsidian';
import type { ProviderConfig, ProviderType } from '../../../../types';
import { DEFAULT_OPENAI_COMPATIBLE_URL } from '../../../../defaults';

const PROVIDER_TYPE_OPTIONS: Record<ProviderType, string> = {
	'openai-compatible': 'OpenAI-compatible (Ollama, LM Studio, and others)',
	anthropic: 'Anthropic',
	gemini: 'Google Gemini',
	openai: 'OpenAI',
};

interface ProviderFormActions {
	addProvider(provider: ProviderConfig): Promise<void>;
}

export class ProviderFormModal extends Modal {
	private name = '';
	private type: ProviderType = 'openai-compatible';
	private apiKeySecretId = '';
	private url = DEFAULT_OPENAI_COMPATIBLE_URL;

	constructor(app: App, private actions: ProviderFormActions) {
		super(app);
	}

	onOpen(): void {
		this.renderForm();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderForm(): void {
		this.contentEl.empty();
		this.setTitle('Add AI provider');
		this.contentEl.createEl('p', {
			cls: 'ytkn-modal__section-description ytkn-modal__intro',
			text: 'Connect to OpenAI, Anthropic, Gemini, or an OpenAI-compatible local or hosted service.',
		});

		new Setting(this.contentEl)
			.setName('Provider name')
			.setDesc('A unique name for this connection. Colons are not allowed.')
			.addText((text) => text
				.setPlaceholder('My provider')
				.setValue(this.name)
				.onChange((value) => (this.name = value)));

		new Setting(this.contentEl)
			.setName('Provider type')
			.setDesc('Choose how the plugin connects to this provider.')
			.addDropdown((dropdown) => {
				for (const [value, label] of Object.entries(PROVIDER_TYPE_OPTIONS)) {
					dropdown.addOption(value, label);
				}
				dropdown.setValue(this.type).onChange((value) => {
					this.type = value as ProviderType;
					if (this.type === 'openai-compatible' && !this.url.trim()) {
						this.url = DEFAULT_OPENAI_COMPATIBLE_URL;
					}
					this.renderForm();
				});
			});

		const compatible = this.type === 'openai-compatible';
		new Setting(this.contentEl)
			.setName('API key')
			.setDesc(compatible
				? 'Optional for local servers. Select an Obsidian secret when the endpoint requires authentication.'
				: 'Select the Obsidian secret containing this provider API key. You can finish this later.')
			.addComponent((element) => new SecretComponent(this.app, element)
				.setValue(this.apiKeySecretId)
				.onChange((value) => (this.apiKeySecretId = value)));

		if (compatible) {
			new Setting(this.contentEl)
				.setName('Base URL')
				.setDesc('Base URL of the OpenAI-compatible endpoint.')
				.addText((text) => text
					.setPlaceholder(DEFAULT_OPENAI_COMPATIBLE_URL)
					.setValue(this.url)
					.onChange((value) => (this.url = value)));
		}

		new Setting(this.contentEl)
			.addButton((button) => button
				.setButtonText('Add provider')
				.setCta()
				.onClick(async () => {
					try {
						await this.actions.addProvider({
							name: this.name.trim(),
							type: this.type,
							apiKey: '',
							apiKeySecretId: this.apiKeySecretId.trim() || undefined,
							url: compatible ? (this.url.trim() || undefined) : undefined,
							models: [],
						});
						this.close();
					} catch (error) {
						console.error('Failed to add provider:', error);
					}
				}))
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()));
	}
}
