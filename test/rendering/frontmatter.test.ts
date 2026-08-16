import { describe, expect, it } from 'vitest';
import { getTemplate } from '../../src/ai/templates/registry';
import { buildCollectionFrontmatter } from '../../src/rendering/frontmatter';
import type { VideoCollectionTranscriptResponse } from '../../src/types';

describe('playlist frontmatter', () => {
	it('renders allowlisted metadata with global and template tags', () => {
		const playlist: VideoCollectionTranscriptResponse = {
			url: 'https://youtube.com/playlist?list=PL123',
			playlistId: 'PL123',
			title: 'Playlist',
			entries: [{ videoId: 'abc', url: 'https://youtube.com/watch?v=abc', position: 1, title: 'Video' }],
			transcripts: [],
		};

		const result = buildCollectionFrontmatter(
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

	it('adds blank custom properties to playlist and channel notes', () => {
		const playlist: VideoCollectionTranscriptResponse = {
			url: 'https://youtube.com/playlist?list=PL123',
			playlistId: 'PL123',
			title: 'Playlist',
			entries: [],
			transcripts: [],
		};
		const channel = {
			url: 'https://youtube.com/channel/UC123',
			channelId: 'UC123',
			title: 'Channel',
			contentTypes: ['videos' as const],
			entries: [],
			transcripts: [],
		};

		const options = { frontmatterPropertyAllowlist: 'title topic' };
		expect(buildCollectionFrontmatter(playlist, options, null, {}).content).toContain('\ntopic:\n');
		expect(buildCollectionFrontmatter(channel, options, null, {}).content).toContain('\ntopic:\n');
	});

	it('renders a generated value at the custom property position without duplication', () => {
		const playlist: VideoCollectionTranscriptResponse = {
			url: 'https://youtube.com/playlist?list=PL123',
			playlistId: 'PL123',
			title: 'Playlist',
			entries: [],
			transcripts: [],
		};
		const template = {
			...getTemplate('general'),
			frontmatter: [{
				key: 'topic',
				type: 'string' as const,
				description: 'Topic',
			}],
		};

		const content = buildCollectionFrontmatter(
			playlist,
			{ frontmatterPropertyAllowlist: 'videoCount topic title' },
			template,
			{ topic: 'Knowledge management' },
		).content ?? '';

		expect(content).toContain('topic: "Knowledge management"');
		expect(content.match(/^topic:/gm)).toHaveLength(1);
		expect(content.indexOf('videoCount:')).toBeLessThan(content.indexOf('topic:'));
		expect(content.indexOf('topic:')).toBeLessThan(content.indexOf('title:'));
	});
});
