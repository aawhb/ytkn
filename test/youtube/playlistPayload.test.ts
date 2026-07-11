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

	it('stops paging as soon as the requested entry limit is reached', async () => {
		const loadContinuation = vi.fn(async () => ({
			contents: [{
				playlistVideoRenderer: {
					videoId: 'later-video',
					indexText: { simpleText: '2' },
					title: { simpleText: 'Later Video' },
				},
			}],
		}));

		const entries = await collectPlaylistEntries(initialPayload, 'PL123', loadContinuation, 1);

		expect(entries).toHaveLength(1);
		expect(entries[0].videoId).toBe('b-video');
		expect(loadContinuation).not.toHaveBeenCalled();
	});

	it('does not classify replay text as a currently live video', async () => {
		const entries = await collectPlaylistEntries({
			contents: [{
				playlistVideoRenderer: {
					videoId: 'replay-video',
					title: { simpleText: 'Completed stream replay' },
					thumbnailOverlays: [{
						thumbnailOverlayTimeStatusRenderer: {
							style: 'DEFAULT',
							text: { simpleText: 'LIVE REPLAY' },
						},
					}],
				},
			}],
		}, 'PL123', vi.fn());

		expect(entries).toHaveLength(1);
		expect(entries[0].liveStatus).toBeUndefined();
	});

	it('detects live and upcoming entries from known markers and exact status text', async () => {
		const entries = await collectPlaylistEntries({
			contents: [
				{
					playlistVideoRenderer: {
						videoId: 'styled-live',
						title: { simpleText: 'Styled live video' },
						badges: [{
							metadataBadgeRenderer: { style: 'BADGE_STYLE_TYPE_LIVE_NOW' },
						}],
					},
				},
				{
					playlistVideoRenderer: {
						videoId: 'icon-upcoming',
						title: { simpleText: 'Upcoming video' },
						thumbnailOverlays: [{
							thumbnailOverlayTimeStatusRenderer: {
								style: 'DEFAULT',
								icon: { iconType: 'UPCOMING' },
							},
						}],
					},
				},
				{
					playlistVideoRenderer: {
						videoId: 'text-live-now',
						title: { simpleText: 'Text fallback' },
						thumbnailOverlays: [{
							thumbnailOverlayTimeStatusRenderer: {
								style: 'DEFAULT',
								text: { simpleText: 'LIVE NOW' },
							},
						}],
					},
				},
			],
		}, 'PL123', vi.fn());

		expect(entries.map(({ videoId, liveStatus }) => ({ videoId, liveStatus }))).toEqual([
			{ videoId: 'styled-live', liveStatus: 'live' },
			{ videoId: 'icon-upcoming', liveStatus: 'upcoming' },
			{ videoId: 'text-live-now', liveStatus: 'live' },
		]);
	});
});
