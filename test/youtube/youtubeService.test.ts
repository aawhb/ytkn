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

	it('reuses a completed playlist title preflight when execution starts later', async () => {
		let browseRequests = 0;
		const payload = {
			metadata: { playlistMetadataRenderer: { title: 'Retained Playlist' } },
			contents: [renderer('retained001', 'Retained video', '1')],
		};
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			const body = typeof request.body === 'string' ? request.body : '';
			if (body.includes('"browseId":"VLPLRETAINED"')) {
				browseRequests += 1;
				return { json: {}, text: JSON.stringify(payload) };
			}
			throw new Error(`Unexpected request: ${request.url} ${body}`);
		});

		const svc = new YouTubeService();
		expect(await svc.fetchPlaylistTitle('PLRETAINED')).toBe('Retained Playlist');
		const playlist = await svc.fetchPlaylist('https://www.youtube.com/playlist?list=PLRETAINED');

		expect(playlist.title).toBe('Retained Playlist');
		expect(browseRequests).toBe(1);
		spy.mockRestore();
	});

	it('evicts a failed playlist title preflight before retrying', async () => {
		let browseRequests = 0;
		const payload = {
			metadata: { playlistMetadataRenderer: { title: 'Recovered Playlist' } },
			contents: [renderer('recovered01', 'Recovered video', '1')],
		};
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			const body = typeof request.body === 'string' ? request.body : '';
			if (!body.includes('"browseId":"VLPLRECOVER"')) {
				throw new Error(`Unexpected request: ${request.url} ${body}`);
			}
			browseRequests += 1;
			if (browseRequests === 1) {
				throw new Error('Temporary browse failure');
			}
			return { json: {}, text: JSON.stringify(payload) };
		});

		const svc = new YouTubeService();
		await expect(svc.fetchPlaylistTitle('PLRECOVER')).rejects.toThrow('Temporary browse failure');
		expect(await svc.fetchPlaylistTitle('PLRECOVER')).toBe('Recovered Playlist');
		await svc.fetchPlaylist('https://www.youtube.com/playlist?list=PLRECOVER');

		expect(browseRequests).toBe(2);
		spy.mockRestore();
	});

	it('does not retain playlist browse data from execution-only calls', async () => {
		let browseRequests = 0;
		const payload = {
			metadata: { playlistMetadataRenderer: { title: 'Execution Playlist' } },
			contents: [renderer('execution01', 'Execution video', '1')],
		};
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			const body = typeof request.body === 'string' ? request.body : '';
			if (body.includes('"browseId":"VLPLEXECUTE"')) {
				browseRequests += 1;
				return { json: {}, text: JSON.stringify(payload) };
			}
			throw new Error(`Unexpected request: ${request.url} ${body}`);
		});

		const svc = new YouTubeService();
		await svc.fetchPlaylist('https://www.youtube.com/playlist?list=PLEXECUTE');
		await svc.fetchPlaylist('https://www.youtube.com/playlist?list=PLEXECUTE');

		expect(browseRequests).toBe(2);
		spy.mockRestore();
	});

	it('shares the initial browse between concurrent title resolution and execution', async () => {
		let browseRequests = 0;
		const payload = {
			metadata: { playlistMetadataRenderer: { title: 'Shared Playlist' } },
			contents: [renderer('shared00001', 'Shared video', '1')],
		};
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			const body = typeof request.body === 'string' ? request.body : '';
			if (body.includes('"browseId":"VLPLSHARED"')) {
				browseRequests += 1;
				return { json: {}, text: JSON.stringify(payload) };
			}
			throw new Error(`Unexpected request: ${request.url} ${body}`);
		});

		const svc = new YouTubeService();
		const [title, playlist] = await Promise.all([
			svc.fetchPlaylistTitle('PLSHARED'),
			svc.fetchPlaylist('https://www.youtube.com/playlist?list=PLSHARED'),
		]);

		expect(title).toBe('Shared Playlist');
		expect(playlist.title).toBe('Shared Playlist');
		expect(browseRequests).toBe(1);
		spy.mockRestore();
	});

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

