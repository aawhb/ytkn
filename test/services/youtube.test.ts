import { describe, expect, it, vi } from 'vitest';
import { YouTubeService } from '../../src/services/youtube';
import * as obsidianMock from '../mocks/obsidian';

vi.mock('obsidian', async () => {
	const mod = await import('../mocks/obsidian');
	return mod;
});

describe('YouTubeService URL parsing', () => {
	describe('extractPlaylistId', () => {
		it('reads the list query parameter from playlist and watch urls', () => {
			expect(YouTubeService.extractPlaylistId('https://www.youtube.com/playlist?list=PL123')).toBe('PL123');
			expect(YouTubeService.extractPlaylistId('https://www.youtube.com/watch?v=abcdefghijk&list=PL456')).toBe('PL456');
		});

		it('falls back to a regex when the URL is not strictly parseable', () => {
			expect(YouTubeService.extractPlaylistId('garbled prefix ?list=PL789&foo=bar')).toBe('PL789');
		});

		it('returns null when no list parameter is present', () => {
			expect(YouTubeService.extractPlaylistId('https://www.youtube.com/watch?v=abcdefghijk')).toBeNull();
			expect(YouTubeService.extractPlaylistId('https://example.com/')).toBeNull();
		});
	});

	describe('isPlaylistUrl', () => {
		it('returns true when a playlist id can be extracted', () => {
			expect(YouTubeService.isPlaylistUrl('https://www.youtube.com/playlist?list=PL123')).toBe(true);
		});

		it('returns false for plain video urls and non-YouTube urls', () => {
			expect(YouTubeService.isPlaylistUrl('https://www.youtube.com/watch?v=abcdefghijk')).toBe(false);
			expect(YouTubeService.isPlaylistUrl('https://example.com/page')).toBe(false);
		});
	});

	describe('extractVideoId', () => {
		it('handles the standard watch URL', () => {
			expect(YouTubeService.extractVideoId('https://www.youtube.com/watch?v=abcdefghijk')).toBe('abcdefghijk');
		});

		it('handles the youtu.be short URL', () => {
			expect(YouTubeService.extractVideoId('https://youtu.be/abcdefghijk')).toBe('abcdefghijk');
		});

		it('handles embed and shorts URLs', () => {
			expect(YouTubeService.extractVideoId('https://www.youtube.com/embed/abcdefghijk')).toBe('abcdefghijk');
			expect(YouTubeService.extractVideoId('https://www.youtube.com/shorts/abcdefghijk')).toBe('abcdefghijk');
		});

		it('returns null when no 11-character id is present', () => {
			expect(YouTubeService.extractVideoId('https://www.youtube.com/results?search_query=foo')).toBeNull();
		});
	});

	describe('isYouTubeUrl', () => {
		it('matches youtube.com and youtu.be hosts', () => {
			expect(YouTubeService.isYouTubeUrl('https://www.youtube.com/watch?v=abcdefghijk')).toBe(true);
			expect(YouTubeService.isYouTubeUrl('http://youtube.com/watch?v=abcdefghijk')).toBe(true);
			expect(YouTubeService.isYouTubeUrl('https://youtu.be/abcdefghijk')).toBe(true);
		});

		it('rejects unrelated URLs and non-URL strings', () => {
			expect(YouTubeService.isYouTubeUrl('https://example.com/path')).toBe(false);
			expect(YouTubeService.isYouTubeUrl('selected text that is not a url')).toBe(false);
		});
	});

	describe('getThumbnailUrl', () => {
		it('returns maxres by default', () => {
			expect(YouTubeService.getThumbnailUrl('abc')).toBe('https://img.youtube.com/vi/abc/mqdefault.jpg');
		});

		it('respects an explicit quality slug', () => {
			expect(YouTubeService.getThumbnailUrl('abc', 'medium')).toBe('https://img.youtube.com/vi/abc/mqdefault.jpg');
			expect(YouTubeService.getThumbnailUrl('abc', 'high')).toBe('https://img.youtube.com/vi/abc/hqdefault.jpg');
			expect(YouTubeService.getThumbnailUrl('abc', 'default')).toBe('https://img.youtube.com/vi/abc/default.jpg');
		});
	});
});

