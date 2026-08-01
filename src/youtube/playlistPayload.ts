import type { PlaylistEntry } from '../types';
import type { Thumbnail } from './metadata';
import { bestProvidedThumbnailUrl, normalizeHtmlText } from './metadata';

type JsonObject = Record<string, unknown>;

type TextRun = {
	text?: string;
	navigationEndpoint?: {
		browseEndpoint?: {
			browseId?: unknown;
			canonicalBaseUrl?: unknown;
		};
	};
};

type TextRenderer = {
	simpleText?: string;
	runs?: TextRun[];
};

type PlaylistRenderer = {
	videoId?: string;
	index?: TextRenderer;
	indexText?: TextRenderer;
	title?: unknown;
	shortBylineText?: TextRenderer;
	longBylineText?: TextRenderer;
	ownerText?: TextRenderer;
	bylineText?: TextRenderer;
	thumbnail?: {
		thumbnails?: Thumbnail[];
	};
	upcomingEventData?: unknown;
	thumbnailOverlays?: unknown[];
	badges?: unknown[];
};

type ContinuationLoader = (continuation: string) => Promise<unknown>;
type PlaylistEntryFilter = (entry: PlaylistEntry) => boolean;

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null;
}

function childValues(value: JsonObject): unknown[] {
	return Object.values(value);
}

function rendererText(value: unknown): string | null {
	if (!isObject(value)) {
		return null;
	}

	if (typeof value.simpleText === 'string') {
		return value.simpleText;
	}

	if (!Array.isArray(value.runs)) {
		return null;
	}

	const text = value.runs
		.map((run) => isObject(run) && typeof run.text === 'string' ? run.text : '')
		.join('');
	return text || null;
}

function youtubeUrlFromPath(path: string): string {
	if (/^https?:\/\//i.test(path)) {
		return path;
	}

	return `https://www.youtube.com${path.startsWith('/') ? path : `/${path}`}`;
}

function channelMetadataFromTextRenderer(value: unknown): Pick<PlaylistEntry, 'author' | 'channelUrl' | 'channelId'> {
	const author = rendererText(value);
	if (!author || !isObject(value) || !Array.isArray(value.runs)) {
		return author ? { author: normalizeHtmlText(author) } : {};
	}

	for (const run of value.runs) {
		if (!isObject(run) || !isObject(run.navigationEndpoint) || !isObject(run.navigationEndpoint.browseEndpoint)) {
			continue;
		}

		const endpoint = run.navigationEndpoint.browseEndpoint;
		const browseId = typeof endpoint.browseId === 'string' && endpoint.browseId ? endpoint.browseId : undefined;
		const canonicalBaseUrl = typeof endpoint.canonicalBaseUrl === 'string' && endpoint.canonicalBaseUrl ? endpoint.canonicalBaseUrl : undefined;
		const channelUrl = canonicalBaseUrl
			? youtubeUrlFromPath(canonicalBaseUrl)
			: browseId ? `https://www.youtube.com/channel/${browseId}` : undefined;

		return {
			author: normalizeHtmlText(author),
			...(channelUrl ? { channelUrl } : {}),
			...(browseId?.startsWith('UC') ? { channelId: browseId } : {}),
		};
	}

	return { author: normalizeHtmlText(author) };
}

function playlistEntryChannelMetadata(renderer: PlaylistRenderer): Pick<PlaylistEntry, 'author' | 'channelUrl' | 'channelId'> {
	for (const byline of [renderer.shortBylineText, renderer.longBylineText, renderer.ownerText, renderer.bylineText]) {
		const metadata = channelMetadataFromTextRenderer(byline);
		if (metadata.author) {
			return metadata;
		}
	}

	return {};
}

const LIVE_STATUS_MARKERS = new Set([
	'LIVE',
	'LIVE_NOW',
	'BADGE_STYLE_TYPE_LIVE',
	'BADGE_STYLE_TYPE_LIVE_NOW',
]);
const UPCOMING_STATUS_MARKERS = new Set([
	'UPCOMING',
	'BADGE_STYLE_TYPE_UPCOMING',
]);

