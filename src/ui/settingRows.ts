const SELECT_ROW_CLASS = 'ytkn-setting-row--select';
const NUMBER_ROW_CLASS = 'ytkn-setting-row--number';
const BUTTON_ROW_CLASS = 'ytkn-setting-row--button';
const FIT_CONTROL_ROW_CLASS = 'ytkn-setting-row--fit-control';
const STACKED_ROW_CLASS = 'ytkn-setting-row--stacked';

export function stampSettingRowClasses(containerEl: HTMLElement): void {
	for (const settingEl of containerEl.querySelectorAll<HTMLElement>('.setting-item')) {
		const controlEl = settingEl.querySelector<HTMLElement>(':scope > .setting-item-control');
		if (!controlEl) {
			continue;
		}

		const hasSelect = controlEl.querySelector(':scope > select') !== null;
		const hasNumberInput = controlEl.querySelector(':scope > input[type="number"]') !== null;
		const hasTextButton = controlEl.querySelector(':scope > button:not(.clickable-icon)') !== null;
		const hasProviderHeaderControls = settingEl.classList.contains('ytkn-settings__provider-header');
		const shouldStayStacked =
			(settingEl.closest('.ytkn-modal__quick-grid') !== null && (hasSelect || hasNumberInput)) ||
			(settingEl.classList.contains('ytkn-modal__model-setting') && hasSelect);
		const shouldFitControl =
			(hasSelect || hasNumberInput || hasTextButton || hasProviderHeaderControls) &&
			!shouldStayStacked;

		settingEl.toggleClass(
			SELECT_ROW_CLASS,
			hasSelect,
		);
		settingEl.toggleClass(
			NUMBER_ROW_CLASS,
			hasNumberInput,
		);
		settingEl.toggleClass(
			BUTTON_ROW_CLASS,
			hasTextButton,
		);
		settingEl.toggleClass(
			FIT_CONTROL_ROW_CLASS,
			shouldFitControl,
		);
		settingEl.toggleClass(
			STACKED_ROW_CLASS,
			shouldStayStacked,
		);
	}
}
