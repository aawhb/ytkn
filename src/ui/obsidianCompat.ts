import type { ButtonComponent } from 'obsidian';

type ButtonMethod = () => ButtonComponent;

type LegacySettingsTabRenderer = {
	display: () => void;
};

function getButtonMethod(
	button: ButtonComponent,
	methodName: string,
): ButtonMethod | null {
	const candidate = (button as unknown as Record<string, unknown>)[methodName];
	return typeof candidate === 'function'
		? (candidate.bind(button) as ButtonMethod)
		: null;
}

export function markDestructiveButton(button: ButtonComponent): ButtonComponent {
	const setDestructive = getButtonMethod(button, 'setDestructive');
	if (setDestructive) {
		return setDestructive();
	}

	const setWarning = getButtonMethod(button, 'setWarning');
	if (setWarning) {
		return setWarning();
	}

	return button;
}

export function renderLegacySettingsTab(tab: LegacySettingsTabRenderer): void {
	tab.display();
}
