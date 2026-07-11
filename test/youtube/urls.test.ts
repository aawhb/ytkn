import { describe, expect, it } from 'vitest';
import {
	classifyVideoContentType,
	classifyUrls,
	extractChannelRef,
	extractPlaylistId,
	extractUnsupportedChannelTab,
	extractVideoId,
	isPlaylistUrl,
	isYouTubeUrl,
	parseUrls,
} from '../../src/youtube/urls';

describe('YouTube URL helpers', () => {
	it('extracts video and playlist IDs from common URL shapes', () => {
		expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(extractPlaylistId('https://www.youtube.com/watch?v=abc&list=PL123')).toBe('PL123');
		expect(extractPlaylistId('?list=PLfallback')).toBe('PLfallback');
	});

	it('parses and classifies URL lists', () => {
		const urls = parseUrls('https://youtu.be/dQw4w9WgXcQ, https://www.youtube.com/playlist?list=PL123 https://example.com');

		expect(urls).toHaveLength(3);
		expect(isYouTubeUrl(urls[0])).toBe(true);
		expect(isPlaylistUrl(urls[1])).toBe(true);
		expect(classifyUrls(urls)).toEqual(['video', 'playlist', 'invalid']);
	});

	it.each([
		['bare handle', 'https://www.youtube.com/@GoogleDevelopers', { kind: 'handle', value: '@GoogleDevelopers', tab: 'home' }],
		['bare channel ID', 'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw', { kind: 'id', value: 'UC_x5XG1OV2P6uZZ5FSM9Ttw', tab: 'home' }],
		['handle videos tab', 'https://www.youtube.com/@GoogleDevelopers/videos', { kind: 'handle', value: '@GoogleDevelopers', tab: 'videos' }],
		['handle Shorts tab', 'https://www.youtube.com/@GoogleDevelopers/shorts', { kind: 'handle', value: '@GoogleDevelopers', tab: 'shorts' }],
		['channel ID streams tab', 'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw/streams', { kind: 'id', value: 'UC_x5XG1OV2P6uZZ5FSM9Ttw', tab: 'streams' }],
		['legacy custom URL', 'https://www.youtube.com/c/GoogleDevelopers', { kind: 'legacy', value: 'c/GoogleDevelopers', tab: 'home' }],
		['legacy user URL with tab', 'https://www.youtube.com/user/GoogleDevelopers/videos', { kind: 'legacy', value: 'user/GoogleDevelopers', tab: 'videos' }],
	] as const)('parses the %s channel form', (_name, url, expected) => {
		expect(extractChannelRef(url)).toEqual(expected);
		expect(classifyUrls([url])).toEqual(['channel']);
	});

	it('does not steal an ordinary Shorts video URL', () => {
		const url = 'https://www.youtube.com/shorts/mgoNUC-tCAo';

		expect(extractChannelRef(url)).toBeNull();
		expect(classifyUrls([url])).toEqual(['video']);
		expect(classifyVideoContentType(url)).toBe('shorts');
		expect(classifyVideoContentType('https://www.youtube.com/watch?v=mgoNUC-tCAo')).toBe('videos');
	});

	it.each(['featured', 'about', 'community'])(
		'recognizes /%s as a generic channel navigation suffix',
		(suffix) => {
			expect(extractChannelRef(`https://www.youtube.com/@GoogleDevelopers/${suffix}`)).toEqual({
				kind: 'handle',
				value: '@GoogleDevelopers',
				tab: 'home',
			});
		},
	);

	it.each(['playlists', 'podcasts', 'releases'] as const)(
		'distinguishes the unsupported /%s channel content suffix',
		(suffix) => {
			const url = `https://www.youtube.com/@GoogleDevelopers/${suffix}`;

			expect(extractUnsupportedChannelTab(url)).toBe(suffix);
			expect(extractChannelRef(url)).toBeNull();
			expect(classifyUrls([url])).toEqual(['invalid']);
		},
	);

	it('keeps arbitrary trailing channel segments invalid', () => {
		const url = 'https://www.youtube.com/@GoogleDevelopers/something-else';

		expect(extractChannelRef(url)).toBeNull();
		expect(extractUnsupportedChannelTab(url)).toBeNull();
		expect(classifyUrls([url])).toEqual(['invalid']);
	});

	it.each([
		'https://www.youtube.com/@GoogleDevelopers/videos?list=PL123',
		'https://www.youtube.com/@GoogleDevelopers/playlists?list=PL123',
	])('gives a playlist query precedence over the channel path: %s', (url) => {
		expect(extractPlaylistId(url)).toBe('PL123');
		expect(extractUnsupportedChannelTab(url)).toBeNull();
		expect(classifyUrls([url])).toEqual(['playlist']);
	});
});
