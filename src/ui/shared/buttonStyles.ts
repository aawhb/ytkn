import type { ButtonComponent } from 'obsidian';

/** Uses the 1.13 destructive API when available, with equivalent styling on older Obsidian. */
export function setDestructiveButton(button: ButtonComponent): ButtonComponent {
	const setDestructive = Reflect.get(button, 'setDestructive') as
		| ((this: ButtonComponent) => ButtonComponent)
		| undefined;
	if (typeof setDestructive === 'function') {
		return setDestructive.call(button);
	}
	button.buttonEl.addClass('mod-warning');
	return button;
}
