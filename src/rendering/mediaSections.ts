import type { GenerationOptions, MediaEmbedMode, TranscriptResponse, VideoCollectionTranscriptResponse } from '../types';
import { DEFAULT_MEDIA_EMBED_MODE } from '../defaults';
import { normalizeWhitespace } from '../utils';
import { thumbnailUrlForQuality } from '../youtube/metadata';

function escapeMarkdownAltText(value: string): string {
	return normalizeWhitespace(value)
		.replace(/\\/g, '\\\\')
		.replace(/\[/g, '(')
		.replace(/\]/g, ')');
}

function resolveMediaEmbedMode(options?: GenerationOptions): MediaEmbedMode {
	return options?.mediaEmbedMode ?? DEFAULT_MEDIA_EMBED_MODE;
}

function buildMediaEmbed(
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

function resolveCollectionThumbnailUrl(collection: VideoCollectionTranscriptResponse, thumbnailUrl: string | null): string | null {
	if (thumbnailUrl) {
		return thumbnailUrl;
	}

	const firstTranscript = collection.transcripts[0];
	if (firstTranscript?.thumbnailUrl) {
		return firstTranscript.thumbnailUrl;
	}

	const firstEntry = collection.entries[0];
	if (firstEntry?.thumbnailUrl) {
		return firstEntry.thumbnailUrl;
	}

	const firstVideoId = firstTranscript?.videoId ?? firstEntry?.videoId;
	return firstVideoId ? thumbnailUrlForQuality(firstVideoId, 'high') : null;
}

function resolveCollectionVideoEmbedUrl(collection: VideoCollectionTranscriptResponse): string | null {
	return collection.transcripts[0]?.url ?? collection.entries[0]?.url ?? null;
}

export function buildCollectionMediaEmbed(
	collection: VideoCollectionTranscriptResponse,
	thumbnailUrl: string | null,
	options?: GenerationOptions,
): string | null {
	const mediaEmbedMode = resolveMediaEmbedMode(options);

	if (mediaEmbedMode === 'none') {
		return null;
	}

	if (mediaEmbedMode === 'thumbnail') {
		const resolvedThumbnailUrl = resolveCollectionThumbnailUrl(collection, thumbnailUrl);
		return resolvedThumbnailUrl ? `![Thumbnail](${resolvedThumbnailUrl})` : null;
	}

	const videoUrl = resolveCollectionVideoEmbedUrl(collection);
	return videoUrl ? `![${escapeMarkdownAltText(collection.title)}](${videoUrl})` : null;
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
