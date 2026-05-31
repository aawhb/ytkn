import { describe, expect, it } from 'vitest';
import { renderPlaylistNote, renderVideoNote } from '../../src/services/renderer';

const transcript = {
	url: 'https://youtube.com/watch?v=abc',
	videoId: 'abc',
	title: 'My Video',
	author: 'Author',
	channelUrl: 'https://youtube.com/channel/x',
	lines: [{ text: 'Hello.', offset: 0 }],
};

const playlist = {
	url: 'https://youtube.com/playlist?list=PL1',
	playlistId: 'PL1',
	title: 'My Playlist',
	entries: [{ videoId: 'abc', url: 'https://youtube.com/watch?v=abc', position: 1, title: 'My Video' }],
	transcripts: [transcript],
};

describe('fragment mode', () => {
	it('no frontmatter YAML block in fragment mode', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			'Summary',
			{ includeFrontmatter: true },
			null,
			'fragment',
		);

		expect(content).not.toMatch(/^---/);
		expect(content).not.toContain('videoId:');
	});

	it('H2 header instead of H1 in fragment mode', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			'Summary',
			{},
			null,
			'fragment',
		);

		expect(content).toContain('## My Video');
		expect(content).not.toMatch(/^# My Video/m);
	});

	it('body headings shifted H2→H3 in fragment mode', () => {
		const summary = '## Section A\nContent\n## Section B\nMore';
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			summary,
			{ tldrCalloutAtTop: false },
			null,
			'fragment',
		);

		expect(content).toContain('### Section A');
		expect(content).toContain('### Section B');
		expect(content).not.toMatch(/^## Section A/m);
	});

	it('headings inside code blocks NOT shifted in fragment mode', () => {
		const summary = '## Real heading\n```\n## not a heading\n```';
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			summary,
			{ tldrCalloutAtTop: false },
			null,
			'fragment',
		);

		expect(content).toContain('### Real heading');
		expect(content).toContain('## not a heading');
	});

	it('TL;DR extraction works before heading shift in fragment mode', () => {
		const summary = '## TL;DR\nKey insight.\n\n## Details\nMore content.';
		const { content } = renderVideoNote(
			transcript as any,
			'',
			transcript.url,
			summary,
			{ tldrCalloutAtTop: true },
			null,
			'fragment',
		);

		expect(content).toContain('> [!summary] TL;DR');
		expect(content).toContain('Key insight.');
	});

	it('playlist fragment: H2 title, source shifted, no frontmatter', () => {
		const { content } = renderPlaylistNote(
			playlist as any,
			null,
			'Summary',
			{ tldrCalloutAtTop: false },
			null,
			'fragment',
		);

		expect(content).toContain('## My Playlist');
		expect(content).not.toMatch(/^# My Playlist/m);
		expect(content).not.toContain('---');
		expect(content).toContain('### Source');
		expect(content).not.toMatch(/^## Source/m);
	});
});
