import type {
	PlaylistResponse,
	TranscriptFetchResult,
	TranscriptLanguageMode,
	TranscriptLine,
	TranscriptResponse,
} from '../types';
import { getErrorMessage } from '../utils';
import {
	parseCaptionXml,
	requestCaptionLines,
	requestedTranscriptLanguage,
	selectCaptionTrack,
} from './captions';
import {
	buildTranscriptResponseFromPlayer,
	ThumbnailQuality,
	thumbnailUrlForQuality,
} from './metadata';
import {
	requestContinuation,
	requestOEmbedTitle,
	requestPlayer,
	requestPlaylistBrowse,
	requestSupplementalVideoMetadata,
} from './innertube';
import { collectPlaylistEntries, playlistTitleFromPayload } from './playlistPayload';
import {
	classifyUrls,
	extractPlaylistId,
	extractVideoId,
	isPlaylistUrl,
	isYouTubeUrl,
	parseUrls,
	YouTubeUrlClassification,
} from './urls';

export class YouTubeService {
	static getThumbnailUrl(videoId: string, quality: ThumbnailQuality = 'medium'): string {
		return thumbnailUrlForQuality(videoId, quality);
	}

	static isYouTubeUrl(url: string): boolean {
		return isYouTubeUrl(url);
	}

	static extractVideoId(url: string): string | null {
		return extractVideoId(url);
	}

	static extractPlaylistId(url: string): string | null {
		return extractPlaylistId(url);
	}

	static isPlaylistUrl(url: string): boolean {
		return isPlaylistUrl(url);
	}

	static parseUrls(input: string): string[] {
		return parseUrls(input);
	}

	static classifyUrls(urls: string[]): YouTubeUrlClassification[] {
		return classifyUrls(urls);
	}

	static parseTranscriptXml(xmlContent: string): TranscriptLine[] {
		return parseCaptionXml(xmlContent);
	}

	async fetchVideoTitle(videoId: string): Promise<string> {
		return requestOEmbedTitle(videoId);
	}

	async fetchPlaylistTitle(playlistId: string): Promise<string> {
		const payload = await requestPlaylistBrowse(playlistId);
		return playlistTitleFromPayload(payload) ?? `Playlist ${playlistId}`;
	}

	async fetchVideoMetadata(url: string): Promise<TranscriptResponse> {
		try {
			const videoId = YouTubeService.extractVideoId(url);
			if (!videoId) {
				throw new Error('Invalid YouTube URL');
			}

			const [player, supplementalMetadata] = await Promise.all([
				requestPlayer(videoId),
				requestSupplementalVideoMetadata(videoId),
			]);
			return buildTranscriptResponseFromPlayer(url, videoId, player, [], supplementalMetadata);
		} catch (error) {
			throw new Error(`Failed to fetch video metadata: ${getErrorMessage(error)}`);
		}
	}

	async fetchTranscript(
		url: string,
		options: { languageMode?: TranscriptLanguageMode; preferredLanguageCode?: string } = {},
	): Promise<TranscriptFetchResult> {
		try {
			const videoId = YouTubeService.extractVideoId(url);
			if (!videoId) {
				throw new Error('Invalid YouTube URL');
			}

			const [player, supplementalMetadata] = await Promise.all([
				requestPlayer(videoId),
				requestSupplementalVideoMetadata(videoId),
			]);
			const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
			if (tracks.length === 0) {
				throw new Error('No captions available for this video');
			}

			const requestedLanguage = requestedTranscriptLanguage(options.languageMode, options.preferredLanguageCode);
			const selectedTrack = selectCaptionTrack(tracks, requestedLanguage);
			if (!selectedTrack) {
				const available = tracks.map((track) => track.languageCode).join(', ');
				throw new Error(requestedLanguage
					? `No transcript found for language '${requestedLanguage}'. Available: ${available}`
					: `No transcript found. Available: ${available}`);
			}

			const lines = await requestCaptionLines(selectedTrack.baseUrl);

			return {
				languageCode: selectedTrack.languageCode,
				transcript: buildTranscriptResponseFromPlayer(url, videoId, player, lines, supplementalMetadata),
			};
		} catch (error) {
			throw new Error(`Failed to fetch transcript: ${getErrorMessage(error)}`);
		}
	}

	async fetchPlaylist(url: string): Promise<PlaylistResponse> {
		const playlistId = YouTubeService.extractPlaylistId(url);
		if (!playlistId) {
			throw new Error('Invalid YouTube playlist URL');
		}

		try {
			const payload = await requestPlaylistBrowse(playlistId);
			const entries = await collectPlaylistEntries(payload, playlistId, requestContinuation);
			if (entries.length === 0) {
				throw new Error('No videos found in this playlist');
			}

			return {
				url,
				playlistId,
				title: playlistTitleFromPayload(payload) ?? `Playlist ${playlistId}`,
				entries,
			};
		} catch (error) {
			throw new Error(`Failed to fetch playlist: ${getErrorMessage(error)}`);
		}
	}
}
