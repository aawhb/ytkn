import { describe, expect, it } from 'vitest';
import { parseCaptionXml, requestedTranscriptLanguage, selectCaptionTrack } from '../../src/youtube/captions';

describe('YouTube captions helpers', () => {
	it('parses p-style caption XML and decodes HTML text', () => {
		expect(parseCaptionXml('<timedtext><body><p t="1000">Hello &amp; welcome<br/>back</p></body></timedtext>'))
			.toEqual([{ text: 'Hello & welcome back', offset: 1000 }]);
	});

	it('falls back to text-style caption XML', () => {
		expect(parseCaptionXml('<transcript><text start="1.5">Line one</text><text start="2">Line two</text></transcript>'))
			.toEqual([
				{ text: 'Line one', offset: 1500 },
				{ text: 'Line two', offset: 2000 },
			]);
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
		expect(requestedTranscriptLanguage('default', 'fr')).toBeNull();
		expect(requestedTranscriptLanguage('preferred', '  ')).toBeNull();
	});
});
