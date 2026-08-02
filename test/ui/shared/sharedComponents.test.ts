import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../../mocks/obsidian');
	return {
		...mod,
		setIcon: vi.fn((el: HTMLElement, icon: string) => {
			el.setAttribute('data-icon', icon);
		}),
	};
});

import { createCard } from '../../../src/ui/shared/cards';
import { renderBrandActions } from '../../../src/ui/shared/brandActions';
import { TabGroup } from '../../../src/ui/shared/tabs';

describe('settings UI helpers', () => {
	it('creates a card with the shared selector hooks', () => {
		const host = document.createElement('div');
		const card = createCard(host, 'Card title', (body) => {
			body.createDiv({ text: 'Body content' });
		}, 'h4');

		expect(card.className).toContain('ytkn-card');
		expect(card.querySelector('h4')?.textContent).toBe('Card title');
		expect(card.querySelector('.ytkn-card__body')?.textContent).toBe('Body content');
	});

	it('renders brand actions as accessible icon-only links and buttons', () => {
		const host = document.createElement('div');
		const onClick = vi.fn();
		const actionsEl = renderBrandActions(host, [
			{ id: 'docs', label: 'Docs', icon: 'book', href: 'https://example.com/docs' },
			{ id: 'queue', label: 'Manage queue', icon: 'list-todo', onClick },
		]);

		const actions = Array.from(actionsEl.querySelectorAll<HTMLElement>('.ytkn-brand-action'));
		expect(actions.map((action) => action.getAttribute('aria-label'))).toEqual(['Docs', 'Manage queue']);
		expect(actions[0].tagName).toBe('A');
		expect(actions[0].getAttribute('target')).toBe('_blank');
		expect(actions[1].tagName).toBe('BUTTON');
		expect(actions[1].getAttribute('type')).toBe('button');

		actions[1].click();
		expect(onClick).toHaveBeenCalledOnce();
	});

	it('toggles semantic tabs and invokes the tab-change callback', () => {
		const host = document.createElement('div');
		const onTabChange = vi.fn();
		const group = new TabGroup(
			host,
			[
				{ id: 'one', label: 'One', icon: 'circle' },
				{ id: 'two', label: 'Two' },
			],
			'one',
			onTabChange,
		);

		expect(group.getPanel('one')?.classList.contains('is-active')).toBe(true);
		expect(host.querySelector('[role="tablist"]')).not.toBeNull();

		(host.querySelector('#ytkn-tab-two') as HTMLButtonElement).click();

		expect(group.getPanel('one')?.classList.contains('is-active')).toBe(false);
		expect(group.getPanel('one')?.hidden).toBe(true);
		expect(group.getPanel('two')?.classList.contains('is-active')).toBe(true);
		expect(group.getPanel('two')?.hidden).toBe(false);
		expect(host.querySelector('#ytkn-tab-two')?.getAttribute('aria-selected')).toBe('true');
		expect(onTabChange).toHaveBeenLastCalledWith('two');
	});

	it('supports arrow, Home, and End keyboard navigation between tabs', () => {
		const host = document.createElement('div');
		new TabGroup(host, [
			{ id: 'one', label: 'One' },
			{ id: 'two', label: 'Two' },
			{ id: 'three', label: 'Three' },
		], 'one');
		const one = host.querySelector<HTMLButtonElement>('#ytkn-tab-one')!;
		const two = host.querySelector<HTMLButtonElement>('#ytkn-tab-two')!;
		const three = host.querySelector<HTMLButtonElement>('#ytkn-tab-three')!;

		one.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
		expect(three.getAttribute('aria-selected')).toBe('true');
		three.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		expect(one.getAttribute('aria-selected')).toBe('true');
		one.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		expect(three.getAttribute('aria-selected')).toBe('true');
		three.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		expect(one.getAttribute('aria-selected')).toBe('true');
		two.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		expect(three.getAttribute('aria-selected')).toBe('true');
	});
});
