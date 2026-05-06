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

type CaptionTrack = {
	baseUrl: string;
	languageCode: string;
};

type PlayerResponse = {
	error?: { status?: string };
	playabilityStatus?: {
		status?: string;
		reason?: string;
	};
	videoDetails?: {
		title?: string;
		author?: string;
		channelId?: string;
	};
	captions?: {
		playerCaptionsTracklistRenderer?: {
			captionTracks?: CaptionTrack[];
		};
	};
};

const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const INNERTUBE_PLAYER_URL = `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`;
const INNERTUBE_BROWSE_URL = `https://www.youtube.com/youtubei/v1/browse?key=${INNERTUBE_API_KEY}`;
const DEFAULT_CLIENT_VERSION = '20.10.38';
const DEFAULT_ANDROID_SDK_VERSION = 30;
const UNKNOWN_VALUE = 'Unknown';

const INNERTUBE_CONTEXT = {
	client: {
		clientName: 'ANDROID',
		clientVersion: DEFAULT_CLIENT_VERSION,
		androidSdkVersion: DEFAULT_ANDROID_SDK_VERSION,
		hl: 'en',
		gl: 'US',
	},
};

function buildAndroidClientHeaders(): Record<string, string> {
	return {
		'Content-Type': 'application/json',
		'User-Agent': `com.google.android.youtube/${DEFAULT_CLIENT_VERSION} (Linux; U; Android 11) gzip`,
	};
}

function buildBrowserHeaders(): Record<string, string> {
	return {
		'Accept-Language': 'en-US,en;q=0.9',
	};
}

type ThumbnailQuality = 'default' | 'medium' | 'high' | 'standard' | 'maxres';

const THUMBNAIL_SLUGS: Record<ThumbnailQuality, string> = {
	default: 'default',
	medium: 'mqdefault',
	high: 'hqdefault',
	standard: 'sddefault',
	maxres: 'maxresdefault',
};

export class YouTubeService {
	static getThumbnailUrl(videoId: string, quality: ThumbnailQuality = 'maxres'): string {
		return `https://img.youtube.com/vi/${videoId}/${THUMBNAIL_SLUGS[quality]}.jpg`;
	}

