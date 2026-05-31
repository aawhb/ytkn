import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../mocks/obsidian');
	return mod;
});

import { App } from 'obsidian';
import { WhatsNewModal } from '../../src/ui/modals/WhatsNewModal';
import { SUPPORT_LINKS } from '../../src/release-notes';

describe('WhatsNewModal', () => {
	it('renders release notes and support links', () => {
		const modal = new WhatsNewModal(new App(), '2.0.0', [{
			version: '2.0.0',
			date: '2026-02-01',
			summary: 'A focused release.',
			new: ['Metadata-only notes'],
			improved: ['Better reports'],
			fixed: ['Playlist pagination'],
		}]);

		modal.open();

		expect(modal.contentEl.textContent).toContain("What's new in YT Knowledge Notes 2.0.0");
		expect(modal.contentEl.textContent).toContain('Metadata-only notes');
		expect(modal.contentEl.textContent).toContain('Better reports');
		expect(modal.contentEl.textContent).toContain('Playlist pagination');
		expect(modal.contentEl.textContent).toContain('Support YTKN Development');
		expect(modal.contentEl.textContent).not.toContain('Help keep YT Knowledge Notes maintained.');

		const links = Array.from(modal.contentEl.querySelectorAll('a'));
		expect(links.map((link) => link.getAttribute('href'))).toEqual([
			SUPPORT_LINKS.githubSponsors,
			SUPPORT_LINKS.buyMeACoffee,
		]);
		expect(links.map((link) => link.textContent)).toEqual([
			'Sponsor',
			'Buy Me a Coffee',
		]);
		expect(links.every((link) => link.getAttribute('target') === '_blank')).toBe(true);
	});

	it('renders an empty state when no release notes are available', () => {
		const modal = new WhatsNewModal(new App(), '3.0.0', []);

		modal.open();

		expect(modal.contentEl.textContent).toContain('No release notes are available for this version yet.');
	});
});
