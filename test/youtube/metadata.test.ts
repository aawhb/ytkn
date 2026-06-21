import { describe, expect, it } from 'vitest';
import {
	bestProvidedThumbnailUrl,
	buildTranscriptResponseFromPlayer,
	microformatMetadata,
	normalizeHtmlText,
	thumbnailUrlForQuality,
} from '../../src/youtube/metadata';

describe('YouTube metadata helpers', () => {
	it('normalizes HTML text and thumbnail URLs', () => {
		expect(normalizeHtmlText('Tom &amp; Jerry\\n&nbsp;test &#x27;ok&#x27;')).toBe('Tom & Jerry test \'ok\'');
		expect(thumbnailUrlForQuality('abc', 'medium')).toBe('https://img.youtube.com/vi/abc/mqdefault.jpg');
		expect(thumbnailUrlForQuality('abc', 'high')).toBe('https://img.youtube.com/vi/abc/hqdefault.jpg');
		expect(bestProvidedThumbnailUrl([
			{ url: 'small.jpg', width: 120, height: 90 },
			{ url: 'large.jpg', width: 480, height: 360 },
		])).toBe('large.jpg');
	});

	it('extracts supplemental microformat metadata', () => {
		expect(microformatMetadata({
			microformat: {
				playerMicroformatRenderer: {
					uploadDate: '2025-01-02T00:00:00Z',
					category: 'Science &amp; Technology',
				},
			},
		})).toEqual({
			uploadDate: '2025-01-02',
			videoCategory: 'Science & Technology',
		});
	});

	it('builds transcript responses from player data with fallbacks and normalized fields', () => {
		const response = buildTranscriptResponseFromPlayer(
			'https://youtube.com/watch?v=abc',
			'abc',
			{
				videoDetails: {
					title: 'Title &amp; More',
					author: 'Author',
					channelId: 'UC123',
					shortDescription: 'Line one\\nline two',
					lengthSeconds: '42',
					keywords: ['AI', 'AI', ' Notes '],
					thumbnail: { thumbnails: [{ url: 'thumb.jpg', width: 100, height: 100 }] },
				},
			},
			[{ text: 'Transcript', offset: 0 }],
			{ uploadDate: '2025-01-02' },
		);

		expect(response).toMatchObject({
			title: 'Title & More',
			author: 'Author',
			channelUrl: 'https://www.youtube.com/channel/UC123',
			description: 'Line one line two',
			durationSeconds: 42,
			keywords: ['AI', 'Notes'],
			thumbnailUrl: 'thumb.jpg',
			uploadDate: '2025-01-02',
		});
	});
});
