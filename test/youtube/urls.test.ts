import { describe, expect, it } from 'vitest';
import { classifyUrls, extractPlaylistId, extractVideoId, isPlaylistUrl, isYouTubeUrl, parseUrls } from '../../src/youtube/urls';

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
});
