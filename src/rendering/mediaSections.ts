import type { GenerationOptions, MediaEmbedMode, PlaylistTranscriptResponse, TranscriptResponse } from '../types';
import { DEFAULT_MEDIA_EMBED_MODE } from '../defaults';

function escapeMarkdownAltText(value: string): string {
	return value
		.replace(/\s+/g, ' ')
		.replace(/\\/g, '\\\\')
		.replace(/\]/g, '\\]')
		.trim();
}

function resolveMediaEmbedMode(options?: GenerationOptions): MediaEmbedMode {
	return options?.mediaEmbedMode ?? DEFAULT_MEDIA_EMBED_MODE;
}

export function buildMediaEmbed(
	title: string,
	url: string,
	thumbnailUrl: string | null,
	options?: GenerationOptions,
): string | null {
	const mediaEmbedMode = resolveMediaEmbedMode(options);

	if (mediaEmbedMode === 'none') {
		return null;
	}

	if (mediaEmbedMode === 'thumbnail') {
		return thumbnailUrl ? `![Thumbnail](${thumbnailUrl})` : null;
	}

	return `![${escapeMarkdownAltText(title)}](${url})`;
}

function fallbackVideoThumbnailUrl(videoId: string): string {
	return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function resolvePlaylistThumbnailUrl(playlist: PlaylistTranscriptResponse, thumbnailUrl: string | null): string | null {
	if (thumbnailUrl) {
		return thumbnailUrl;
	}

	const firstTranscript = playlist.transcripts[0];
	if (firstTranscript?.thumbnailUrl) {
		return firstTranscript.thumbnailUrl;
	}

	const firstEntry = playlist.entries[0];
	if (firstEntry?.thumbnailUrl) {
		return firstEntry.thumbnailUrl;
	}

	const firstVideoId = firstTranscript?.videoId ?? firstEntry?.videoId;
	return firstVideoId ? fallbackVideoThumbnailUrl(firstVideoId) : null;
}

function resolvePlaylistVideoEmbedUrl(playlist: PlaylistTranscriptResponse): string | null {
	return playlist.transcripts[0]?.url ?? playlist.entries[0]?.url ?? null;
}

export function buildPlaylistMediaEmbed(
	playlist: PlaylistTranscriptResponse,
	thumbnailUrl: string | null,
	options?: GenerationOptions,
): string | null {
	const mediaEmbedMode = resolveMediaEmbedMode(options);

	if (mediaEmbedMode === 'none') {
		return null;
	}

	if (mediaEmbedMode === 'thumbnail') {
		const resolvedThumbnailUrl = resolvePlaylistThumbnailUrl(playlist, thumbnailUrl);
		return resolvedThumbnailUrl ? `![Thumbnail](${resolvedThumbnailUrl})` : null;
	}

	const videoUrl = resolvePlaylistVideoEmbedUrl(playlist);
	return videoUrl ? `![${escapeMarkdownAltText(playlist.title)}](${videoUrl})` : null;
}

export function buildVideoHeader(transcript: TranscriptResponse, thumbnailUrl: string, url: string, options?: GenerationOptions, headingLevel = 1): string[] {
	const prefix = '#'.repeat(headingLevel);
	const header = [`${prefix} ${transcript.title}`];
	const mediaEmbed = buildMediaEmbed(transcript.title, url, thumbnailUrl, options);

	if (mediaEmbed) {
		header.push(mediaEmbed);
	}

	return header;
}
