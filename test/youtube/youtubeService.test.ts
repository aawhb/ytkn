import { describe, expect, it, vi } from 'vitest';
import { YouTubeService } from '../../src/youtube/youtubeService';
import * as obsidianMock from '../mocks/obsidian';

vi.mock('obsidian', async () => {
	const mod = await import('../mocks/obsidian');
	return mod;
});

function playerClientName(request: { body?: unknown }): string | null {
	if (typeof request.body !== 'string') {
		return null;
	}

	try {
		const parsed = JSON.parse(request.body) as { context?: { client?: { clientName?: unknown } } };
		const clientName = parsed.context?.client?.clientName;
		return typeof clientName === 'string' ? clientName : null;
	} catch {
		return null;
	}
}

describe('YouTubeService video title fetching', () => {
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
				if (playerClientName(request) === 'WEB') {
					return {
						json: {},
						text: JSON.stringify({
							playabilityStatus: {
								status: 'UNPLAYABLE',
								reason: 'Video unavailable',
							},
							microformat: {
								playerMicroformatRenderer: {
									uploadDate: '2024-03-05T12:34:56-06:00',
									category: 'Science &amp; Technology',
								},
							},
						}),
					};
				}

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
				uploadDate: '2024-03-05',
				videoCategory: 'Science & Technology',
				durationSeconds: 123,
				keywords: ['Topic', 'Another & topic'],
				lines: [{ text: 'Hello & transcript', offset: 0 }],
			},
		});
		expect(spy).toHaveBeenCalledTimes(3);
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
				if (playerClientName(request) === 'WEB') {
					return {
						json: {},
						text: JSON.stringify({
							microformat: {
								playerMicroformatRenderer: {
									uploadDate: '2023-11-09',
									category: 'Education',
								},
							},
						}),
					};
				}

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
			uploadDate: '2023-11-09',
			videoCategory: 'Education',
			durationSeconds: 456,
			keywords: ['Topic', 'Manual & notes'],
			lines: [],
		});
		expect(spy).toHaveBeenCalledTimes(2);
		spy.mockRestore();
	});

	it('omits supplemental metadata when the web microformat lookup fails', async () => {
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			if (request.url.includes('/youtubei/v1/player') && playerClientName(request) === 'WEB') {
				throw new Error('web metadata unavailable');
			}

			if (request.url.includes('/youtubei/v1/player')) {
				return {
					json: {},
					text: JSON.stringify({
						videoDetails: {
							title: 'Metadata Only',
							author: 'Author',
						},
					}),
				};
			}

			throw new Error(`Unexpected request: ${request.url}`);
		});

		const svc = new YouTubeService();
		const result = await svc.fetchVideoMetadata('https://www.youtube.com/watch?v=abcdefghijk');

		expect(result.uploadDate).toBeUndefined();
		expect(result.videoCategory).toBeUndefined();
		expect(result.title).toBe('Metadata Only');
		spy.mockRestore();
	});

	it('rejects invalid supplemental metadata values without failing metadata fetch', async () => {
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			if (request.url.includes('/youtubei/v1/player') && playerClientName(request) === 'WEB') {
				return {
					json: {},
					text: JSON.stringify({
						microformat: {
							playerMicroformatRenderer: {
								uploadDate: 'November 9, 2023',
								category: '   ',
							},
						},
					}),
				};
			}

			if (request.url.includes('/youtubei/v1/player')) {
				return {
					json: {},
					text: JSON.stringify({
						videoDetails: {
							title: 'Metadata Only',
							author: 'Author',
						},
					}),
				};
			}

			throw new Error(`Unexpected request: ${request.url}`);
		});

		const svc = new YouTubeService();
		const result = await svc.fetchVideoMetadata('https://www.youtube.com/watch?v=abcdefghijk');

		expect(result.uploadDate).toBeUndefined();
		expect(result.videoCategory).toBeUndefined();
		expect(result.title).toBe('Metadata Only');
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

	function androidRenderer(
		videoId: string,
		title: string,
		index: string,
		thumbnailUrl?: string,
		byline?: { author: string; channelId?: string; canonicalBaseUrl?: string },
	): unknown {
		const item: any = {
			playlistVideoRenderer: {
				videoId,
				title: { runs: [{ text: title }] },
				index: { runs: [{ text: index }] },
			},
		};

		if (thumbnailUrl) {
			item.playlistVideoRenderer.thumbnail = {
				thumbnails: [
					{ url: `${thumbnailUrl}/small.jpg`, width: 120, height: 90 },
					{ url: `${thumbnailUrl}/large.jpg`, width: 640, height: 360 },
				],
			};
		}

		if (byline) {
			item.playlistVideoRenderer.shortBylineText = {
				runs: [{
					text: byline.author,
					navigationEndpoint: {
						browseEndpoint: {
							...(byline.channelId ? { browseId: byline.channelId } : {}),
							...(byline.canonicalBaseUrl ? { canonicalBaseUrl: byline.canonicalBaseUrl } : {}),
						},
					},
				}],
			};
		}

		return item;
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
														androidRenderer('firstVideo01', 'First &amp; Android', '1', 'https://img.example/first', {
															author: 'Author &amp; Channel',
															channelId: 'UC123',
															canonicalBaseUrl: '/@author-channel',
														}),
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
					author: 'Author & Channel',
					channelUrl: 'https://www.youtube.com/@author-channel',
					channelId: 'UC123',
					thumbnailUrl: 'https://img.example/first/large.jpg',
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
