import type { PlaylistEntry } from '../types';
import { bestProvidedThumbnailUrl, normalizeHtmlText, Thumbnail } from './metadata';

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
};

export type ContinuationLoader = (continuation: string) => Promise<unknown>;

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

function collectPlaylistPage(payload: unknown, playlistId: string, entries: Map<string, PlaylistEntry>): string | null {
	let nextToken: string | null = null;

	walkJson(payload, (node) => {
		const renderer = playlistVideoRenderer(node);
		if (renderer?.videoId && !entries.has(renderer.videoId)) {
			const fallbackIndex = entries.size + 1;
			const title = rendererText(renderer.title) ?? `Video ${fallbackIndex}`;
			const thumbnailUrl = bestProvidedThumbnailUrl(renderer.thumbnail?.thumbnails);
			const channelMetadata = playlistEntryChannelMetadata(renderer);
			entries.set(renderer.videoId, {
				videoId: renderer.videoId,
				url: `https://www.youtube.com/watch?v=${renderer.videoId}&list=${playlistId}`,
				position: playlistPosition(renderer, fallbackIndex),
				title: normalizeHtmlText(title),
				...channelMetadata,
				...(thumbnailUrl ? { thumbnailUrl } : {}),
			});
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
): Promise<PlaylistEntry[]> {
	const entries = new Map<string, PlaylistEntry>();
	let token = collectPlaylistPage(initialPayload, playlistId, entries);

	while (token) {
		const page = await loadContinuation(token);
		const nextToken = collectPlaylistPage(page, playlistId, entries);
		if (!nextToken || nextToken === token) {
			break;
		}

		token = nextToken;
	}

	return sortedEntries(entries);
}