	static isYouTubeUrl(url: string): boolean {
		return /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url);
	}

	static extractVideoId(url: string): string | null {
		return YouTubeService.extractUrlMatch(url, VIDEO_ID_REGEX);
	}

	static extractPlaylistId(url: string): string | null {
		try {
			const parsedUrl = new URL(url);
			const playlistId = parsedUrl.searchParams.get('list');
			if (playlistId) {
				return playlistId;
			}
		} catch {
			// non-URL input — drop through to regex
		}

		const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
		return match ? match[1] : null;
	}

	static isPlaylistUrl(url: string): boolean {
		return Boolean(YouTubeService.extractPlaylistId(url));
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

	async fetchVideoTitle(videoId: string): Promise<string> {
		const response = await requestUrl({
			url: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`,
			method: 'GET',
		});
		const data = response.json as { title?: string };
		if (!data.title) throw new Error('No title in oEmbed response');
		return data.title;
	}

	async fetchPlaylistTitle(playlistId: string): Promise<string> {
		const response = await requestUrl({
			url: `https://www.youtube.com/playlist?list=${playlistId}`,
			method: 'GET',
			headers: buildBrowserHeaders(),
		});
		const initialData = this.extractInitialData(response.text);
		const title = this.extractPlaylistTitle(initialData)
			?? this.extractHtmlTitle(response.text)
			?? `Playlist ${playlistId}`;
		return title;
	}

	static parseTranscriptXml(xmlContent: string): TranscriptLine[] {
		return new YouTubeService().parseTranscriptXml(xmlContent);
	}

	static parsePlaylistFromHtml(html: string, playlistId: string): {
		title: string;
		entries: PlaylistEntry[];
		continuationToken: string | null;
	} {
		const service = new YouTubeService();
		const initialData = service.extractInitialData(html);
		const entries = new Map<string, PlaylistEntry>();
		const continuationToken = service.collectPlaylistPayload(initialData, playlistId, entries);
		const title = service.extractPlaylistTitle(initialData)
			?? service.extractHtmlTitle(html)
			?? `Playlist ${playlistId}`;

		const sortedEntries = Array.from(entries.values()).sort(
			(left, right) => left.position - right.position || left.videoId.localeCompare(right.videoId),
		);

		return { title, entries: sortedEntries, continuationToken };
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

			const playerData = await this.fetchPlayerData(videoId);
			const captionTracks = playerData.captions?.playerCaptionsTracklistRenderer?.captionTracks;
			if (!captionTracks?.length) {
				throw new Error('No captions available for this video');
			}

			const requestedLanguageCode = this.resolveRequestedLanguageCode(options.languageMode, options.preferredLanguageCode);
			const captionTrack = this.findCaptionTrack(captionTracks, requestedLanguageCode);
			if (!captionTrack) {
				const availableLanguages = captionTracks.map((track) => track.languageCode).join(', ');
				if (requestedLanguageCode) {
					throw new Error(`No transcript found for language '${requestedLanguageCode}'. Available: ${availableLanguages}`);
				}

				throw new Error(`No transcript found. Available: ${availableLanguages}`);
			}

			const lines = await this.fetchTranscriptFromUrl(captionTrack.baseUrl);
			const videoDetails = playerData.videoDetails;

			return {
				transcript: {
					url,
					videoId,
					title: this.decodeHtml(videoDetails?.title || UNKNOWN_VALUE),
					author: this.decodeHtml(videoDetails?.author || UNKNOWN_VALUE),
					channelUrl: videoDetails?.channelId ? `https://www.youtube.com/channel/${videoDetails.channelId}` : '',
					lines,
				},
				languageCode: captionTrack.languageCode,
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
			const html = await requestUrl({
				url: `https://www.youtube.com/playlist?list=${playlistId}`,
				method: 'GET',
				headers: buildBrowserHeaders(),
			});

			const initialData = this.extractInitialData(html.text);
			const title = this.extractPlaylistTitle(initialData) ?? this.extractHtmlTitle(html.text) ?? `Playlist ${playlistId}`;
			const entries = await this.fetchPlaylistEntries(initialData, playlistId);

			if (entries.length === 0) {
				throw new Error('No videos found in this playlist');
			}

			return {
				url,
				playlistId,
				title,
				entries,
			};
		} catch (error) {
			throw new Error(`Failed to fetch playlist: ${getErrorMessage(error)}`);
		}
	}

	private async fetchPlayerData(videoId: string): Promise<PlayerResponse> {
		const response = await requestUrl({
			url: INNERTUBE_PLAYER_URL,
			method: 'POST',
			headers: buildAndroidClientHeaders(),
			body: JSON.stringify({
				context: INNERTUBE_CONTEXT,
				videoId,
			}),
		});

		let data: PlayerResponse;
		try {
			data = JSON.parse(response.text) as PlayerResponse;
		} catch (error) {
			throw new Error(`Failed to parse YouTube player data JSON: ${getErrorMessage(error)}`);
		}

		if (data.error?.status === 'FAILED_PRECONDITION') {
			throw new Error('YouTube rejected the current client version. The InnerTube client settings likely need to be refreshed.');
		}

		this.assertPlayable(data.playabilityStatus);
		return data;
	}

	private async fetchPlaylistEntries(initialData: unknown, playlistId: string): Promise<PlaylistEntry[]> {
		const entries = new Map<string, PlaylistEntry>();
		let continuationToken = this.collectPlaylistPayload(initialData, playlistId, entries);

		while (continuationToken) {
			const payload = await this.fetchPlaylistContinuation(continuationToken);
			const nextToken = this.collectPlaylistPayload(payload, playlistId, entries);
			if (!nextToken || nextToken === continuationToken) {
				break;
			}

			continuationToken = nextToken;
		}

		return Array.from(entries.values()).sort((left, right) => left.position - right.position || left.videoId.localeCompare(right.videoId));
	}

	private async fetchPlaylistContinuation(continuation: string): Promise<unknown> {
		const response = await requestUrl({
			url: INNERTUBE_BROWSE_URL,
			method: 'POST',
			headers: buildAndroidClientHeaders(),
			body: JSON.stringify({
				context: INNERTUBE_CONTEXT,
				continuation,
			}),
		});

		try {
			return JSON.parse(response.text) as unknown;
		} catch (error) {
			throw new Error(`Failed to parse YouTube playlist continuation JSON: ${getErrorMessage(error)}`);
		}
	}

	private collectPlaylistPayload(payload: unknown, playlistId: string, entries: Map<string, PlaylistEntry>): string | null {
		let continuationToken: string | null = null;

		const visit = (node: unknown): void => {
			if (!node) {
				return;
			}

			if (Array.isArray(node)) {
				for (const item of node) {
					visit(item);
				}
				return;
			}

			if (typeof node !== 'object') {
				return;
			}

			const record = node as Record<string, unknown>;
			const renderer = this.getPlaylistVideoRenderer(record);
			if (renderer?.videoId && !entries.has(renderer.videoId)) {
				const title = this.extractText(renderer.title) ?? `Video ${entries.size + 1}`;
				entries.set(renderer.videoId, {
					videoId: renderer.videoId,
					url: `https://www.youtube.com/watch?v=${renderer.videoId}&list=${playlistId}`,
					position: this.extractPlaylistPosition(renderer, entries.size + 1),
					title: this.decodeHtml(title),
				});
			}

			if (!continuationToken) {
				continuationToken = this.extractContinuationToken(record);
			}

			for (const value of Object.values(record)) {
				visit(value);
			}
		};

		visit(payload);
		return continuationToken;
	}

	private getPlaylistVideoRenderer(node: Record<string, unknown>): {
		videoId?: string;
		index?: { simpleText?: string };
		indexText?: { simpleText?: string; runs?: Array<{ text?: string }> };
		title?: unknown;
	} | null {
		const playlistVideoRenderer = node.playlistVideoRenderer;
		if (playlistVideoRenderer && typeof playlistVideoRenderer === 'object') {
			return playlistVideoRenderer;
		}

		const playlistPanelVideoRenderer = node.playlistPanelVideoRenderer;
		if (playlistPanelVideoRenderer && typeof playlistPanelVideoRenderer === 'object') {
			return playlistPanelVideoRenderer;
		}

		return null;
	}

	private extractPlaylistPosition(
		renderer: { index?: { simpleText?: string }; indexText?: { simpleText?: string; runs?: Array<{ text?: string }> } },
		fallbackPosition: number,
	): number {
		const rawValue = renderer.index?.simpleText
			?? renderer.indexText?.simpleText
			?? renderer.indexText?.runs?.map((run) => run.text ?? '').join('')
			?? '';
		const parsedValue = Number.parseInt(rawValue, 10);
		return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackPosition;
	}

	private extractContinuationToken(node: Record<string, unknown>): string | null {
		const continuationItemRenderer = node.continuationItemRenderer;
		if (continuationItemRenderer && typeof continuationItemRenderer === 'object') {
			const token = (((continuationItemRenderer as {
				continuationEndpoint?: { continuationCommand?: { token?: string } };
			}).continuationEndpoint)?.continuationCommand)?.token;
			if (token) {
				return token;
			}
		}

		const continuations = node.continuations;
		if (Array.isArray(continuations)) {
			for (const continuation of continuations) {
				if (!continuation || typeof continuation !== 'object') {
					continue;
				}

				const token = ((continuation as { nextContinuationData?: { continuation?: string } }).nextContinuationData)?.continuation;
				if (token) {
					return token;
				}
			}
		}

		return null;
	}

	private extractInitialData(html: string): unknown {
		const markers = ['var ytInitialData = ', 'window["ytInitialData"] = ', 'ytInitialData = '];

		for (const marker of markers) {
			const parsed = this.extractAssignedJson(html, marker);
			if (parsed) {
				return parsed;
			}
		}

		throw new Error('Failed to extract playlist metadata from YouTube page');
	}

	private extractAssignedJson(html: string, marker: string): unknown {
		const markerIndex = html.indexOf(marker);
		if (markerIndex === -1) {
			return null;
		}

		const jsonStart = html.indexOf('{', markerIndex + marker.length);
		if (jsonStart === -1) {
			return null;
		}

		const jsonText = this.readBalancedJson(html, jsonStart);
		if (!jsonText) {
			return null;
		}

		try {
			return JSON.parse(jsonText) as unknown;
		} catch {
			return null;
		}
	}

	private readBalancedJson(text: string, startIndex: number): string | null {
		let depth = 0;
		let inString = false;
		let isEscaped = false;

		for (let index = startIndex; index < text.length; index += 1) {
			const char = text[index];

			if (inString) {
				if (isEscaped) {
					isEscaped = false;
					continue;
				}

				if (char === '\\') {
					isEscaped = true;
					continue;
				}

				if (char === '"') {
					inString = false;
				}

				continue;
			}

			if (char === '"') {
				inString = true;
				continue;
			}

			if (char === '{') {
				depth += 1;
			}

			if (char === '}') {
				depth -= 1;
				if (depth === 0) {
					return text.slice(startIndex, index + 1);
				}
			}
		}

		return null;
	}

	private extractPlaylistTitle(payload: unknown): string | null {
		let title: string | null = null;

		const visit = (node: unknown): void => {
			if (!node || title) {
				return;
			}

			if (Array.isArray(node)) {
				for (const item of node) {
					visit(item);
					if (title) {
						return;
					}
				}
				return;
			}

			if (typeof node !== 'object') {
				return;
			}

			const record = node as Record<string, unknown>;
			const metadataRenderer = record.playlistMetadataRenderer;
			if (metadataRenderer && typeof metadataRenderer === 'object') {
				const candidate = (metadataRenderer as { title?: string }).title;
				if (candidate) {
					title = this.decodeHtml(candidate);
					return;
				}
			}

			const headerRenderer = record.playlistHeaderRenderer;
			if (headerRenderer && typeof headerRenderer === 'object') {
				const candidate = this.extractText((headerRenderer as { title?: unknown }).title);
				if (candidate) {
					title = this.decodeHtml(candidate);
					return;
				}
			}

			for (const value of Object.values(record)) {
				visit(value);
				if (title) {
					return;
				}
			}
		};

		visit(payload);
		return title;
	}

	private extractHtmlTitle(html: string): string | null {
		const match = html.match(/<title>([^<]+)<\/title>/i);
		if (!match) {
			return null;
		}

		return this.decodeHtml(match[1]).replace(/\s*-\s*YouTube$/i, '').trim() || null;
	}

	private extractText(value: unknown): string | null {
		if (!value || typeof value !== 'object') {
			return null;
		}

		const record = value as { simpleText?: string; runs?: Array<{ text?: string }> };
		if (record.simpleText) {
			return record.simpleText;
		}

		if (Array.isArray(record.runs)) {
			const text = record.runs.map((run) => run.text ?? '').join('');
			return text || null;
		}

		return null;
	}

	private assertPlayable(playabilityStatus: PlayerResponse['playabilityStatus']): void {
		if (!playabilityStatus) {
			return;
		}

		if (playabilityStatus.status === 'ERROR') {
			throw new Error(playabilityStatus.reason || 'Video unavailable');
		}

		if (playabilityStatus.status === 'LOGIN_REQUIRED') {
			throw new Error('This video requires login to view');
		}

		if (playabilityStatus.status === 'UNPLAYABLE') {
			throw new Error(playabilityStatus.reason || 'Video is unplayable');
		}
	}

	private resolveRequestedLanguageCode(
		languageMode: TranscriptLanguageMode | undefined,
		preferredLanguageCode: string | undefined,
	): string | null {
		if (languageMode !== 'preferred') {
			return null;
		}

		const normalized = preferredLanguageCode?.trim().toLowerCase() ?? '';
		return normalized || null;
	}

	private findCaptionTrack(captionTracks: CaptionTrack[], langCode: string | null): CaptionTrack | null {
		if (!langCode) {
			return captionTracks[0] ?? null;
		}

		const exactMatch = captionTracks.find((track) => track.languageCode === langCode);
		if (exactMatch) {
			return exactMatch;
		}

		const languageVariant = captionTracks.find((track) => track.languageCode.startsWith(`${langCode}-`));
		if (languageVariant) {
			return languageVariant;
		}

		const languagePrefix = captionTracks.find((track) => langCode.startsWith(`${track.languageCode}-`));
		if (languagePrefix) {
			return languagePrefix;
		}

		return captionTracks[0] ?? null;
	}

	private async fetchTranscriptFromUrl(transcriptUrl: string): Promise<TranscriptLine[]> {
		const response = await requestUrl({
			url: transcriptUrl,
			method: 'GET',
			headers: buildBrowserHeaders(),
		});

		return this.parseTranscriptXml(response.text);
	}

	private parseTranscriptXml(xmlContent: string): TranscriptLine[] {
		const lines = this.parseParagraphCaptions(xmlContent);
		if (lines.length > 0) {
			return lines;
		}

		const textLines = this.parseTextCaptions(xmlContent);
		if (textLines.length === 0) {
			throw new Error('Failed to parse transcript XML - no caption segments found');
		}

		return textLines;
	}

	private parseParagraphCaptions(xmlContent: string): TranscriptLine[] {
		const lines: TranscriptLine[] = [];
		const paragraphRegex = /<p\s+([^>]+)>([\s\S]*?)<\/p>/g;
		let match: RegExpExecArray | null;

		while ((match = paragraphRegex.exec(xmlContent)) !== null) {
			const attributes = match[1];
			const content = match[2];
			const startMatch = attributes.match(/\bt="(\d+)"/);
			if (!startMatch) {
				continue;
			}

			this.pushLine(lines, content, parseInt(startMatch[1], 10));
		}

		return lines;
	}

	private parseTextCaptions(xmlContent: string): TranscriptLine[] {
		const lines: TranscriptLine[] = [];
		const textRegex = /<text\s+([^>]+)>([\s\S]*?)<\/text>/g;
		let match: RegExpExecArray | null;

		while ((match = textRegex.exec(xmlContent)) !== null) {
			const attributes = match[1];
			const content = match[2];
			const startMatch = attributes.match(/\bstart="([^"]+)"/);
			if (!startMatch) {
				continue;
			}

			this.pushLine(lines, content, parseFloat(startMatch[1]) * 1000);
		}

		return lines;
	}

	private pushLine(lines: TranscriptLine[], content: string, offset: number): void {
		const text = this.decodeHtml(content.replace(/<[^>]+>/g, ' '));
		if (!text.trim()) {
			return;
		}

		lines.push({
			text: text.trim(),
			offset,
		});
	}

	private static extractUrlMatch(text: string, regex: RegExp): string | null {
		const match = text.match(regex);
		return match ? match[1] : null;
	}

	private decodeEntities(text: string): string {
		return text
			.replace(/&#39;/g, "'")
			.replace(/&amp;/g, '&')
			.replace(/&quot;/g, '"')
			.replace(/&apos;/g, "'")
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&#(\d+);/g, (_match: string, code: string) => String.fromCharCode(parseInt(code, 10)));
	}

	private decodeHtml(text: string): string {
		return this.decodeEntities(text)
			.replace(/\\n/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}
}
