const SELECT_ROW_CLASS = 'ytkn-setting-row--select';
const NUMBER_ROW_CLASS = 'ytkn-setting-row--number';
const BUTTON_ROW_CLASS = 'ytkn-setting-row--button';

export function stampSettingRowClasses(containerEl: HTMLElement): void {
	for (const settingEl of containerEl.querySelectorAll<HTMLElement>('.setting-item')) {
		const controlEl = settingEl.querySelector<HTMLElement>(':scope > .setting-item-control');
		if (!controlEl) {
			continue;
		}

		settingEl.toggleClass(
			SELECT_ROW_CLASS,
			controlEl.querySelector(':scope > select') !== null,
		);
		settingEl.toggleClass(
			NUMBER_ROW_CLASS,
			controlEl.querySelector(':scope > input[type="number"]') !== null,
		);
		settingEl.toggleClass(
			BUTTON_ROW_CLASS,
			controlEl.querySelector(':scope > button:not(.clickable-icon)') !== null,
		);
	}
}
