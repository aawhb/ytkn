import type { ExtraButtonComponent } from 'obsidian';

export function sectionInfoButton(
	description: string,
): (button: ExtraButtonComponent) => void {
	return (button) => {
		button
			.setIcon('info')
			.setTooltip(description);
	};
}
