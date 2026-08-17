import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../../mocks/obsidian');
	return mod;
});

import { App } from 'obsidian';
import { WhatsNewModal } from '../../../src/ui/releaseNotes/whatsNewModal';
import { DOCUMENTATION_LINK, SUPPORT_LINKS, getRecentReleaseNotes } from '../../../src/releaseNotes';

describe('WhatsNewModal', () => {
	it('shows the shared recent release lines by default', () => {
		const modal = new WhatsNewModal(new App());
		const recentNotes = getRecentReleaseNotes();

		modal.open();

		expect(modal.contentEl.querySelectorAll('.ytkn-whats-new-modal__release')).toHaveLength(recentNotes.length);
		for (const note of recentNotes) {
			expect(modal.contentEl.textContent).toContain(note.version);
		}
	});

	it('renders release notes and support links', () => {
		const modal = new WhatsNewModal(new App(), [{
			version: '2.0.0',
			date: '2026-02-01',
			summary: 'A focused release.',
			new: ['Metadata-only notes'],
			improved: ['Better reports'],
			fixed: ['Playlist pagination'],
		}]);

		modal.open();

		expect(modal.contentEl.textContent).toContain("What's new in YT Knowledge Notes");
		expect(modal.contentEl.textContent).not.toContain("What's new in YT Knowledge Notes 2.0.0");
		expect(modal.contentEl.textContent).toContain('Metadata-only notes');
		expect(modal.contentEl.textContent).toContain('Better reports');
		expect(modal.contentEl.textContent).toContain('Playlist pagination');
		const links = Array.from(modal.contentEl.querySelectorAll('a'));
		expect(links.map((link) => link.getAttribute('href'))).toEqual([
			DOCUMENTATION_LINK,
			SUPPORT_LINKS.githubSponsors,
			SUPPORT_LINKS.buyMeACoffee,
		]);
		expect(links.map((link) => link.textContent)).toEqual([
			'Help',
			'Sponsor',
			'Buy Me a Coffee',
		]);
		expect(links.every((link) => link.getAttribute('target') === '_blank')).toBe(true);
		expect(modal.contentEl.querySelectorAll('.ytkn-whats-new-modal__support-icon')).toHaveLength(3);
	});

	it('renders an empty state when no release notes are available', () => {
		const modal = new WhatsNewModal(new App(), []);

		modal.open();

		expect(modal.contentEl.textContent).toContain('No release notes are available yet.');
	});
});