describe('YouTubeService.parsePlaylistFromHtml', () => {
	function htmlWithInitialData(payload: unknown, opts: { marker?: string; htmlTitle?: string } = {}): string {
		const marker = opts.marker ?? 'var ytInitialData = ';
		const titleTag = opts.htmlTitle !== undefined
			? `<title>${opts.htmlTitle}</title>`
			: '';
		return `<!doctype html><html><head>${titleTag}</head><body><script>${marker}${JSON.stringify(payload)};</script></body></html>`;
	}

	const videoRenderer = (videoId: string, title: string, indexText?: string) => ({
		playlistVideoRenderer: {
			videoId,
			title: { runs: [{ text: title }] },
			...(indexText !== undefined ? { indexText: { simpleText: indexText } } : {}),
		},
	});

	it('extracts entries, decodes title runs, and builds canonical playlist URLs', () => {
		const payload = {
			contents: [
				videoRenderer('vid000000001', 'First &amp; intro', '1'),
				videoRenderer('vid000000002', 'Second video', '2'),
			],
			metadata: {
				playlistMetadataRenderer: { title: 'My &quot;Playlist&quot;' },
			},
		};

		const result = YouTubeService.parsePlaylistFromHtml(
			htmlWithInitialData(payload),
			'PL123',
		);

		expect(result.title).toBe('My "Playlist"');
		expect(result.entries).toEqual([
			{
				videoId: 'vid000000001',
				url: 'https://www.youtube.com/watch?v=vid000000001&list=PL123',
				position: 1,
				title: 'First & intro',
			},
			{
				videoId: 'vid000000002',
				url: 'https://www.youtube.com/watch?v=vid000000002&list=PL123',
				position: 2,
				title: 'Second video',
			},
		]);
		expect(result.continuationToken).toBeNull();
	});

	it('deduplicates videos repeated across the tree (e.g. sidebar + main grid)', () => {
		const payload = {
			contents: [videoRenderer('dupVideoIdX', 'Original')],
			sidebar: { items: [videoRenderer('dupVideoIdX', 'Sidebar copy')] },
		};

		const result = YouTubeService.parsePlaylistFromHtml(htmlWithInitialData(payload), 'PL');

		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].title).toBe('Original');
	});

	it('falls back to playlistPanelVideoRenderer when the modern renderer is absent', () => {
		const payload = {
			items: [
				{
					playlistPanelVideoRenderer: {
						videoId: 'panelVid001',
						title: { simpleText: 'Panel Title' },
						indexText: { runs: [{ text: '7' }] },
					},
				},
			],
		};

		const { entries } = YouTubeService.parsePlaylistFromHtml(htmlWithInitialData(payload), 'PLp');

		expect(entries).toEqual([
			{
				videoId: 'panelVid001',
				url: 'https://www.youtube.com/watch?v=panelVid001&list=PLp',
				position: 7,
				title: 'Panel Title',
			},
		]);
	});

	it('falls back to a sequential position when indexText is missing or unparsable', () => {
		const payload = {
			contents: [
				videoRenderer('vidNoIndexA', 'A'),
				{
					playlistVideoRenderer: {
						videoId: 'vidNoIndexB',
						title: { runs: [{ text: 'B' }] },
						indexText: { simpleText: 'not a number' },
					},
				},
			],
		};

		const { entries } = YouTubeService.parsePlaylistFromHtml(htmlWithInitialData(payload), 'PL');

		expect(entries.map((e) => e.position)).toEqual([1, 2]);
	});

	it('uses a "Video N" placeholder title when the renderer has no usable title', () => {
		const payload = {
			contents: [
				{
					playlistVideoRenderer: { videoId: 'noTitleVid1' },
				},
			],
		};

		const { entries } = YouTubeService.parsePlaylistFromHtml(htmlWithInitialData(payload), 'PL');

		expect(entries[0].title).toBe('Video 1');
	});

	it('extracts the modern continuationItemRenderer token', () => {
		const payload = {
			contents: [
				videoRenderer('vid000000001', 'A', '1'),
				{
					continuationItemRenderer: {
						continuationEndpoint: {
							continuationCommand: { token: 'NEXT_PAGE_TOKEN_42' },
						},
					},
				},
			],
		};

		const { continuationToken } = YouTubeService.parsePlaylistFromHtml(
			htmlWithInitialData(payload),
			'PL',
		);

		expect(continuationToken).toBe('NEXT_PAGE_TOKEN_42');
	});

	it('falls back to legacy nextContinuationData when continuationItemRenderer is absent', () => {
		const payload = {
			contents: [videoRenderer('vid000000001', 'A', '1')],
			continuations: [
				{ nextContinuationData: { continuation: 'LEGACY_TOKEN_99' } },
			],
		};

		const { continuationToken } = YouTubeService.parsePlaylistFromHtml(
			htmlWithInitialData(payload),
			'PL',
		);

		expect(continuationToken).toBe('LEGACY_TOKEN_99');
	});

	it('decodes HTML-entity-encoded titles via playlistHeaderRenderer when the metadata renderer is missing', () => {
		const payload = {
			header: {
				playlistHeaderRenderer: {
					title: { simpleText: 'Header Title &amp; More' },
				},
			},
			contents: [videoRenderer('vid000000001', 'A', '1')],
		};

		const { title } = YouTubeService.parsePlaylistFromHtml(htmlWithInitialData(payload), 'PL');

		expect(title).toBe('Header Title & More');
	});

	it('falls back to the <title> tag when no in-payload title is found, stripping the trailing " - YouTube"', () => {
		const payload = {
			contents: [videoRenderer('vid000000001', 'A', '1')],
		};
		const html = htmlWithInitialData(payload, { htmlTitle: 'My Playlist - YouTube' });

		const { title } = YouTubeService.parsePlaylistFromHtml(html, 'PL');

		expect(title).toBe('My Playlist');
	});

	it('falls back to a "Playlist <id>" string when no title is available anywhere', () => {
		const payload = { contents: [videoRenderer('vid000000001', 'A', '1')] };

		const { title } = YouTubeService.parsePlaylistFromHtml(htmlWithInitialData(payload), 'PL999');

		expect(title).toBe('Playlist PL999');
	});

	it('throws a clear error when ytInitialData cannot be located on the page', () => {
		expect(() =>
			YouTubeService.parsePlaylistFromHtml('<html><body>no payload here</body></html>', 'PL'),
		).toThrow(/Failed to extract playlist metadata/);
	});

	it('recognizes the alternate window["ytInitialData"] marker variant', () => {
		const payload = {
			contents: [videoRenderer('vid000000001', 'A', '1')],
			metadata: { playlistMetadataRenderer: { title: 'Alt' } },
		};
		const html = htmlWithInitialData(payload, { marker: 'window["ytInitialData"] = ' });

		const { title, entries } = YouTubeService.parsePlaylistFromHtml(html, 'PL');

		expect(title).toBe('Alt');
		expect(entries).toHaveLength(1);
	});

	it('reads the balanced JSON correctly when the payload contains nested braces and escaped quotes', () => {
		const payload = {
			metadata: {
				playlistMetadataRenderer: {
					title: 'Curly { brace } and "quote" inside',
				},
			},
			contents: [
				{
					playlistVideoRenderer: {
						videoId: 'tricky00001',
						title: { runs: [{ text: 'Has { } in title' }] },
						indexText: { simpleText: '1' },
					},
				},
			],
		};

		const html = `<script>var ytInitialData = ${JSON.stringify(payload)}; var other = { a: 1 };</script>`;

		const result = YouTubeService.parsePlaylistFromHtml(html, 'PL');

		expect(result.title).toBe('Curly { brace } and "quote" inside');
		expect(result.entries[0].title).toBe('Has { } in title');
	});

	it('sorts entries by playlist position even when the tree visits them out of order', () => {
		const payload = {
			contents: [
				videoRenderer('vidThirdItem', 'Third', '3'),
				videoRenderer('vidFirstItem', 'First', '1'),
				videoRenderer('vidSecndItem', 'Second', '2'),
			],
		};

		const { entries } = YouTubeService.parsePlaylistFromHtml(htmlWithInitialData(payload), 'PL');

		expect(entries.map((e) => e.title)).toEqual(['First', 'Second', 'Third']);
	});

	it('supports the index.simpleText shape (older grid layout)', () => {
		const payload = {
			contents: [
				{
					playlistVideoRenderer: {
						videoId: 'oldShape001',
						title: { runs: [{ text: 'Old' }] },
						index: { simpleText: '5' },
					},
				},
			],
		};

		const { entries } = YouTubeService.parsePlaylistFromHtml(htmlWithInitialData(payload), 'PL');

		expect(entries[0].position).toBe(5);
	});
});

