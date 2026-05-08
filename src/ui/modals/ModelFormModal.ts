import { App, Modal, Setting } from 'obsidian';
import { ModelConfig, ProviderConfig } from '../../types';
import { SettingsEventHandlers } from '../handlers/SettingsEventHandlers';

type ModelFormMode =
	| { kind: 'add'; provider: ProviderConfig }
	| { kind: 'edit'; model: ModelConfig };

export class ModelFormModal extends Modal {
	private modelName: string;
	private displayName: string;

	constructor(
		app: App,
		private mode: ModelFormMode,
		private handlers: SettingsEventHandlers,
	) {
		super(app);

		this.modelName = mode.kind === 'edit' ? mode.model.name : '';
		this.displayName = mode.kind === 'edit' ? (mode.model.displayName ?? '') : '';
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ytkn-settings__modal');

		const isAdd = this.mode.kind === 'add';
		contentEl.createEl('h2', { text: isAdd ? 'Add model' : 'Edit model' });

		new Setting(contentEl)
			.setName('Model name')
			.setDesc(isAdd ? 'Enter model name (required)' : 'Model identifier (cannot be changed)')
			.addText((text) => {
				text.setPlaceholder('Enter model name').setValue(this.modelName);
				if (isAdd) {
					text.onChange((value) => (this.modelName = value));
				} else {
					text.setDisabled(true);
				}
			});

		new Setting(contentEl)
			.setName('Display name')
			.setDesc('Enter display name (optional)')
			.addText((text) =>
				text
					.setPlaceholder('Enter display name')
					.setValue(this.displayName)
					.onChange((value) => (this.displayName = value)),
			);

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
								`Failed to ${isAdd ? 'add' : 'update'} model:`,
								error,
							);
						}
					}),
			)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => this.close()),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async save(): Promise<void> {
		if (this.mode.kind === 'add') {
			const provider = this.mode.provider;
			const newModel: ModelConfig = {
				name: this.modelName.trim(),
				displayName: this.displayName.trim() || undefined,
				provider: {
					name: provider.name,
					type: provider.type,
					apiKey: provider.apiKey,
					url: provider.url,
				},
			};
			await this.handlers.handleModelAdd(newModel);
			return;
		}

		const updatedModel: ModelConfig = {
			...this.mode.model,
			displayName: this.displayName.trim() || undefined,
		};
		await this.handlers.handleModelEdit(updatedModel);
	}
}