function normalizedStatusValue(value: unknown): string | null {
	return typeof value === 'string'
		? value.trim().replace(/\s+/g, ' ').toUpperCase()
		: null;
}

function statusFromStableMarker(value: unknown): PlaylistEntry['liveStatus'] {
	const marker = normalizedStatusValue(value);
	if (!marker) {
		return undefined;
	}
	if (UPCOMING_STATUS_MARKERS.has(marker)) {
		return 'upcoming';
	}
	if (LIVE_STATUS_MARKERS.has(marker)) {
		return 'live';
	}
	return undefined;
}

function statusFromExactEnglishText(value: unknown): PlaylistEntry['liveStatus'] {
	const text = normalizedStatusValue(value);
	if (text === 'UPCOMING') {
		return 'upcoming';
	}
	if (text === 'LIVE' || text === 'LIVE NOW') {
		return 'live';
	}
	return undefined;
}

function statusFromKnownRenderer(renderer: unknown): PlaylistEntry['liveStatus'] {
	if (!isObject(renderer)) {
		return undefined;
	}

	const iconType = isObject(renderer.icon) ? renderer.icon.iconType : undefined;
	const stableStatus = statusFromStableMarker(renderer.style) ?? statusFromStableMarker(iconType);
	if (stableStatus) {
		return stableStatus;
	}

	return statusFromExactEnglishText(rendererText(renderer.text))
		?? statusFromExactEnglishText(renderer.label)
		?? statusFromExactEnglishText(renderer.tooltip);
}

function statusesFromKnownContainers(values: unknown, rendererKey: string): PlaylistEntry['liveStatus'][] {
	if (!Array.isArray(values)) {
		return [];
	}

	return values.flatMap((container) => {
		if (!isObject(container)) {
			return [];
		}
		const status = statusFromKnownRenderer(container[rendererKey]);
		return status ? [status] : [];
	});
}

function playlistEntryLiveStatus(renderer: PlaylistRenderer): PlaylistEntry['liveStatus'] {
	if (renderer.upcomingEventData) {
		return 'upcoming';
	}

	const statuses = [
		...statusesFromKnownContainers(renderer.thumbnailOverlays, 'thumbnailOverlayTimeStatusRenderer'),
		...statusesFromKnownContainers(renderer.badges, 'metadataBadgeRenderer'),
	];
	if (statuses.includes('upcoming')) {
		return 'upcoming';
	}
	if (statuses.includes('live')) {
		return 'live';
	}
	return undefined;
}

export function playlistTitleFromPayload(payload: unknown): string | null {
	let title: string | null = null;

	walkJson(payload, (node) => {
		if (title) {
			return false;
		}

		const metadata = node.playlistMetadataRenderer;
		if (isObject(metadata) && typeof metadata.title === 'string') {
			title = normalizeHtmlText(metadata.title);
			return false;
		}

		const pageHeader = node.pageHeaderRenderer;
		if (isObject(pageHeader) && typeof pageHeader.pageTitle === 'string') {
			title = normalizeHtmlText(pageHeader.pageTitle);
			return false;
		}

		const header = node.playlistHeaderRenderer;
		if (isObject(header)) {
			const candidate = rendererText(header.title);
			if (candidate) {
				title = normalizeHtmlText(candidate);
				return false;
			}
		}

		return true;
	});

	return title;
}

function walkJson(value: unknown, visitObject: (node: JsonObject) => boolean | void): void {
	if (Array.isArray(value)) {
		for (const item of value) {
			walkJson(item, visitObject);
		}
		return;
	}

	if (!isObject(value)) {
		return;
	}

	if (visitObject(value) === false) {
		return;
	}

	for (const child of childValues(value)) {
		walkJson(child, visitObject);
	}
}

