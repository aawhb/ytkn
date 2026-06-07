import { describe, expect, it, vi } from 'vitest';
import { collectPlaylistEntries, playlistTitleFromPayload } from '../../src/youtube/playlistPayload';

const initialPayload = {
	metadata: { playlistMetadataRenderer: { title: 'My &amp; Playlist' } },
	contents: [
		{
			playlistVideoRenderer: {
				videoId: 'b-video',
				index: { simpleText: '2' },
				title: { runs: [{ text: 'Second &amp; Video' }] },
				shortBylineText: {
					runs: [{
						text: 'Channel',
						navigationEndpoint: { browseEndpoint: { browseId: 'UC123', canonicalBaseUrl: '/@channel' } },
					}],
				},
				thumbnail: { thumbnails: [{ url: 'small.jpg', width: 120, height: 90 }, { url: 'large.jpg', width: 480, height: 360 }] },
			},
		},
		{
			continuationItemRenderer: {
				continuationEndpoint: { continuationCommand: { token: 'next-token' } },
			},
		},
	],
};

describe('playlist payload parsing', () => {
	it('finds playlist titles across known payload shapes', () => {
		expect(playlistTitleFromPayload(initialPayload)).toBe('My & Playlist');
		expect(playlistTitleFromPayload({ header: { playlistHeaderRenderer: { title: { simpleText: 'Header title' } } } }))
			.toBe('Header title');
		expect(playlistTitleFromPayload({ pageHeaderRenderer: { pageTitle: 'Page title' } }))
			.toBe('Page title');
	});

	it('collects entries across continuation pages and sorts by position', async () => {
		const loadContinuation = vi.fn(async () => ({
			contents: [
				{
					playlistVideoRenderer: {
						videoId: 'a-video',
						indexText: { simpleText: '1' },
						title: { simpleText: 'First Video' },
					},
				},
			],
		}));

		const entries = await collectPlaylistEntries(initialPayload, 'PL123', loadContinuation);

		expect(loadContinuation).toHaveBeenCalledWith('next-token');
		expect(entries).toEqual([
			{
				videoId: 'a-video',
				url: 'https://www.youtube.com/watch?v=a-video&list=PL123',
				position: 1,
				title: 'First Video',
			},
			{
				videoId: 'b-video',
				url: 'https://www.youtube.com/watch?v=b-video&list=PL123',
				position: 2,
				title: 'Second & Video',
				author: 'Channel',
				channelUrl: 'https://www.youtube.com/@channel',
				channelId: 'UC123',
				thumbnailUrl: 'large.jpg',
			},
		]);
	});
});
