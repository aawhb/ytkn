import { Setting } from 'obsidian';
import type { ControlDeclaration } from '../../types';

export function controlDefaultToString(value: unknown): string {
	if (value === undefined || value === null) {
		return '';
	}
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return `${value}`;
	}
	return JSON.stringify(value) ?? '';
}

export function renderTemplateControls(
	containerEl: HTMLElement,
	controls: ControlDeclaration[],
	values: Record<string, string>,
	onChange: (id: string, value: string) => void,
): void {
	for (const control of controls) {
		const current = values[control.id] ?? controlDefaultToString(control.default);
		const name = control.label + (control.required ? ' *' : '');

		if (control.type === 'enum') {
			const setting = new Setting(containerEl)
				.setName(name)
				.setDesc(control.description)
				.addDropdown((dd) => {
					dd.addOption('', '— not set —');
					for (const v of control.enumValues ?? []) {
						dd.addOption(v, v);
					}
					dd.setValue(current).onChange((v) => {
						onChange(control.id, v);
					});
				});
			setting.settingEl.addClass('ytkn-control-row');
		} else if (control.type === 'string' && control.multiline) {
			const setting = new Setting(containerEl)
				.setName(name)
				.setDesc(control.description)
				.addTextArea((text) => {
					text
						.setPlaceholder(control.description.slice(0, 60))
						.setValue(current)
						.onChange((v) => {
							onChange(control.id, v);
						});
					text.inputEl.addClass('ytkn-control-row__textarea');
				});
			setting.settingEl.addClass('ytkn-control-row', 'ytkn-control-row--textarea');
		} else {
			new Setting(containerEl)
				.setName(name)
				.setDesc(control.description)
				.addText((text) => {
					text
						.setPlaceholder(control.description.slice(0, 60))
						.setValue(current)
						.onChange((v) => {
							onChange(control.id, v);
						});
					text.inputEl.addClass('ytkn-form__input');
				});
		}
	}
}
