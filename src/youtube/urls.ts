import { VIDEO_ID_REGEX } from '../defaults';

export type YouTubeUrlClassification = 'video' | 'playlist' | 'invalid';

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

export function parseUrls(input: string): string[] {
	return input.trim().split(/[\s,]+/).filter(Boolean);
}

export function classifyUrls(urls: string[]): YouTubeUrlClassification[] {
	return urls.map((url) => {
		if (!isYouTubeUrl(url)) return 'invalid';
		if (isPlaylistUrl(url)) return 'playlist';
		return 'video';
	});
}
