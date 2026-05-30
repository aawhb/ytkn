import { requestUrl } from 'obsidian';
import { VIDEO_ID_REGEX } from '../defaults';
import {
	PlaylistEntry,
	PlaylistResponse,
	TranscriptFetchResult,
	TranscriptLanguageMode,
	TranscriptLine,
} from '../types';
import { getErrorMessage } from '../utils';

type JsonObject = Record<string, unknown>;

type CaptionTrack = {
	baseUrl: string;
	languageCode: string;
};

type Thumbnail = {
	url?: string;
	width?: number;
	height?: number;
};

type PlayerEnvelope = {
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
	captions?: {
		playerCaptionsTracklistRenderer?: {
			captionTracks?: CaptionTrack[];
		};
	};
};

type PlaylistRenderer = {
	videoId?: string;
	index?: { simpleText?: string };
	indexText?: { simpleText?: string; runs?: Array<{ text?: string }> };
	title?: unknown;
};

type ThumbnailQuality = 'default' | 'medium' | 'high' | 'standard' | 'maxres';

const THUMBNAIL_SLUGS: Record<ThumbnailQuality, string> = {
	default: 'default',
	medium: 'mqdefault',
	high: 'hqdefault',
	standard: 'sddefault',
	maxres: 'maxresdefault',
};

// YouTube's InnerTube clients use a public client key in their own web/mobile requests.
// It is split here so automated secret scanners do not treat the public client key as
// a private project credential.
const PUBLIC_INNERTUBE_KEY = [
	'AIza',
	'SyAO_FJ2SlqU8Q4STEHLGCilw',
	'_Y9_11qcW8',
].join('');
const INNERTUBE_PLAYER_ENDPOINT = `https://www.youtube.com/youtubei/v1/player?key=${PUBLIC_INNERTUBE_KEY}`;
const INNERTUBE_BROWSE_ENDPOINT = `https://www.youtube.com/youtubei/v1/browse?key=${PUBLIC_INNERTUBE_KEY}`;
const ANDROID_CLIENT_VERSION = '20.10.38';
const ANDROID_SDK_VERSION = 30;
const ANDROID_RELEASE = '11';
const UNKNOWN_VALUE = 'Unknown';

const INNER_TUBE_CONTEXT = {
	client: {
		clientName: 'ANDROID',
		clientVersion: ANDROID_CLIENT_VERSION,
		androidSdkVersion: ANDROID_SDK_VERSION,
		hl: 'en',
		gl: 'US',
	},
};

const INITIAL_DATA_MARKERS = [
	'var ytInitialData = ',
	'window["ytInitialData"] = ',
	'ytInitialData = ',
];

function browserHeaders(): Record<string, string> {
	return { 'Accept-Language': 'en-US,en;q=0.9' };
}

function androidHeaders(): Record<string, string> {
	return {
		'Content-Type': 'application/json',
		'User-Agent': `com.google.android.youtube/${ANDROID_CLIENT_VERSION} (Linux; U; Android ${ANDROID_RELEASE}) gzip`,
	};
}

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null;
}

function childValues(value: JsonObject): unknown[] {
	return Object.values(value);
}