function collectPlaylistPage(
	payload: unknown,
	playlistId: string,
	entries: Map<string, PlaylistEntry>,
	maxEntries: number,
	entryFilter?: PlaylistEntryFilter,
): string | null {
	let nextToken: string | null = null;

	walkJson(payload, (node) => {
		const renderer = playlistVideoRenderer(node);
		if (renderer?.videoId && entries.size < maxEntries && !entries.has(renderer.videoId)) {
			const fallbackIndex = entries.size + 1;
			const title = rendererText(renderer.title) ?? `Video ${fallbackIndex}`;
			const thumbnailUrl = bestProvidedThumbnailUrl(renderer.thumbnail?.thumbnails);
			const channelMetadata = playlistEntryChannelMetadata(renderer);
			const liveStatus = playlistEntryLiveStatus(renderer);
			const entry: PlaylistEntry = {
				videoId: renderer.videoId,
				url: `https://www.youtube.com/watch?v=${renderer.videoId}&list=${playlistId}`,
				position: playlistPosition(renderer, fallbackIndex),
				title: normalizeHtmlText(title),
				...channelMetadata,
				...(thumbnailUrl ? { thumbnailUrl } : {}),
				...(liveStatus ? { liveStatus } : {}),
			};
			if (!entryFilter || entryFilter(entry)) {
				entries.set(renderer.videoId, entry);
			}
		}

		if (!nextToken) {
			nextToken = continuationToken(node);
		}

		return true;
	});

	return nextToken;
}

function playlistVideoRenderer(node: JsonObject): PlaylistRenderer | null {
	if (isObject(node.playlistVideoRenderer)) {
		return node.playlistVideoRenderer;
	}

	if (isObject(node.playlistPanelVideoRenderer)) {
		return node.playlistPanelVideoRenderer;
	}

	return null;
}

function playlistPosition(renderer: PlaylistRenderer, fallbackPosition: number): number {
	const raw = rendererText(renderer.index) ?? rendererText(renderer.indexText) ?? '';
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackPosition;
}

function continuationToken(node: JsonObject): string | null {
	if (isObject(node.continuationItemRenderer)) {
		const endpoint = node.continuationItemRenderer.continuationEndpoint;
		if (isObject(endpoint) && isObject(endpoint.continuationCommand)) {
			const token = endpoint.continuationCommand.token;
			if (typeof token === 'string' && token) {
				return token;
			}
		}

		if (isObject(endpoint) && isObject(endpoint.commandExecutorCommand) && Array.isArray(endpoint.commandExecutorCommand.commands)) {
			for (const command of endpoint.commandExecutorCommand.commands) {
				if (!isObject(command) || !isObject(command.continuationCommand)) {
					continue;
				}

				const token = command.continuationCommand.token;
				if (typeof token === 'string' && token) {
					return token;
				}
			}
		}
	}

	if (Array.isArray(node.continuations)) {
		for (const candidate of node.continuations) {
			if (!isObject(candidate) || !isObject(candidate.nextContinuationData)) {
				continue;
			}

			const token = candidate.nextContinuationData.continuation;
			if (typeof token === 'string' && token) {
				return token;
			}
		}
	}

	return null;
}

function sortedEntries(entries: Map<string, PlaylistEntry>): PlaylistEntry[] {
	return Array.from(entries.values()).sort((left, right) => left.position - right.position || left.videoId.localeCompare(right.videoId));
}

export async function collectPlaylistEntries(
	initialPayload: unknown,
	playlistId: string,
	loadContinuation: ContinuationLoader,
	maxEntries?: number | null,
	entryFilter?: PlaylistEntryFilter,
): Promise<PlaylistEntry[]> {
	const limit = maxEntries == null ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor(maxEntries));
	if (limit === 0) {
		return [];
	}

	const entries = new Map<string, PlaylistEntry>();
	let token = collectPlaylistPage(initialPayload, playlistId, entries, limit, entryFilter);

	while (token && entries.size < limit) {
		const page = await loadContinuation(token);
		const nextToken = collectPlaylistPage(page, playlistId, entries, limit, entryFilter);
		if (!nextToken || nextToken === token) {
			break;
		}

		token = nextToken;
	}

	return sortedEntries(entries);
}
