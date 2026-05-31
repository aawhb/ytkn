import type { ButtonComponent } from 'obsidian';

type DestructiveButtonCompat = ButtonComponent & {
	setDestructive?: () => ButtonComponent;
	setWarning?: () => ButtonComponent;
};

type LegacySettingsTabRenderer = {
	display: () => void;
};

export function markDestructiveButton(button: ButtonComponent): ButtonComponent {
	const compat = button as DestructiveButtonCompat;
	if (typeof compat.setDestructive === 'function') {
		return compat.setDestructive();
	}
	if (typeof compat.setWarning === 'function') {
		return compat.setWarning();
	}
	return button;
}

export function renderLegacySettingsTab(tab: LegacySettingsTabRenderer): void {
	tab.display();
}
