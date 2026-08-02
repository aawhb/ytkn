export function createCard(
	containerEl: HTMLElement,
	title: string,
	render: (body: HTMLElement) => void,
	headingLevel: 'h3' | 'h4' = 'h3',
): HTMLElement {
	const wrapper = containerEl.createDiv({ cls: 'ytkn-card' });
	wrapper.createEl(headingLevel, { cls: 'ytkn-card__title', text: title });

	const body = wrapper.createDiv({ cls: 'ytkn-card__body' });
	render(body);
	return wrapper;
}

export const createSettingsCard = createCard;