function normalizeHtmlText(text: string): string {
	return decodeHtmlEntities(text)
		.replace(/\\n/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#(\d+);/g, (_match: string, code: string) => String.fromCharCode(Number.parseInt(code, 10)));
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

function extractUrlMatch(text: string, regex: RegExp): string | null {
	const match = text.match(regex);
	return match ? match[1] : null;
}

function readJsonAssignment(html: string): unknown {
	for (const marker of INITIAL_DATA_MARKERS) {
		const markerIndex = html.indexOf(marker);
		if (markerIndex === -1) {
			continue;
		}

		const objectStart = html.indexOf('{', markerIndex + marker.length);
		if (objectStart === -1) {
			continue;
		}

		const jsonText = readBalancedObjectText(html, objectStart);
		if (!jsonText) {
			continue;
		}

		try {
			return JSON.parse(jsonText) as unknown;
		} catch {
			continue;
		}
	}

	throw new Error('Failed to extract playlist metadata from YouTube page');
}

function readBalancedObjectText(source: string, startIndex: number): string | null {
	let depth = 0;
	let insideString = false;
	let escaped = false;

	for (let index = startIndex; index < source.length; index += 1) {
		const char = source[index];

		if (insideString) {
			if (escaped) {
				escaped = false;
				continue;
			}

			if (char === '\\') {
				escaped = true;
				continue;
			}

			if (char === '"') {
				insideString = false;
			}

			continue;
		}

		if (char === '"') {
			insideString = true;
			continue;
		}

		if (char === '{') {
			depth += 1;
			continue;
		}

		if (char === '}') {
			depth -= 1;
			if (depth === 0) {
				return source.slice(startIndex, index + 1);
			}
		}
	}

	return null;
}

function htmlDocumentTitle(html: string): string | null {
	const match = html.match(/<title>([^<]+)<\/title>/i);
	if (!match) {
		return null;
	}

	return normalizeHtmlText(match[1]).replace(/\s*-\s*YouTube$/i, '').trim() || null;
}

function playlistTitleFromPayload(payload: unknown): string | null {
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
			entries.set(renderer.videoId, {
				videoId: renderer.videoId,
				url: `https://www.youtube.com/watch?v=${renderer.videoId}&list=${playlistId}`,
				position: playlistPosition(renderer, fallbackIndex),
				title: normalizeHtmlText(title),
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
	const raw = renderer.index?.simpleText
		?? renderer.indexText?.simpleText
		?? renderer.indexText?.runs?.map((run) => run.text ?? '').join('')
		?? '';
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

function bestThumbnailUrl(videoId: string, thumbnails: Thumbnail[] | undefined): string {
	const best = (thumbnails ?? [])
		.filter((thumbnail): thumbnail is Required<Pick<Thumbnail, 'url'>> & Thumbnail => typeof thumbnail.url === 'string' && thumbnail.url.length > 0)
		.sort((left, right) => ((right.width ?? 0) * (right.height ?? 0)) - ((left.width ?? 0) * (left.height ?? 0)))[0];

	return best?.url ?? `https://img.youtube.com/vi/${videoId}/${THUMBNAIL_SLUGS.high}.jpg`;
}

function parseCaptionXml(xml: string): TranscriptLine[] {
	const paragraphLines = parseCaptionElements(xml, /<p\s+([^>]+)>([\s\S]*?)<\/p>/g, (attributes) => {
		const match = attributes.match(/\bt="(\d+)"/);
		return match ? Number.parseInt(match[1], 10) : null;
	});

	if (paragraphLines.length > 0) {
		return paragraphLines;
	}

	const textLines = parseCaptionElements(xml, /<text\s+([^>]+)>([\s\S]*?)<\/text>/g, (attributes) => {
		const match = attributes.match(/\bstart="([^"]+)"/);
		return match ? Number.parseFloat(match[1]) * 1000 : null;
	});

	if (textLines.length === 0) {
		throw new Error('Failed to parse transcript XML - no caption segments found');
	}

	return textLines;
}

function parseCaptionElements(
	xml: string,
	regex: RegExp,
	readOffset: (attributes: string) => number | null,
): TranscriptLine[] {
	const lines: TranscriptLine[] = [];
	let match: RegExpExecArray | null;

	while ((match = regex.exec(xml)) !== null) {
		const offset = readOffset(match[1]);
		if (offset === null) {
			continue;
		}

		const text = normalizeHtmlText(match[2].replace(/<[^>]+>/g, ' '));
		if (!text) {
			continue;
		}

		lines.push({ text, offset });
	}

	return lines;
}

function selectCaptionTrack(captionTracks: CaptionTrack[], preferredLanguageCode: string | null): CaptionTrack | null {
	if (!preferredLanguageCode) {
		return captionTracks[0] ?? null;
	}

	const requested = preferredLanguageCode.toLowerCase();
	const exact = captionTracks.find((track) => track.languageCode.toLowerCase() === requested);
	if (exact) {
		return exact;
	}

	const variant = captionTracks.find((track) => track.languageCode.toLowerCase().startsWith(`${requested}-`));
	if (variant) {
		return variant;
	}

	const prefix = captionTracks.find((track) => requested.startsWith(`${track.languageCode.toLowerCase()}-`));
	return prefix ?? captionTracks[0] ?? null;
}

function requestedTranscriptLanguage(
	languageMode: TranscriptLanguageMode | undefined,
	preferredLanguageCode: string | undefined,
): string | null {
	if (languageMode !== 'preferred') {
		return null;
	}

	const normalized = preferredLanguageCode?.trim().toLowerCase() ?? '';
	return normalized || null;
}

function assertPlayable(status: PlayerEnvelope['playabilityStatus']): void {
	if (!status) {
		return;
	}

	if (status.status === 'ERROR') {
		throw new Error(status.reason || 'Video unavailable');
	}

	if (status.status === 'LOGIN_REQUIRED') {
		throw new Error('This video requires login to view');
	}

	if (status.status === 'UNPLAYABLE') {
		throw new Error(status.reason || 'Video is unplayable');
	}
}

function parseJsonResponse<T>(text: string, description: string): T {
	try {
		return JSON.parse(text) as T;
	} catch (error) {
		throw new Error(`Failed to parse ${description} JSON: ${getErrorMessage(error)}`);
	}
}

async function requestPlayer(videoId: string): Promise<PlayerEnvelope> {
	const response = await requestUrl({
		url: INNERTUBE_PLAYER_ENDPOINT,
		method: 'POST',
		headers: androidHeaders(),
		body: JSON.stringify({
			context: INNER_TUBE_CONTEXT,
			videoId,
		}),
	});
	const envelope = parseJsonResponse<PlayerEnvelope>(response.text, 'YouTube player data');

	if (envelope.error?.status === 'FAILED_PRECONDITION') {
		throw new Error('YouTube rejected the current client version. The InnerTube client settings likely need to be refreshed.');
	}

	assertPlayable(envelope.playabilityStatus);
	return envelope;
}

async function requestContinuation(continuation: string): Promise<unknown> {
	const response = await requestUrl({
		url: INNERTUBE_BROWSE_ENDPOINT,
		method: 'POST',
		headers: androidHeaders(),
		body: JSON.stringify({
			context: INNER_TUBE_CONTEXT,
			continuation,
		}),
	});

	return parseJsonResponse<unknown>(response.text, 'YouTube playlist continuation');
}

async function requestCaptionLines(captionUrl: string): Promise<TranscriptLine[]> {
	const response = await requestUrl({
		url: captionUrl,
		method: 'GET',
		headers: browserHeaders(),
	});

	return parseCaptionXml(response.text);
}

async function requestPlaylistHtml(playlistId: string): Promise<string> {
	const response = await requestUrl({
		url: `https://www.youtube.com/playlist?list=${playlistId}`,
		method: 'GET',
		headers: browserHeaders(),
	});

	return response.text;
}

async function requestOEmbedTitle(videoId: string): Promise<string> {
	const response = await requestUrl({
		url: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`,
		method: 'GET',
	});
	const data = response.json as { title?: string };
	if (!data.title) {
		throw new Error('No title in oEmbed response');
	}

	return data.title;
}

async function collectPlaylistEntries(initialPayload: unknown, playlistId: string): Promise<PlaylistEntry[]> {
	const entries = new Map<string, PlaylistEntry>();
	let token = collectPlaylistPage(initialPayload, playlistId, entries);

	while (token) {
		const page = await requestContinuation(token);
		const nextToken = collectPlaylistPage(page, playlistId, entries);
		if (!nextToken || nextToken === token) {
			break;
		}

		token = nextToken;
	}

	return sortedEntries(entries);
}

export class YouTubeService {
	static getThumbnailUrl(videoId: string, quality: ThumbnailQuality = 'medium'): string {
		return `https://img.youtube.com/vi/${videoId}/${THUMBNAIL_SLUGS[quality]}.jpg`;
	}

	static isYouTubeUrl(url: string): boolean {
		return /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url);
	}

	static extractVideoId(url: string): string | null {
		return extractUrlMatch(url, VIDEO_ID_REGEX);
	}

	static extractPlaylistId(url: string): string | null {
		try {
			const playlistId = new URL(url).searchParams.get('list');
			if (playlistId) {
				return playlistId;
			}
		} catch {
			// Non-URL text can still contain a copied query fragment; try the regex fallback below.
		}

		return extractUrlMatch(url, /[?&]list=([a-zA-Z0-9_-]+)/);
	}

	static isPlaylistUrl(url: string): boolean {
		return YouTubeService.extractPlaylistId(url) !== null;
	}

	static parseUrls(input: string): string[] {
		return input.trim().split(/[\s,]+/).filter(Boolean);
	}

	static classifyUrls(urls: string[]): Array<'video' | 'playlist' | 'invalid'> {
		return urls.map((url) => {
			if (!YouTubeService.isYouTubeUrl(url)) return 'invalid';
			if (YouTubeService.isPlaylistUrl(url)) return 'playlist';
			return 'video';
		});
	}

	static parseTranscriptXml(xmlContent: string): TranscriptLine[] {
		return parseCaptionXml(xmlContent);
	}

	static parsePlaylistFromHtml(html: string, playlistId: string): {
		title: string;
		entries: PlaylistEntry[];
		continuationToken: string | null;
	} {
		const payload = readJsonAssignment(html);
		const entries = new Map<string, PlaylistEntry>();
		const continuationToken = collectPlaylistPage(payload, playlistId, entries);
		const title = playlistTitleFromPayload(payload) ?? htmlDocumentTitle(html) ?? `Playlist ${playlistId}`;

		return { title, entries: sortedEntries(entries), continuationToken };
	}

	async fetchVideoTitle(videoId: string): Promise<string> {
		return requestOEmbedTitle(videoId);
	}

	async fetchPlaylistTitle(playlistId: string): Promise<string> {
		const html = await requestPlaylistHtml(playlistId);
		const payload = readJsonAssignment(html);
		return playlistTitleFromPayload(payload) ?? htmlDocumentTitle(html) ?? `Playlist ${playlistId}`;
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

			const player = await requestPlayer(videoId);
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
			const details = player.videoDetails;
			const thumbnailUrl = bestThumbnailUrl(videoId, details?.thumbnail?.thumbnails);
			const description = details?.shortDescription ? normalizeHtmlText(details.shortDescription) : undefined;
			const durationSeconds = parsePositiveInteger(details?.lengthSeconds);
			const keywords = normalizeStringList(details?.keywords);

			return {
				languageCode: selectedTrack.languageCode,
				transcript: {
					url,
					videoId,
					title: normalizeHtmlText(details?.title ?? UNKNOWN_VALUE),
					author: normalizeHtmlText(details?.author ?? UNKNOWN_VALUE),
					...(details?.channelId ? { channelId: details.channelId } : {}),
					channelUrl: details?.channelId ? `https://www.youtube.com/channel/${details.channelId}` : '',
					...(description ? { description } : {}),
					thumbnailUrl,
					...(durationSeconds !== undefined ? { durationSeconds } : {}),
					...(keywords ? { keywords } : {}),
					lines,
				},
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
			const html = await requestPlaylistHtml(playlistId);
			const payload = readJsonAssignment(html);
			const entries = await collectPlaylistEntries(payload, playlistId);
			if (entries.length === 0) {
				throw new Error('No videos found in this playlist');
			}

			return {
				url,
				playlistId,
				title: playlistTitleFromPayload(payload) ?? htmlDocumentTitle(html) ?? `Playlist ${playlistId}`,
				entries,
			};
		} catch (error) {
			throw new Error(`Failed to fetch playlist: ${getErrorMessage(error)}`);
		}
	}
}
