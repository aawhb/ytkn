import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import * as obsidian from 'obsidian';
import { requestCaptionLines } from '../../src/youtube/captions';
import { classifyUrls, extractPlaylistId, extractVideoId, isYouTubeUrl } from '../../src/youtube/urls';
import {
	transcriptTextArbitrary,
	youtubePlaylistIdArbitrary,
	youtubeVideoIdArbitrary,
} from '../properties/generators';

describe('YouTube helper property tests', () => {
	afterEach(() => vi.restoreAllMocks());

	it('extracts the video id from supported YouTube URL shapes', () => {
		fc.assert(fc.property(
			youtubeVideoIdArbitrary,
			fc.constantFrom<'watch' | 'short' | 'embed' | 'shorts'>('watch', 'short', 'embed', 'shorts'),
			(videoId, kind) => {
				const url = kind === 'watch'
					? `https://www.youtube.com/watch?v=${videoId}`
					: kind === 'short'
						? `https://youtu.be/${videoId}`
						: kind === 'embed'
							? `https://www.youtube.com/embed/${videoId}`
							: `https://www.youtube.com/shorts/${videoId}`;

				expect(isYouTubeUrl(url)).toBe(true);
				expect(extractVideoId(url)).toBe(videoId);
			},
		));
	});

	it('extracts playlist ids and recognizes playlist URLs across supported query forms', () => {
		fc.assert(fc.property(
			youtubePlaylistIdArbitrary,
			youtubeVideoIdArbitrary,
			fc.constantFrom<'playlist' | 'watch'>('playlist', 'watch'),
			(playlistId, videoId, kind) => {
				const url = kind === 'playlist'
					? `https://www.youtube.com/playlist?list=${playlistId}`
					: `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`;

				expect(extractPlaylistId(url)).toBe(playlistId);
				expect(classifyUrls([url])).toEqual(['playlist']);
			},
		));
	});

	it('parses generated paragraph-style transcript XML into the same ordered lines', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl');
		await fc.assert(fc.asyncProperty(
			fc.uniqueArray(
				fc.record({
					offset: fc.integer({ min: 0, max: 500_000 }),
					text: transcriptTextArbitrary,
				}),
				{ selector: (line) => line.offset, minLength: 1, maxLength: 6 },
			),
			async (rawLines) => {
				const orderedLines = [...rawLines].sort((left, right) => left.offset - right.offset);
				const xml = `<timedtext>${orderedLines
					.map((line) => `<p t="${line.offset}" d="1000">${line.text}</p>`)
					.join('')}</timedtext>`;
				requestUrlSpy.mockResolvedValueOnce({
					text: xml,
					status: 200,
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
					json: undefined,
				} as any);

				expect(await requestCaptionLines('https://youtube.example/captions')).toEqual(orderedLines);
			},
		));
	});
});
