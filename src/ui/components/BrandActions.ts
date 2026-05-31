import { setIcon } from 'obsidian';

export interface BrandAction {
	id: string;
	label: string;
	icon: string;
	href?: string;
	onClick?: () => void;
}

export function renderBrandActions(containerEl: HTMLElement, actions: BrandAction[]): HTMLElement {
	const actionsEl = containerEl.createDiv({ cls: 'ytkn-brand-actions' });

	for (const action of actions) {
		const actionClasses = [
			'ytkn-brand-action',
			action.href ? 'ytkn-brand-action--link' : 'ytkn-brand-action--button',
			action.onClick ? 'ytkn-brand-action--utility' : '',
		].filter(Boolean).join(' ');

		const actionEl = action.href
			? actionsEl.createEl('a', {
				cls: actionClasses,
				attr: {
					'aria-label': action.label,
					'data-action-id': action.id,
					href: action.href,
					rel: 'noopener noreferrer',
					target: '_blank',
					title: action.label,
				},
			})
			: actionsEl.createEl('button', {
				cls: actionClasses,
				attr: {
					'aria-label': action.label,
					'data-action-id': action.id,
					title: action.label,
					type: 'button',
				},
			});

		const iconEl = actionEl.createSpan({ cls: 'ytkn-brand-action__icon' });
		iconEl.setAttribute('aria-hidden', 'true');
		iconEl.setAttribute('data-icon', action.icon);
		setIcon(iconEl, action.icon);

		if (action.onClick) {
			actionEl.addEventListener('click', (event) => {
				if (action.href) {
					event.preventDefault();
				}
				action.onClick?.();
			});
		}
	}

	return actionsEl;
}
