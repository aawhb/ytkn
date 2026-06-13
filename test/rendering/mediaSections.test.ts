import { describe, expect, it } from 'vitest';
import { buildMediaEmbed, buildPlaylistMediaEmbed, buildVideoHeader } from '../../src/rendering/mediaSections';

const playlist = {
	url: 'https://youtube.com/playlist?list=PL123',
	playlistId: 'PL123',
	title: 'Playlist ] Name',
	entries: [{ videoId: 'abc123', url: 'https://youtube.com/watch?v=abc123', position: 1, title: 'First', thumbnailUrl: 'entry-thumb.jpg' }],
	transcripts: [],
};

const transcript = {
	url: 'https://youtube.com/watch?v=abc123',
	videoId: 'abc123',
	title: 'Video ] Name',
	author: 'Author',
	lines: [],
};

describe('media section rendering', () => {
	it('renders video embeds, thumbnail embeds, or no embed based on options', () => {
		expect(buildMediaEmbed('Video ] Name', 'https://youtu.be/abc', 'thumb.jpg', { mediaEmbedMode: 'video' }))
			.toBe('![Video ) Name](https://youtu.be/abc)');
		expect(buildMediaEmbed('  Video ] \\ Name  ', 'https://youtu.be/abc', 'thumb.jpg', { mediaEmbedMode: 'video' }))
			.toBe('![Video ) \\\\ Name](https://youtu.be/abc)');
		expect(buildMediaEmbed('Recurrence [ T(n) ] #3', 'https://youtu.be/abc', 'thumb.jpg', { mediaEmbedMode: 'video' }))
			.toBe('![Recurrence ( T(n) ) #3](https://youtu.be/abc)');
		expect(buildMediaEmbed('Video', 'https://youtu.be/abc', 'thumb.jpg', { mediaEmbedMode: 'thumbnail' }))
			.toBe('![Thumbnail](thumb.jpg)');
		expect(buildMediaEmbed('Video', 'https://youtu.be/abc', null, { mediaEmbedMode: 'thumbnail' }))
			.toBeNull();
		expect(buildMediaEmbed('Video', 'https://youtu.be/abc', 'thumb.jpg', { mediaEmbedMode: 'none' }))
			.toBeNull();
	});

	it('resolves playlist media from explicit thumbnails, entries, and first video URLs', () => {
		expect(buildPlaylistMediaEmbed(playlist as any, 'explicit.jpg', { mediaEmbedMode: 'thumbnail' }))
			.toBe('![Thumbnail](explicit.jpg)');
		expect(buildPlaylistMediaEmbed(playlist as any, null, { mediaEmbedMode: 'thumbnail' }))
			.toBe('![Thumbnail](entry-thumb.jpg)');
		expect(buildPlaylistMediaEmbed(playlist as any, null, { mediaEmbedMode: 'video' }))
			.toBe('![Playlist ) Name](https://youtube.com/watch?v=abc123)');
	});

	it('builds video headers with a stable heading level and optional embed', () => {
		expect(buildVideoHeader(transcript as any, 'thumb.jpg', transcript.url, { mediaEmbedMode: 'thumbnail' }, 2))
			.toEqual(['## Video ] Name', '![Thumbnail](thumb.jpg)']);
	});
});
