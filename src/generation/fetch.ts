import type {
	TranscriptFetchResult,
	TranscriptResponse,
} from '../types';
import type { YouTubeService } from '../youtube/youtubeService';
import { isMetadataOnlyRun } from './aiPolicy';
import type { EffectiveGenerationOptions } from './effectiveOptions';

interface VideoDataFetchResult {
	transcript: TranscriptResponse;
	languageCode?: string;
}

export async function fetchTranscriptForUrl(
	youtubeService: YouTubeService,
	url: string,
	effectiveOptions: EffectiveGenerationOptions,
	signal: AbortSignal,
): Promise<TranscriptFetchResult> {
	if (signal.aborted) throw signal.reason;
	const result = await youtubeService.fetchTranscript(url, {
		languageMode: effectiveOptions.transcriptLanguageMode,
		preferredLanguageCode: effectiveOptions.preferredTranscriptLanguage,
	});
	if (signal.aborted) throw signal.reason;
	return result;
}

export async function fetchVideoDataForUrl(
	youtubeService: YouTubeService,
	url: string,
	effectiveOptions: EffectiveGenerationOptions,
	signal: AbortSignal,
): Promise<VideoDataFetchResult> {
	if (!isMetadataOnlyRun(effectiveOptions)) {
		return fetchTranscriptForUrl(youtubeService, url, effectiveOptions, signal);
	}

	if (signal.aborted) throw signal.reason;
	const transcript = await youtubeService.fetchVideoMetadata(url);
	if (signal.aborted) throw signal.reason;
	return { transcript };
}
