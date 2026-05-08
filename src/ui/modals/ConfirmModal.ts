import { App, Modal, Setting } from 'obsidian';

export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private title: string,
		private message: string,
		private confirmText: string,
		private onConfirm: () => Promise<void> | void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.title });
		contentEl.createEl('p', {
			text: this.message,
			cls: 'ytkn-settings__modal-message',
		});

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText(this.confirmText)
					.setWarning()
					.onClick(async () => {
						try {
							await this.onConfirm();
						} finally {
							this.close();
						}
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
