import type { App, ButtonComponent, TextComponent } from 'obsidian';
import { Modal, Notice, Setting } from 'obsidian';
import { validateCustomFrontmatterProperty } from '../../frontmatterProperties';
import { getErrorMessage } from '../../utils';

interface FrontmatterPropertyModalOptions {
	existing: readonly string[];
	originalName?: string;
	onSubmit(name: string): Promise<void>;
}

export class FrontmatterPropertyModal extends Modal {
	constructor(
		app: App,
		private options: FrontmatterPropertyModalOptions,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.options.originalName ? 'Rename custom property' : 'Add custom property');
		this.contentEl.addClass('ytkn-settings__property-modal');

		let input!: TextComponent;
		let saveButton!: ButtonComponent;
		const field = new Setting(this.contentEl)
			.setName('Property name')
			.setDesc('The property is added blank to generated notes.')
			.addText((text) => {
				input = text
					.setPlaceholder('Topic')
					.setValue(this.options.originalName ?? '')
					.onChange(() => updateValidation());
			});
		field.settingEl.addClass('ytkn-settings__property-name');

		const errorEl = this.contentEl.createDiv({ cls: 'ytkn-settings__property-error' });
		errorEl.setAttribute('role', 'alert');

		const actions = new Setting(this.contentEl)
			.addButton((button) => button
				.setButtonText('Cancel')
				.onClick(() => this.close()))
			.addButton((button) => {
				saveButton = button
					.setButtonText(this.options.originalName ? 'Rename' : 'Add')
					.setCta()
					.onClick(() => submit());
			});
		actions.settingEl.addClass('ytkn-settings__property-actions');

		const updateValidation = () => {
			const message = validateCustomFrontmatterProperty(
				input.getValue(),
				this.options.existing,
				this.options.originalName,
			);
			errorEl.setText(message ?? '');
			saveButton.setDisabled(Boolean(message));
		};

		const submit = async () => {
			const name = input.getValue().trim();
			if (validateCustomFrontmatterProperty(name, this.options.existing, this.options.originalName)) {
				updateValidation();
				return;
			}
			try {
				await this.options.onSubmit(name);
				this.close();
			} catch (error) {
				new Notice(`Couldn't save custom property: ${getErrorMessage(error)}.`);
			}
		};

		input.inputEl.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void submit();
			}
		});
		updateValidation();
		input.inputEl.focus();
	}
}
