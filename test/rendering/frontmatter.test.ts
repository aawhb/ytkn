import { describe, expect, it } from 'vitest';
import { getTemplate } from '../../src/ai/templates/registry';
import { buildPlaylistFrontmatter } from '../../src/rendering/frontmatter';
import type { PlaylistTranscriptResponse } from '../../src/types';

describe('playlist frontmatter', () => {
	it('renders allowlisted metadata with global and template tags', () => {
		const playlist: PlaylistTranscriptResponse = {
			url: 'https://youtube.com/playlist?list=PL123',
			playlistId: 'PL123',
			title: 'Playlist',
			entries: [{ videoId: 'abc', url: 'https://youtube.com/watch?v=abc', position: 1, title: 'Video' }],
			transcripts: [],
		};

		const result = buildPlaylistFrontmatter(
			playlist,
			{
				frontmatterPropertyAllowlist: 'title aliases source videoCount playlistUrl playlistId',
				frontmatterTags: 'global',
			},
			getTemplate('general'),
			{},
		);

		expect(result).toEqual({
			content: [
				'---',
				'title: "Playlist"',
				'aliases:',
				'  - "Playlist"',
				'tags:',
				'  - global',
				'  - ytkn/general',
				'source: youtube-playlist',
				'videoCount: 1',
				'playlistUrl: "https://youtube.com/playlist?list=PL123"',
				'playlistId: "PL123"',
				'---',
			].join('\n'),
			warnings: [],
		});
	});
});