describe('YouTubeService.parseTranscriptXml', () => {
	it('parses paragraph-style captions, decoding entities and stripping inner tags', () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<timedtext>
<p t="0" d="1500">Hello &amp; welcome.</p>
<p t="1500" d="2000"><s>Second</s> line — short.</p>
</timedtext>`;

		const lines = YouTubeService.parseTranscriptXml(xml);

		expect(lines).toEqual([
			{ text: 'Hello & welcome.', offset: 0 },
			{ text: 'Second line — short.', offset: 1500 },
		]);
	});

	it('falls back to <text> captions when no <p> tags are present', () => {
		const xml = `<transcript>
<text start="0.5" dur="1.2">First &#39;line&#39;</text>
<text start="2.0" dur="0.5">Second line</text>
</transcript>`;

		const lines = YouTubeService.parseTranscriptXml(xml);

		expect(lines).toEqual([
			{ text: "First 'line'", offset: 500 },
			{ text: 'Second line', offset: 2000 },
		]);
	});

	it('skips entries with no usable text after decoding/whitespace collapse', () => {
		const xml = `<doc>
<p t="0" d="100">  </p>
<p t="100" d="100">Real line</p>
<p t="200" d="100"><tag></tag></p>
</doc>`;

		const lines = YouTubeService.parseTranscriptXml(xml);

		expect(lines).toEqual([{ text: 'Real line', offset: 100 }]);
	});

	it('skips paragraph entries that lack a start attribute', () => {
		const xml = `<doc>
<p d="100">No start, ignored</p>
<p t="500" d="100">Kept</p>
</doc>`;

		const lines = YouTubeService.parseTranscriptXml(xml);

		expect(lines).toEqual([{ text: 'Kept', offset: 500 }]);
	});

	it('throws a clear error when no caption segments are present', () => {
		expect(() => YouTubeService.parseTranscriptXml('<doc></doc>')).toThrow(
			/no caption segments found/,
		);
	});

	it('decodes the broad set of entities the plugin uses (numeric, gt/lt, quote/apos)', () => {
		const xml = `<doc><p t="0" d="100">A &lt;b&gt; &quot;c&quot; &apos;d&apos; &#65;</p></doc>`;

		const lines = YouTubeService.parseTranscriptXml(xml);

		expect(lines).toEqual([{ text: 'A <b> "c" \'d\' A', offset: 0 }]);
	});

	it('collapses runs of whitespace and converts literal "\\n" sequences to spaces', () => {
		const xml = `<doc><p t="0" d="100">multi\\nline\n   spaced</p></doc>`;

		const lines = YouTubeService.parseTranscriptXml(xml);

		expect(lines).toEqual([{ text: 'multi line spaced', offset: 0 }]);
	});
});

