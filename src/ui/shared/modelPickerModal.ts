import type { App } from 'obsidian';
import { Modal, Setting } from 'obsidian';
import type { ModelConfig } from '../../types';
import { buildModelId } from '../../modelId';

export class ModelPickerModal extends Modal {
	private selectedId: string;

	constructor(
		app: App,
		private models: ModelConfig[],
		private onSelect: (modelId: string) => Promise<void>,
	) {
		super(app);
		this.selectedId = models[0] ? buildModelId(models[0]) : '';
	}

	onOpen(): void {
		this.contentEl.empty();
		this.setTitle('Add model to ordered list');

		new Setting(this.contentEl)
			.setName('Model')
			.setDesc('Choose a configured model to append to the model order.')
			.addDropdown((dropdown) => {
				for (const model of this.models) {
					dropdown.addOption(
						buildModelId(model),
						`${model.provider.name} / ${model.displayName || model.name}`,
					);
				}
				dropdown.setValue(this.selectedId).onChange((value) => (this.selectedId = value));
			});

		new Setting(this.contentEl)
			.addButton((button) => button
				.setButtonText('Add')
				.setCta()
				.setDisabled(!this.selectedId)
				.onClick(async () => {
					await this.onSelect(this.selectedId);
					this.close();
				}))
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
