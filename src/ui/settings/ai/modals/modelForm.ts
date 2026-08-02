import type { App } from 'obsidian';
import { Modal, Setting } from 'obsidian';
import type { ModelConfig, ProviderConfig } from '../../../../types';

type ModelFormMode =
	| { kind: 'add'; provider: ProviderConfig }
	| { kind: 'edit'; model: ModelConfig };

interface ModelFormActions {
	addModel(model: ModelConfig): Promise<void>;
	editModel(model: ModelConfig): Promise<void>;
}

export class ModelFormModal extends Modal {
	private modelName: string;
	private displayName: string;

	constructor(app: App, private mode: ModelFormMode, private actions: ModelFormActions) {
		super(app);
		this.modelName = mode.kind === 'edit' ? mode.model.name : '';
		this.displayName = mode.kind === 'edit' ? (mode.model.displayName ?? '') : '';
	}

	onOpen(): void {
		this.contentEl.empty();
		this.setTitle(this.mode.kind === 'add' ? 'Add model' : 'Edit model');
		this.contentEl.addClass('ytkn-settings__modal');
		const isAdd = this.mode.kind === 'add';

		new Setting(this.contentEl)
			.setName('Model ID')
			.setDesc(isAdd
				? 'Exact model identifier used by the provider. Required.'
				: 'Exact model identifier used by the provider. It cannot be changed.')
			.addText((text) => {
				text.setPlaceholder('Model ID').setValue(this.modelName);
				if (isAdd) {
					text.onChange((value) => (this.modelName = value));
				} else {
					text.setDisabled(true);
				}
			});

		new Setting(this.contentEl)
			.setName('Display name')
			.setDesc('Optional label shown in the plugin.')
			.addText((text) => text
				.setPlaceholder('Display name')
				.setValue(this.displayName)
				.onChange((value) => (this.displayName = value)));

		new Setting(this.contentEl)
			.addButton((button) => button
				.setButtonText('Save')
				.setCta()
				.onClick(async () => {
					try {
						await this.save();
						this.close();
					} catch (error) {
						console.error(`Failed to ${isAdd ? 'add' : 'update'} model:`, error);
					}
				}))
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async save(): Promise<void> {
		if (this.mode.kind === 'add') {
			const provider = this.mode.provider;
			await this.actions.addModel({
				name: this.modelName.trim(),
				displayName: this.displayName.trim() || undefined,
				provider: {
					name: provider.name,
					type: provider.type,
					apiKey: provider.apiKey,
					apiKeySecretId: provider.apiKeySecretId,
					url: provider.url,
				},
			});
			return;
		}

		await this.actions.editModel({
			...this.mode.model,
			displayName: this.displayName.trim() || undefined,
		});
	}
}
