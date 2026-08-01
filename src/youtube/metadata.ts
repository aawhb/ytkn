import type { TranscriptLine, TranscriptResponse } from '../types';
import { decodeHtmlEntities, normalizeWhitespace } from '../utils';

export type Thumbnail = {
	url?: string;
	width?: number;
	height?: number;
};

type MicroformatRenderer = {
	uploadDate?: unknown;
	category?: unknown;
};

export type PlayerEnvelope = {
	error?: { status?: string };
	playabilityStatus?: {
		status?: string;
		reason?: string;
	};
	videoDetails?: {
		title?: string;
		author?: string;
		channelId?: string;
		shortDescription?: string;
		lengthSeconds?: string;
		keywords?: unknown;
		thumbnail?: {
			thumbnails?: Thumbnail[];
		};
	};
	microformat?: {
		playerMicroformatRenderer?: MicroformatRenderer;
	};
	captions?: {
		playerCaptionsTracklistRenderer?: {
			captionTracks?: Array<{
				baseUrl: string;
				languageCode: string;
			}>;
		};
	};
};

export type SupplementalVideoMetadata = {
	uploadDate?: string;
	videoCategory?: string;
};

type ThumbnailQuality = 'default' | 'medium' | 'high' | 'standard' | 'maxres';

const THUMBNAIL_SLUGS: Record<ThumbnailQuality, string> = {
	default: 'default',
	medium: 'mqdefault',
	high: 'hqdefault',
	standard: 'sddefault',
	maxres: 'maxresdefault',
};

const UNKNOWN_VALUE = 'Unknown';

export function thumbnailUrlForQuality(videoId: string, quality: ThumbnailQuality): string {
	return `https://img.youtube.com/vi/${videoId}/${THUMBNAIL_SLUGS[quality]}.jpg`;
}

export function normalizeHtmlText(text: string): string {
	return normalizeWhitespace(decodeHtmlEntities(text).replace(/\\n/g, ' '));
}

function parsePositiveInteger(value: unknown): number | undefined {
	if (typeof value !== 'string' && typeof value !== 'number') {
		return undefined;
	}

	const parsed = Number.parseInt(`${value}`, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeStringList(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}

	const seen = new Set<string>();
	const items: string[] = [];
	for (const item of value) {
		if (typeof item !== 'string') {
			continue;
		}

		const normalized = normalizeHtmlText(item);
		if (!normalized || seen.has(normalized)) {
			continue;
		}

		seen.add(normalized);
		items.push(normalized);
	}

	return items.length ? items : undefined;
}

function normalizeDateOnly(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
	return match?.[1];
}

function normalizeOptionalText(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const normalized = normalizeHtmlText(value);
	return normalized || undefined;
}

export function microformatMetadata(player: PlayerEnvelope): SupplementalVideoMetadata {
	const renderer = player.microformat?.playerMicroformatRenderer;
	if (!renderer) {
		return {};
	}

	const uploadDate = normalizeDateOnly(renderer.uploadDate);
	const videoCategory = normalizeOptionalText(renderer.category);

	return {
		...(uploadDate ? { uploadDate } : {}),
		...(videoCategory ? { videoCategory } : {}),
	};
}

export function bestProvidedThumbnailUrl(thumbnails: Thumbnail[] | undefined): string | undefined {
	const best = (thumbnails ?? [])
		.filter((thumbnail): thumbnail is Required<Pick<Thumbnail, 'url'>> & Thumbnail => typeof thumbnail.url === 'string' && thumbnail.url.length > 0)
		.sort((left, right) => ((right.width ?? 0) * (right.height ?? 0)) - ((left.width ?? 0) * (left.height ?? 0)))[0];

	return best?.url;
}

function bestThumbnailUrl(videoId: string, thumbnails: Thumbnail[] | undefined): string {
	return bestProvidedThumbnailUrl(thumbnails) ?? thumbnailUrlForQuality(videoId, 'high');
}

export function buildTranscriptResponseFromPlayer(
	url: string,
	videoId: string,
	player: PlayerEnvelope,
	lines: TranscriptLine[],
	supplementalMetadata: SupplementalVideoMetadata = {},
): TranscriptResponse {
	const details = player.videoDetails;
	const thumbnailUrl = bestThumbnailUrl(videoId, details?.thumbnail?.thumbnails);
	const description = details?.shortDescription ? normalizeHtmlText(details.shortDescription) : undefined;
	const durationSeconds = parsePositiveInteger(details?.lengthSeconds);
	const keywords = normalizeStringList(details?.keywords);

	return {
		url,
		videoId,
		title: normalizeHtmlText(details?.title ?? UNKNOWN_VALUE),
		author: normalizeHtmlText(details?.author ?? UNKNOWN_VALUE),
		...(details?.channelId ? { channelId: details.channelId } : {}),
		channelUrl: details?.channelId ? `https://www.youtube.com/channel/${details.channelId}` : '',
		...(description ? { description } : {}),
		thumbnailUrl,
		...supplementalMetadata,
		...(durationSeconds !== undefined ? { durationSeconds } : {}),
		...(keywords ? { keywords } : {}),
		lines,
	};
}
