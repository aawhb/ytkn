import { describe, expect, it, vi } from 'vitest';
import { YouTubeService } from '../src/services/youtube';
import * as obsidianMock from './mocks/obsidian';

vi.mock('obsidian', async () => {
	const mod = await import('./mocks/obsidian');
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
			expect(YouTubeService.getThumbnailUrl('abc')).toBe('https://img.youtube.com/vi/abc/maxresdefault.jpg');
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
