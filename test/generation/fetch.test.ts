import { describe, expect, it, vi } from 'vitest';
import { fetchTranscriptForUrl, fetchVideoDataForUrl, getTranscriptFetchOptions } from '../../src/generation/fetch';
import type { EffectiveGenerationOptions } from '../../src/generation/effectiveOptions';

function makeOptions(overrides: Partial<EffectiveGenerationOptions> = {}): EffectiveGenerationOptions {
	return {
		useAi: false,
		generateAiSummary: false,
		instructionMode: 'template',
		instructionTemplate: 'general',
		manualInstructions: '',
		includeMindmap: false,
		includeMemorableQuotes: false,
		controlValues: {},
		transcriptMode: 'readable',
		playlistMode: 'combined',
		transcriptLanguageMode: 'preferred',
		preferredTranscriptLanguage: 'fr',
		transcriptFailureMode: 'skip',
		mediaEmbedMode: 'thumbnail',
		includeRunReport: true,
		runReportLocation: 'generated-note',
		useVideoTitleAsNoteName: true,
		noteDestinationMode: 'folder',
		noteDestinationFolder: '',
		temperature: 0.3,
		requestTimeoutMs: 60000,
		includeFrontmatter: true,
		frontmatterTags: '',
		frontmatterPropertyAllowlist: '',
		sourceSectionPosition: 'top',
		linkTimestamps: false,
		tldrCalloutAtTop: false,
		...overrides,
	};
}

describe('generation fetch helpers', () => {
	it('maps transcript language options for YouTube transcript fetches', () => {
		expect(getTranscriptFetchOptions(makeOptions())).toEqual({
			languageMode: 'preferred',
			preferredLanguageCode: 'fr',
		});
	});

	it('fetches transcripts for transcript-producing runs', async () => {
		const transcriptResult = { transcript: { title: 'Video', lines: [], url: 'url', videoId: 'id' }, languageCode: 'en' };
		const youtubeService = {
			fetchTranscript: vi.fn(async () => transcriptResult),
			fetchVideoMetadata: vi.fn(),
		};

		const result = await fetchTranscriptForUrl(youtubeService as any, 'url', makeOptions(), new AbortController().signal);

		expect(result).toBe(transcriptResult);
		expect(youtubeService.fetchTranscript).toHaveBeenCalledWith('url', {
			languageMode: 'preferred',
			preferredLanguageCode: 'fr',
		});
	});

	it('fetches metadata instead of captions for metadata-only runs', async () => {
		const transcript = { title: 'Metadata', lines: [], url: 'url', videoId: 'id' };
		const youtubeService = {
			fetchTranscript: vi.fn(),
			fetchVideoMetadata: vi.fn(async () => transcript),
		};

		const result = await fetchVideoDataForUrl(
			youtubeService as any,
			'url',
			makeOptions({ transcriptMode: 'none' }),
			new AbortController().signal,
		);

		expect(result).toEqual({ transcript });
		expect(youtubeService.fetchVideoMetadata).toHaveBeenCalledWith('url');
		expect(youtubeService.fetchTranscript).not.toHaveBeenCalled();
	});
});