describe('YouTubeService.fetchChannel', () => {
	it('continues when a selected channel content type has no feed', async () => {
		const channelId = 'UC1234567890';
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			const body = typeof request.body === 'string' ? request.body : '';
			if (body.includes(`"browseId":"${channelId}"`)) {
				return { json: {}, text: JSON.stringify({ metadata: { channelMetadataRenderer: { title: 'Videos only' } } }) };
			}
			if (body.includes('"browseId":"VLUULF1234567890"')) {
				return {
					json: {},
					text: JSON.stringify({
						contents: [{
							playlistVideoRenderer: {
								videoId: 'available01',
								title: { simpleText: 'Available video' },
							},
						}],
					}),
				};
			}
			if (body.includes('"browseId":"VLUULV1234567890"')) {
				if ((request as { throw?: boolean }).throw === false) {
					return {
						status: 404,
						json: { error: { status: 'NOT_FOUND' } },
						text: JSON.stringify({ error: { status: 'NOT_FOUND' } }),
					};
				}
				throw new Error('Request failed, status 404');
			}
			throw new Error(`Unexpected request: ${request.url} ${body}`);
		});

		const channel = await new YouTubeService().fetchChannel(
			`https://www.youtube.com/channel/${channelId}`,
			{ contentTypes: ['videos', 'streams'], videoLimit: 10 },
		);

		expect(channel.title).toBe('Videos only');
		expect(channel.entries.map(({ videoId, contentType }) => ({ videoId, contentType }))).toEqual([
			{ videoId: 'available01', contentType: 'videos' },
		]);
		spy.mockRestore();
	});

	it('preserves non-404 channel feed failures', async () => {
		const channelId = 'UC1234567890';
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			const body = typeof request.body === 'string' ? request.body : '';
			if (body.includes(`"browseId":"${channelId}"`)) {
				return { json: {}, text: JSON.stringify({ metadata: { channelMetadataRenderer: { title: 'Rate limited' } } }) };
			}
			if (body.includes('"browseId":"VLUULF1234567890"')) {
				return {
					status: 429,
					json: { error: { status: 'RESOURCE_EXHAUSTED' } },
					text: JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } }),
				};
			}
			throw new Error(`Unexpected request: ${request.url} ${body}`);
		});

		await expect(new YouTubeService().fetchChannel(
			`https://www.youtube.com/channel/${channelId}`,
			{ contentTypes: ['videos'], videoLimit: 10 },
		)).rejects.toThrow('YouTube channel feed request failed with status 429');
		spy.mockRestore();
	});

	it('reuses a completed channel title preflight when execution starts later', async () => {
		const channelId = 'UC1234567890';
		let channelBrowseRequests = 0;
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			const body = typeof request.body === 'string' ? request.body : '';
			if (request.url.includes('/navigation/resolve_url')) {
				return { json: {}, text: JSON.stringify({ endpoint: { browseEndpoint: { browseId: channelId } } }) };
			}
			if (body.includes(`"browseId":"${channelId}"`)) {
				channelBrowseRequests += 1;
				return { json: {}, text: JSON.stringify({ metadata: { channelMetadataRenderer: { title: 'Retained Channel' } } }) };
			}
			if (body.includes('"browseId":"VLUULF1234567890"')) {
				return {
					json: {},
					text: JSON.stringify({
						contents: [{
							playlistVideoRenderer: {
								videoId: 'regular0001',
								title: { simpleText: 'Regular video' },
							},
						}],
					}),
				};
			}
			throw new Error(`Unexpected request: ${request.url} ${body}`);
		});

		const svc = new YouTubeService();
		const url = 'https://www.youtube.com/@channel';
		expect(await svc.fetchChannelTitle(url)).toBe('Retained Channel');
		const channel = await svc.fetchChannel(url, { contentTypes: ['videos'], videoLimit: 1 });

		expect(channel.title).toBe('Retained Channel');
		expect(channelBrowseRequests).toBe(1);
		spy.mockRestore();
	});

	it('evicts a failed channel title preflight before retrying', async () => {
		const channelId = 'UC1234567890';
		let channelBrowseRequests = 0;
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			const body = typeof request.body === 'string' ? request.body : '';
			if (request.url.includes('/navigation/resolve_url')) {
				return { json: {}, text: JSON.stringify({ endpoint: { browseEndpoint: { browseId: channelId } } }) };
			}
			if (body.includes(`"browseId":"${channelId}"`)) {
				channelBrowseRequests += 1;
				if (channelBrowseRequests === 1) {
					throw new Error('Temporary channel failure');
				}
				return { json: {}, text: JSON.stringify({ metadata: { channelMetadataRenderer: { title: 'Recovered Channel' } } }) };
			}
			if (body.includes('"browseId":"VLUULF1234567890"')) {
				return {
					json: {},
					text: JSON.stringify({
						contents: [{
							playlistVideoRenderer: {
								videoId: 'recovered01',
								title: { simpleText: 'Recovered video' },
							},
						}],
					}),
				};
			}
			throw new Error(`Unexpected request: ${request.url} ${body}`);
		});

		const svc = new YouTubeService();
		const url = 'https://www.youtube.com/@channel';
		await expect(svc.fetchChannelTitle(url)).rejects.toThrow('Temporary channel failure');
		expect(await svc.fetchChannelTitle(url)).toBe('Recovered Channel');
		await svc.fetchChannel(url, { contentTypes: ['videos'], videoLimit: 1 });

		expect(channelBrowseRequests).toBe(2);
		spy.mockRestore();
	});

	it('does not retain channel metadata from execution-only calls', async () => {
		const channelId = 'UC1234567890';
		let channelBrowseRequests = 0;
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			const body = typeof request.body === 'string' ? request.body : '';
			if (body.includes(`"browseId":"${channelId}"`)) {
				channelBrowseRequests += 1;
				return { json: {}, text: JSON.stringify({ metadata: { channelMetadataRenderer: { title: 'Execution Channel' } } }) };
			}
			if (body.includes('"browseId":"VLUULF1234567890"')) {
				return {
					json: {},
					text: JSON.stringify({
						contents: [{
							playlistVideoRenderer: {
								videoId: 'execution01',
								title: { simpleText: 'Execution video' },
							},
						}],
					}),
				};
			}
			throw new Error(`Unexpected request: ${request.url} ${body}`);
		});

		const svc = new YouTubeService();
		const url = `https://www.youtube.com/channel/${channelId}`;
		await svc.fetchChannel(url, { contentTypes: ['videos'], videoLimit: 1 });
		await svc.fetchChannel(url, { contentTypes: ['videos'], videoLimit: 1 });

		expect(channelBrowseRequests).toBe(2);
		spy.mockRestore();
	});

	it('shares channel metadata requests between concurrent title resolution and execution', async () => {
		const channelId = 'UC1234567890';
		let resolveRequests = 0;
		let channelBrowseRequests = 0;
		let feedBrowseRequests = 0;
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			const body = typeof request.body === 'string' ? request.body : '';
			if (request.url.includes('/navigation/resolve_url')) {
				resolveRequests += 1;
				return { json: {}, text: JSON.stringify({ endpoint: { browseEndpoint: { browseId: channelId } } }) };
			}
			if (body.includes(`"browseId":"${channelId}"`)) {
				channelBrowseRequests += 1;
				return { json: {}, text: JSON.stringify({ metadata: { channelMetadataRenderer: { title: 'Shared Channel' } } }) };
			}
			if (body.includes('"browseId":"VLUULF1234567890"')) {
				feedBrowseRequests += 1;
				return {
					json: {},
					text: JSON.stringify({
						contents: [{
							playlistVideoRenderer: {
								videoId: 'regular0001',
								title: { simpleText: 'Regular video' },
							},
						}],
					}),
				};
			}
			throw new Error(`Unexpected request: ${request.url} ${body}`);
		});

		const svc = new YouTubeService();
		const url = 'https://www.youtube.com/@channel';
		const [title, channel] = await Promise.all([
			svc.fetchChannelTitle(url),
			svc.fetchChannel(url, { contentTypes: ['videos'], videoLimit: 1 }),
		]);

		expect(title).toBe('Shared Channel');
		expect(channel.title).toBe('Shared Channel');
		expect(resolveRequests).toBe(1);
		expect(channelBrowseRequests).toBe(1);
		expect(feedBrowseRequests).toBe(1);
		spy.mockRestore();
	});

	it('collects only selected channel content types with a per-type limit and deduplicates videos', async () => {
		const channelId = 'UC_x5XG1OV2P6uZZ5FSM9Ttw';
		const channelTail = channelId.slice(2);
		const browseBodies: string[] = [];
		const playlistPayload = (videoId: string, title: string) => ({
			contents: [{
				playlistVideoRenderer: {
					videoId,
					index: { simpleText: '1' },
					title: { simpleText: title },
				},
			}],
		});

		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			const body = typeof request.body === 'string' ? request.body : '';
			if (request.url.includes('/navigation/resolve_url')) {
				return { json: {}, text: JSON.stringify({ endpoint: { browseEndpoint: { browseId: channelId } } }) };
			}
			if (request.url.includes('/youtubei/v1/browse')) {
				browseBodies.push(body);
				if (body.includes(`"browseId":"${channelId}"`)) {
					return { json: {}, text: JSON.stringify({ metadata: { channelMetadataRenderer: { title: 'Channel &amp; Name' } } }) };
				}
				if (body.includes(`"browseId":"VLUULF${channelTail}"`)) {
					return { json: {}, text: JSON.stringify(playlistPayload('regular0001', 'Regular video')) };
				}
				if (body.includes(`"browseId":"VLUUSH${channelTail}"`)) {
					return { json: {}, text: JSON.stringify(playlistPayload('short000001', 'Short video')) };
				}
			}
			throw new Error(`Unexpected request: ${request.url} ${body}`);
		});

		const svc = new YouTubeService();
		const channel = await svc.fetchChannel('https://www.youtube.com/@channel', {
			contentTypes: ['videos', 'shorts'],
			videoLimit: 1,
		});

		expect(channel).toEqual({
			url: 'https://www.youtube.com/@channel',
			channelId,
			title: 'Channel & Name',
			contentTypes: ['videos', 'shorts'],
			entries: [
				{
					videoId: 'regular0001',
					url: 'https://www.youtube.com/watch?v=regular0001',
					position: 1,
					title: 'Regular video',
					contentType: 'videos',
				},
				{
					videoId: 'short000001',
					url: 'https://www.youtube.com/watch?v=short000001',
					position: 2,
					title: 'Short video',
					contentType: 'shorts',
				},
			],
		});
		expect(browseBodies.some((body) => body.includes(`VLUULV${channelTail}`))).toBe(false);
		spy.mockRestore();
	});

	it('counts only completed stream replays toward the stream limit', async () => {
		const channelId = 'UC1234567890';
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			const body = typeof request.body === 'string' ? request.body : '';
			if (body.includes(`"browseId":"${channelId}"`)) {
				return { json: {}, text: JSON.stringify({ metadata: { channelMetadataRenderer: { title: 'Stream Channel' } } }) };
			}
			if (body.includes('"browseId":"VLUULV1234567890"')) {
				return {
					json: {},
					text: JSON.stringify({
						contents: [
							{
								playlistVideoRenderer: {
									videoId: 'live0000001',
									title: { simpleText: 'Live now' },
									thumbnailOverlays: [{
										thumbnailOverlayTimeStatusRenderer: {
											style: 'DEFAULT',
											text: { simpleText: 'LIVE NOW' },
										},
									}],
								},
							},
							{
								playlistVideoRenderer: {
									videoId: 'replay00001',
									title: { simpleText: 'Completed replay' },
								},
							},
						],
					}),
				};
			}
			throw new Error(`Unexpected request: ${request.url} ${body}`);
		});

		const channel = await new YouTubeService().fetchChannel(
			`https://www.youtube.com/channel/${channelId}`,
			{ contentTypes: ['streams'], videoLimit: 1 },
		);

		expect(channel.entries).toHaveLength(1);
		expect(channel.entries[0]).toMatchObject({
			videoId: 'replay00001',
			contentType: 'streams',
		});
		spy.mockRestore();
	});

	it('skips live and upcoming entries in video and short feeds before applying each limit', async () => {
		const channelId = 'UC1234567890';
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			const body = typeof request.body === 'string' ? request.body : '';
			if (body.includes(`"browseId":"${channelId}"`)) {
				return { json: {}, text: JSON.stringify({ metadata: { channelMetadataRenderer: { title: 'Mixed Channel' } } }) };
			}
			if (body.includes('"browseId":"VLUULF1234567890"')) {
				return {
					json: {},
					text: JSON.stringify({
						contents: [
							{
								playlistVideoRenderer: {
									videoId: 'live-video01',
									title: { simpleText: 'Live video' },
									badges: [{ metadataBadgeRenderer: { style: 'BADGE_STYLE_TYPE_LIVE_NOW' } }],
								},
							},
							{
								playlistVideoRenderer: {
									videoId: 'video-replay',
									title: { simpleText: 'Completed video' },
								},
							},
						],
					}),
				};
			}
			if (body.includes('"browseId":"VLUUSH1234567890"')) {
				return {
					json: {},
					text: JSON.stringify({
						contents: [
							{
								playlistVideoRenderer: {
									videoId: 'upcoming001',
									title: { simpleText: 'Upcoming short' },
									upcomingEventData: { startTime: '123' },
								},
							},
							{
								playlistVideoRenderer: {
									videoId: 'short-replay',
									title: { simpleText: 'Completed short' },
								},
							},
						],
					}),
				};
			}
			throw new Error(`Unexpected request: ${request.url} ${body}`);
		});

		const channel = await new YouTubeService().fetchChannel(
			`https://www.youtube.com/channel/${channelId}`,
			{ contentTypes: ['videos', 'shorts'], videoLimit: 1 },
		);

		expect(channel.entries.map(({ videoId, contentType }) => ({ videoId, contentType }))).toEqual([
			{ videoId: 'video-replay', contentType: 'videos' },
			{ videoId: 'short-replay', contentType: 'shorts' },
		]);
		spy.mockRestore();
	});

	it('deduplicates a video that appears in more than one selected channel feed', async () => {
		const channelId = 'UC1234567890';
		const item = (videoId: string, title: string) => ({
			playlistVideoRenderer: { videoId, title: { simpleText: title } },
		});
		const spy = vi.spyOn(obsidianMock, 'requestUrl').mockImplementation(async (request) => {
			const body = typeof request.body === 'string' ? request.body : '';
			if (body.includes(`"browseId":"${channelId}"`)) {
				return { json: {}, text: JSON.stringify({ metadata: { channelMetadataRenderer: { title: 'Channel' } } }) };
			}
			if (body.includes('"browseId":"VLUULF1234567890"')) {
				return { json: {}, text: JSON.stringify({ contents: [item('shared00001', 'Shared')] }) };
			}
			if (body.includes('"browseId":"VLUUSH1234567890"')) {
				return { json: {}, text: JSON.stringify({ contents: [item('shared00001', 'Shared'), item('short000001', 'Short')] }) };
			}
			throw new Error(`Unexpected request: ${request.url} ${body}`);
		});

		const channel = await new YouTubeService().fetchChannel(
			`https://www.youtube.com/channel/${channelId}`,
			{ contentTypes: ['videos', 'shorts'], videoLimit: null },
		);

		expect(channel.entries.map(({ videoId, contentType }) => ({ videoId, contentType }))).toEqual([
			{ videoId: 'shared00001', contentType: 'videos' },
			{ videoId: 'short000001', contentType: 'shorts' },
		]);
		spy.mockRestore();
	});
});