describe('YouTubeService.parseUrls', () => {
	it('splits on whitespace', () => {
		expect(YouTubeService.parseUrls('url1 url2   url3')).toEqual(['url1', 'url2', 'url3']);
	});

	it('splits on commas', () => {
		expect(YouTubeService.parseUrls('url1,url2,url3')).toEqual(['url1', 'url2', 'url3']);
	});

	it('splits on mixed comma and whitespace', () => {
		expect(YouTubeService.parseUrls('url1, url2 ,  url3')).toEqual(['url1', 'url2', 'url3']);
	});

	it('filters empty tokens', () => {
		expect(YouTubeService.parseUrls('  url1  ')).toEqual(['url1']);
	});

	it('returns empty array for blank input', () => {
		expect(YouTubeService.parseUrls('   ')).toEqual([]);
	});
});

describe('YouTubeService.classifyUrls', () => {
	it('returns video for plain watch URLs', () => {
		expect(YouTubeService.classifyUrls(['https://www.youtube.com/watch?v=abcdefghijk'])).toEqual(['video']);
	});

	it('returns playlist for playlist URLs', () => {
		expect(YouTubeService.classifyUrls(['https://www.youtube.com/playlist?list=PL123'])).toEqual(['playlist']);
	});

	it('returns invalid for non-YouTube URLs', () => {
		expect(YouTubeService.classifyUrls(['https://example.com/page'])).toEqual(['invalid']);
	});

	it('classifies a mixed array correctly', () => {
		const urls = [
			'https://www.youtube.com/watch?v=abcdefghijk',
			'https://www.youtube.com/playlist?list=PL123',
			'not-a-url',
		];
		expect(YouTubeService.classifyUrls(urls)).toEqual(['video', 'playlist', 'invalid']);
	});
});

