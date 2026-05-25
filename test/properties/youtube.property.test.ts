import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { YouTubeService } from '../../src/services/youtube';
import {
    transcriptTextArbitrary,
    youtubePlaylistIdArbitrary,
    youtubeVideoIdArbitrary,
} from './generators';

describe('YouTube helper property tests', () => {
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

                expect(YouTubeService.isYouTubeUrl(url)).toBe(true);
                expect(YouTubeService.extractVideoId(url)).toBe(videoId);
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

                expect(YouTubeService.extractPlaylistId(url)).toBe(playlistId);
                expect(YouTubeService.isPlaylistUrl(url)).toBe(true);
            },
        ));
    });

    it('parses generated paragraph-style transcript XML into the same ordered lines', () => {
        fc.assert(fc.property(
            fc.uniqueArray(
                fc.record({
                    offset: fc.integer({ min: 0, max: 500_000 }),
                    text: transcriptTextArbitrary,
                }),
                { selector: (line) => line.offset, minLength: 1, maxLength: 6 },
            ),
            (rawLines) => {
                const orderedLines = [...rawLines].sort((left, right) => left.offset - right.offset);
                const xml = `<timedtext>${orderedLines
                    .map((line) => `<p t="${line.offset}" d="1000">${line.text}</p>`)
                    .join('')}</timedtext>`;

                expect(YouTubeService.parseTranscriptXml(xml)).toEqual(orderedLines);
            },
        ));
    });
});
