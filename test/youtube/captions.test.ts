import { afterEach, describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import { requestCaptionLines, requestedTranscriptLanguage, selectCaptionTrack } from '../../src/youtube/captions';

function captionResponse(text: string): any {
	return { text, status: 200, headers: {}, arrayBuffer: new ArrayBuffer(0), json: undefined };
}

async function parseCaptionResponse(xml: string) {
	vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(captionResponse(xml));
	return requestCaptionLines('https://youtube.example/captions');
}

describe('YouTube captions helpers', () => {
	afterEach(() => vi.restoreAllMocks());

	it('parses p-style caption XML and decodes HTML text', async () => {
		expect(await parseCaptionResponse('<timedtext><body><p t="1000">Hello &amp; welcome<br/>back</p></body></timedtext>'))
			.toEqual([{ text: 'Hello & welcome back', offset: 1000 }]);
	});

	it('falls back to text-style caption XML', async () => {
		expect(await parseCaptionResponse('<transcript><text start="1.5">Line one</text><text start="2">Line two</text></transcript>'))
			.toEqual([
				{ text: 'Line one', offset: 1500 },
				{ text: 'Line two', offset: 2000 },
			]);
	});

	it('skips empty caption segments and segments without offsets', async () => {
		expect(await parseCaptionResponse([
			'<doc>',
			'<p t="0">  </p>',
			'<p t="100">Valid caption</p>',
			'<p>No offset</p>',
			'<p t="200"><tag></tag></p>',
			'</doc>',
		].join(''))).toEqual([{ text: 'Valid caption', offset: 100 }]);
	});

	it('rejects XML without usable caption segments', async () => {
		await expect(parseCaptionResponse('<doc></doc>')).rejects.toThrow(/no caption segments found/);
	});

	it('selects exact, variant, prefix, or first caption tracks', () => {
		const tracks = [
			{ baseUrl: 'en-url', languageCode: 'en' },
			{ baseUrl: 'en-gb-url', languageCode: 'en-GB' },
			{ baseUrl: 'fr-url', languageCode: 'fr' },
		];

		expect(selectCaptionTrack(tracks, 'fr')?.baseUrl).toBe('fr-url');
		expect(selectCaptionTrack(tracks, 'en-US')?.baseUrl).toBe('en-url');
		expect(selectCaptionTrack(tracks, 'de')?.baseUrl).toBe('en-url');
		expect(selectCaptionTrack([], 'en')).toBeNull();
	});

	it('normalizes preferred transcript language requests', () => {
		expect(requestedTranscriptLanguage('preferred', ' EN-us ')).toBe('en-us');
		expect(requestedTranscriptLanguage('auto', 'fr')).toBeNull();
		expect(requestedTranscriptLanguage('preferred', '  ')).toBeNull();
	});
});