describe('YouTubeService.fetchVideoTitle', () => {
	it('returns the title from the oEmbed response', async () => {
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockResolvedValue({
			json: { title: 'My Test Video' },
			text: '',
		});
		const svc = new YouTubeService();
		const title = await svc.fetchVideoTitle('dQw4w9WgXcQ');
		expect(title).toBe('My Test Video');
		expect(spy).toHaveBeenCalledWith(
			expect.objectContaining({ url: expect.stringContaining('oembed') }),
		);
		spy.mockRestore();
	});

	it('throws when oEmbed response has no title', async () => {
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockResolvedValue({ json: {}, text: '' });
		const svc = new YouTubeService();
		await expect(svc.fetchVideoTitle('dQw4w9WgXcQ')).rejects.toThrow('No title');
		spy.mockRestore();
	});
});

describe('YouTubeService.fetchTranscript', () => {
	it('fetches transcript metadata and caption lines from mocked YouTube responses', async () => {
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			if (request.url.includes('/youtubei/v1/player')) {
				return {
					json: {},
					text: JSON.stringify({
						videoDetails: {
							title: 'Video &amp; Title',
							author: 'Author &amp; Channel',
							channelId: 'UC123',
							shortDescription: 'A video &amp; description.',
							lengthSeconds: '123',
							keywords: ['Topic', 'Topic', 'Another &amp; topic'],
							thumbnail: {
								thumbnails: [
									{ url: 'https://img.example/small.jpg', width: 120, height: 90 },
									{ url: 'https://img.example/large.jpg', width: 640, height: 360 },
								],
							},
						},
						captions: {
							playerCaptionsTracklistRenderer: {
								captionTracks: [{ baseUrl: 'https://captions.example/en', languageCode: 'en' }],
							},
						},
					}),
				};
			}

			if (request.url === 'https://captions.example/en') {
				return {
					json: {},
					text: '<timedtext><p t="0" d="1000">Hello &amp; transcript</p></timedtext>',
				};
			}

			throw new Error(`Unexpected request: ${request.url}`);
		});

		const svc = new YouTubeService();
		const result = await svc.fetchTranscript('https://www.youtube.com/watch?v=abcdefghijk');

		expect(result).toEqual({
			languageCode: 'en',
			transcript: {
				url: 'https://www.youtube.com/watch?v=abcdefghijk',
				videoId: 'abcdefghijk',
				title: 'Video & Title',
				author: 'Author & Channel',
				channelId: 'UC123',
				channelUrl: 'https://www.youtube.com/channel/UC123',
				description: 'A video & description.',
				thumbnailUrl: 'https://img.example/large.jpg',
				durationSeconds: 123,
				keywords: ['Topic', 'Another & topic'],
				lines: [{ text: 'Hello & transcript', offset: 0 }],
			},
		});
		expect(spy).toHaveBeenCalledTimes(2);
		spy.mockRestore();
	});

	it('uses a preferred language variant when an exact caption language is unavailable', async () => {
		const requestedUrls: string[] = [];
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			requestedUrls.push(request.url);
			if (request.url.includes('/youtubei/v1/player')) {
				return {
					json: {},
					text: JSON.stringify({
						videoDetails: { title: 'Variant', author: 'Channel' },
						captions: {
							playerCaptionsTracklistRenderer: {
								captionTracks: [
									{ baseUrl: 'https://captions.example/fr', languageCode: 'fr' },
									{ baseUrl: 'https://captions.example/en-us', languageCode: 'en-US' },
								],
							},
						},
					}),
				};
			}

			return {
				json: {},
				text: '<timedtext><p t="250" d="1000">Preferred language</p></timedtext>',
			};
		});

		const svc = new YouTubeService();
		const result = await svc.fetchTranscript('https://youtu.be/abcdefghijk', {
			languageMode: 'preferred',
			preferredLanguageCode: 'en',
		});

		expect(result.languageCode).toBe('en-US');
		expect(result.transcript.lines).toEqual([{ text: 'Preferred language', offset: 250 }]);
		expect(requestedUrls).toContain('https://captions.example/en-us');
		spy.mockRestore();
	});

	it('preserves the transcript failure prefix callers use for error classification', async () => {
		const svc = new YouTubeService();

		await expect(svc.fetchTranscript('not a YouTube URL')).rejects.toThrow(
			/^Failed to fetch transcript: Invalid YouTube URL/,
		);
	});
});

