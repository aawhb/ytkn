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
	function renderer(videoId: string, title: string, index: string): unknown {
		return {
			playlistVideoRenderer: {
				videoId,
				title: { simpleText: title },
				indexText: { simpleText: index },
			},
		};
	}

	function androidRenderer(videoId: string, title: string, index: string): unknown {
		return {
			playlistVideoRenderer: {
				videoId,
				title: { runs: [{ text: title }] },
				index: { runs: [{ text: index }] },
			},
		};
	}

	it('fetches the initial playlist page through Browse JSON and follows continuations', async () => {
		const firstPage = {
			header: {
				pageHeaderRenderer: { pageTitle: 'Paged Playlist &amp; More' },
			},
			contents: {
				singleColumnBrowseResultsRenderer: {
					tabs: [
						{
							tabRenderer: {
								content: {
									sectionListRenderer: {
										contents: [
											{
												playlistVideoListRenderer: {
													contents: [
														androidRenderer('firstVideo01', 'First &amp; Android', '1'),
													],
													continuations: [
														{
															nextContinuationData: {
																continuation: 'NEXT_TOKEN',
															},
														},
													],
												},
											},
										],
									},
								},
							},
						},
					],
				},
			},
		};
		const secondPage = {
			contents: [
				androidRenderer('firstVideo01', 'Duplicate', '1'),
				androidRenderer('secondVideo2', 'Second', '2'),
			],
		};
		const requestBodies: string[] = [];
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			if (request.url.includes('/playlist?list=')) {
				throw new Error('The HTML playlist endpoint should not be requested');
			}

			if (request.url.includes('/youtubei/v1/browse')) {
				const body = request.body ?? '';
				requestBodies.push(body);
				if (body.includes('"browseId":"VLPL123"')) {
					return { json: {}, text: JSON.stringify(firstPage) };
				}

				if (body.includes('"continuation":"NEXT_TOKEN"')) {
					return { json: {}, text: JSON.stringify(secondPage) };
				}

				throw new Error(`Unexpected browse body: ${body}`);
			}

			throw new Error(`Unexpected request: ${request.url}`);
		});

		const svc = new YouTubeService();
		const playlist = await svc.fetchPlaylist('https://www.youtube.com/playlist?list=PL123');

		expect(playlist).toEqual({
			url: 'https://www.youtube.com/playlist?list=PL123',
			playlistId: 'PL123',
			title: 'Paged Playlist & More',
			entries: [
				{
					videoId: 'firstVideo01',
					url: 'https://www.youtube.com/watch?v=firstVideo01&list=PL123',
					position: 1,
					title: 'First & Android',
				},
				{
					videoId: 'secondVideo2',
					url: 'https://www.youtube.com/watch?v=secondVideo2&list=PL123',
					position: 2,
					title: 'Second',
				},
			],
		});
		expect(requestBodies).toHaveLength(2);
		expect(requestBodies[0]).toContain('"browseId":"VLPL123"');
		expect(requestBodies[0]).not.toContain('/playlist?list=PL123');
		expect(requestBodies[1]).toContain('"continuation":"NEXT_TOKEN"');
		spy.mockRestore();
	});

	it('resolves playlist titles through Browse JSON', async () => {
		const titlePayload = {
			header: {
				pageHeaderRenderer: { pageTitle: 'Browse Title &amp; Details' },
			},
		};
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			if (request.url.includes('/playlist?list=')) {
				throw new Error('The HTML playlist endpoint should not be requested');
			}

			if (request.url.includes('/youtubei/v1/browse')) {
				return { json: {}, text: JSON.stringify(titlePayload) };
			}

			throw new Error(`Unexpected request: ${request.url}`);
		});

		const svc = new YouTubeService();
		const title = await svc.fetchPlaylistTitle('PLTITLE');

		expect(title).toBe('Browse Title & Details');
		expect(spy).toHaveBeenCalledWith(expect.objectContaining({
			body: expect.stringContaining('"browseId":"VLPLTITLE"'),
			method: 'POST',
		}));
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
			if (request.url.includes('/playlist?list=')) {
				throw new Error('The HTML playlist endpoint should not be requested');
			}

			if (request.url.includes('/youtubei/v1/browse')) {
				const body = request.body ?? '';
				if (body.includes('"browseId":"VLPLLONG"')) {
					return { json: {}, text: JSON.stringify(firstPage) };
				}

				continuationBodies.push(body);
				if (body.includes('"continuation":"PLAYLIST_NEXT_TOKEN"')) {
					return { json: {}, text: JSON.stringify(secondPage) };
				}

				throw new Error(`Unexpected browse body: ${body}`);
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
