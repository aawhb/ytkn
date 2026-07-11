import { VIDEO_ID_REGEX } from '../defaults';
import type { ChannelContentType } from '../types';

export type YouTubeUrlClassification = 'video' | 'playlist' | 'channel' | 'invalid';
export type ChannelUrlTab = 'home' | 'videos' | 'shorts' | 'streams';
export type UnsupportedChannelTab = 'playlists' | 'podcasts' | 'releases';
export type ChannelRef = {
	kind: 'id' | 'handle' | 'legacy';
	value: string;
	tab: ChannelUrlTab;
};

const GENERIC_CHANNEL_SUFFIXES = new Set(['featured', 'about', 'community']);
const UNSUPPORTED_CHANNEL_TABS = new Set<UnsupportedChannelTab>(['playlists', 'podcasts', 'releases']);

function parsePathSegments(url: string): string[] | null {
	try {
		return new URL(url).pathname
			.split('/')
			.filter(Boolean)
			.map((segment) => decodeURIComponent(segment));
	} catch {
		return null;
	}
}

function buildChannelRef(channelSegments: string[], tab: ChannelUrlTab): ChannelRef | null {
	if (channelSegments.length === 1 && /^@[^/]+$/.test(channelSegments[0])) {
		return { kind: 'handle', value: channelSegments[0], tab };
	}

	if (channelSegments.length === 2 && channelSegments[0] === 'channel' && /^UC[a-zA-Z0-9_-]+$/.test(channelSegments[1])) {
		return { kind: 'id', value: channelSegments[1], tab };
	}

	if (channelSegments.length === 2 && (channelSegments[0] === 'c' || channelSegments[0] === 'user') && channelSegments[1]) {
		return { kind: 'legacy', value: `${channelSegments[0]}/${channelSegments[1]}`, tab };
	}

	return null;
}

function extractUrlMatch(text: string, regex: RegExp): string | null {
	const match = text.match(regex);
	return match ? match[1] : null;
}

export function isYouTubeUrl(url: string): boolean {
	return /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url);
}

export function extractVideoId(url: string): string | null {
	return extractUrlMatch(url, VIDEO_ID_REGEX);
}

export function classifyVideoContentType(url: string): Extract<ChannelContentType, 'videos' | 'shorts'> {
	const segments = parsePathSegments(url);
	return segments?.[0] === 'shorts' && extractVideoId(url) ? 'shorts' : 'videos';
}

export function extractPlaylistId(url: string): string | null {
	try {
		const playlistId = new URL(url).searchParams.get('list');
		if (playlistId) {
			return playlistId;
		}
	} catch {
		// Fall back to a query-fragment match for non-URL text.
	}

	return extractUrlMatch(url, /[?&]list=([a-zA-Z0-9_-]+)/);
}

export function isPlaylistUrl(url: string): boolean {
	return extractPlaylistId(url) !== null;
}

export function extractUnsupportedChannelTab(url: string): UnsupportedChannelTab | null {
	if (!isYouTubeUrl(url) || isPlaylistUrl(url)) {
		return null;
	}

	const segments = parsePathSegments(url);
	if (!segments) {
		return null;
	}
	const possibleTab = segments[segments.length - 1] as UnsupportedChannelTab;
	return UNSUPPORTED_CHANNEL_TABS.has(possibleTab)
		&& buildChannelRef(segments.slice(0, -1), 'home')
		? possibleTab
		: null;
}

export function extractChannelRef(url: string): ChannelRef | null {
	if (!isYouTubeUrl(url)) {
		return null;
	}

	const segments = parsePathSegments(url);
	if (!segments) {
		return null;
	}
	const possibleTab = segments[segments.length - 1];
	const contentTab = possibleTab === 'videos' || possibleTab === 'shorts' || possibleTab === 'streams'
		? possibleTab
		: null;
	const tab: ChannelUrlTab = contentTab ?? 'home';
	const hasGenericSuffix = GENERIC_CHANNEL_SUFFIXES.has(possibleTab);
	const channelSegments = contentTab || hasGenericSuffix ? segments.slice(0, -1) : segments;
	return buildChannelRef(channelSegments, tab);
}

export function isChannelUrl(url: string): boolean {
	return extractChannelRef(url) !== null;
}

function hasChannelPathPrefix(url: string): boolean {
	const segments = parsePathSegments(url);
	return Boolean(segments && (
		segments[0]?.startsWith('@')
		|| (segments.length >= 2 && ['channel', 'c', 'user'].includes(segments[0]))
	));
}

export function parseUrls(input: string): string[] {
	return input.trim().split(/[\s,]+/).filter(Boolean);
}

export function classifyUrls(urls: string[]): YouTubeUrlClassification[] {
	return urls.map((url) => {
		if (!isYouTubeUrl(url)) return 'invalid';
		if (isPlaylistUrl(url)) return 'playlist';
		if (isChannelUrl(url)) return 'channel';
		if (hasChannelPathPrefix(url)) return 'invalid';
		if (extractVideoId(url)) return 'video';
		return 'invalid';
	});
}