describe('YouTubeService.fetchVideoMetadata', () => {
	it('fetches player metadata without requiring caption tracks', async () => {
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			if (request.url.includes('/youtubei/v1/player')) {
				return {
					json: {},
					text: JSON.stringify({
						videoDetails: {
							title: 'Metadata &amp; Only',
							author: 'Author &amp; Channel',
							channelId: 'UC123',
							shortDescription: 'A metadata &amp; description.',
							lengthSeconds: '456',
							keywords: ['Topic', 'Topic', 'Manual &amp; notes'],
							thumbnail: {
								thumbnails: [
									{ url: 'https://img.example/small.jpg', width: 120, height: 90 },
									{ url: 'https://img.example/large.jpg', width: 640, height: 360 },
								],
							},
						},
					}),
				};
			}

			throw new Error(`Unexpected request: ${request.url}`);
		});

		const svc = new YouTubeService();
		const result = await svc.fetchVideoMetadata('https://www.youtube.com/watch?v=abcdefghijk');

		expect(result).toEqual({
			url: 'https://www.youtube.com/watch?v=abcdefghijk',
			videoId: 'abcdefghijk',
			title: 'Metadata & Only',
			author: 'Author & Channel',
			channelId: 'UC123',
			channelUrl: 'https://www.youtube.com/channel/UC123',
			description: 'A metadata & description.',
			thumbnailUrl: 'https://img.example/large.jpg',
			durationSeconds: 456,
			keywords: ['Topic', 'Manual & notes'],
			lines: [],
		});
		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});

	it('keeps unavailable video failures explicit', async () => {
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockResolvedValue({
			json: {},
			text: JSON.stringify({
				playabilityStatus: {
					status: 'LOGIN_REQUIRED',
					reason: 'Sign in to confirm your age',
				},
			}),
		});

		const svc = new YouTubeService();
		await expect(svc.fetchVideoMetadata('https://www.youtube.com/watch?v=abcdefghijk')).rejects.toThrow(
			/^Failed to fetch video metadata: This video requires login to view/,
		);
		spy.mockRestore();
	});

	it('preserves the metadata failure prefix callers can classify', async () => {
		const svc = new YouTubeService();

		await expect(svc.fetchVideoMetadata('not a YouTube URL')).rejects.toThrow(
			/^Failed to fetch video metadata: Invalid YouTube URL/,
		);
	});
});

