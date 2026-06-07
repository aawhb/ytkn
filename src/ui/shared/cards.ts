export function createSettingsCard(
	containerEl: HTMLElement,
	title: string,
	render: (body: HTMLElement) => void,
	headingLevel: 'h3' | 'h4' = 'h3',
): HTMLElement {
	const wrapper = containerEl.createDiv({ cls: 'ytkn-card ytkn-settings__group' });
	wrapper.createEl(headingLevel, { cls: 'ytkn-card__title ytkn-settings__group-title', text: title });

	const body = wrapper.createDiv({ cls: 'ytkn-card__body ytkn-settings__group-cards' });
	render(body);
	return wrapper;
}