describe('YouTubeService.fetchPlaylist', () => {
	function htmlWithInitialData(payload: unknown): string {
		return `<!doctype html><script>var ytInitialData = ${JSON.stringify(payload)};</script>`;
	}

	function renderer(videoId: string, title: string, index: string): unknown {
		return {
			playlistVideoRenderer: {
				videoId,
				title: { simpleText: title },
				indexText: { simpleText: index },
			},
		};
	}

	it('follows playlist continuation tokens and deduplicates paged entries', async () => {
		const firstPage = {
			metadata: { playlistMetadataRenderer: { title: 'Paged Playlist' } },
			contents: [
				renderer('firstVideo01', 'First', '1'),
				{
					continuationItemRenderer: {
						continuationEndpoint: {
							continuationCommand: { token: 'NEXT_TOKEN' },
						},
					},
				},
			],
		};
		const secondPage = {
			contents: [
				renderer('firstVideo01', 'Duplicate', '1'),
				renderer('secondVideo2', 'Second', '2'),
			],
		};
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			if (request.url.includes('/playlist?list=PL123')) {
				return { json: {}, text: htmlWithInitialData(firstPage) };
			}

			if (request.url.includes('/youtubei/v1/browse')) {
				return { json: {}, text: JSON.stringify(secondPage) };
			}

			throw new Error(`Unexpected request: ${request.url}`);
		});

		const svc = new YouTubeService();
		const playlist = await svc.fetchPlaylist('https://www.youtube.com/playlist?list=PL123');

		expect(playlist).toEqual({
			url: 'https://www.youtube.com/playlist?list=PL123',
			playlistId: 'PL123',
			title: 'Paged Playlist',
			entries: [
				{
					videoId: 'firstVideo01',
					url: 'https://www.youtube.com/watch?v=firstVideo01&list=PL123',
					position: 1,
					title: 'First',
				},
				{
					videoId: 'secondVideo2',
					url: 'https://www.youtube.com/watch?v=secondVideo2&list=PL123',
					position: 2,
					title: 'Second',
				},
			],
		});
		expect(spy).toHaveBeenCalledTimes(2);
		spy.mockRestore();
	});

	it('follows nested playlist command-executor continuation tokens past the first 100 entries', async () => {
		const firstEntries = Array.from({ length: 100 }, (_value, index) =>
			renderer(`video${String(index + 1).padStart(6, '0')}`, `Video ${index + 1}`, `${index + 1}`));
		const firstPage = {
			metadata: { playlistMetadataRenderer: { title: 'Long Playlist' } },
			contents: [
				{
					playlistVideoListRenderer: {
						contents: [
							...firstEntries,
							{
								continuationItemRenderer: {
									continuationEndpoint: {
										commandExecutorCommand: {
											commands: [
												{ signalAction: { signal: 'NOOP' } },
												{ continuationCommand: { token: 'PLAYLIST_NEXT_TOKEN' } },
											],
										},
									},
								},
							},
						],
					},
				},
				{
					continuationItemRenderer: {
						continuationEndpoint: {
							continuationCommand: { token: 'UNRELATED_SECTION_TOKEN' },
						},
					},
				},
			],
		};
		const secondPage = {
			contents: [
				renderer('video000101', 'Video 101', '101'),
				renderer('video000102', 'Video 102', '102'),
			],
		};
		const continuationBodies: string[] = [];
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			if (request.url.includes('/playlist?list=PLLONG')) {
				return { json: {}, text: htmlWithInitialData(firstPage) };
			}

			if (request.url.includes('/youtubei/v1/browse')) {
				continuationBodies.push(request.body ?? '');
				return { json: {}, text: JSON.stringify(secondPage) };
			}

			throw new Error(`Unexpected request: ${request.url}`);
		});

		const svc = new YouTubeService();
		const playlist = await svc.fetchPlaylist('https://www.youtube.com/playlist?list=PLLONG');

		expect(playlist.entries).toHaveLength(102);
		expect(playlist.entries[0].title).toBe('Video 1');
		expect(playlist.entries[101]).toEqual({
			videoId: 'video000102',
			url: 'https://www.youtube.com/watch?v=video000102&list=PLLONG',
			position: 102,
			title: 'Video 102',
		});
		expect(continuationBodies).toHaveLength(1);
		expect(continuationBodies[0]).toContain('PLAYLIST_NEXT_TOKEN');
		expect(continuationBodies[0]).not.toContain('UNRELATED_SECTION_TOKEN');
		spy.mockRestore();
	});
});
