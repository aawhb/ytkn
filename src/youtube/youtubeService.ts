import type {
	ChannelContentType,
	ChannelFetchOptions,
	ChannelResponse,
	PlaylistResponse,
	TranscriptFetchResult,
	TranscriptLanguageMode,
	TranscriptResponse,
} from '../types';
import { getErrorMessage } from '../utils';
import {
	requestCaptionLines,
	requestedTranscriptLanguage,
	selectCaptionTrack,
} from './captions';
import { buildTranscriptResponseFromPlayer } from './metadata';
import {
	requestChannelBrowse,
	requestChannelFeedBrowse,
	requestContinuation,
	requestOEmbedTitle,
	requestPlayer,
	requestPlaylistBrowse,
	requestResolveUrl,
	requestSupplementalVideoMetadata,
} from './innertube';
import { channelIdFromResolvePayload, channelTitleFromBrowsePayload } from './channelPayload';
import { collectPlaylistEntries, playlistTitleFromPayload } from './playlistPayload';
import {
	extractChannelRef,
	extractPlaylistId,
	extractVideoId,
} from './urls';

const CHANNEL_CONTENT_TYPES: readonly ChannelContentType[] = ['videos', 'shorts', 'streams'];
const TITLE_PREFLIGHT_TTL_MS = 30_000;
const CHANNEL_PLAYLIST_PREFIX: Record<ChannelContentType, string> = {
	videos: 'UULF',
	shorts: 'UUSH',
	streams: 'UULV',
};

interface ChannelMetadata {
	channelId: string;
	title: string;
}

interface ChannelMetadataFlight {
	channelId: Promise<string>;
	metadata: Promise<ChannelMetadata>;
	executionClaimed: boolean;
	cleanupTimer?: number;
}

interface PlaylistBrowseFlight {
	payload: Promise<unknown>;
	executionClaimed: boolean;
	cleanupTimer?: number;
}

export class YouTubeService {
	private channelMetadataFlights = new Map<string, ChannelMetadataFlight>();
	private playlistBrowseFlights = new Map<string, PlaylistBrowseFlight>();

	async fetchVideoTitle(videoId: string): Promise<string> {
		return requestOEmbedTitle(videoId);
	}

	async fetchPlaylistTitle(playlistId: string): Promise<string> {
		const flight = this.getPlaylistBrowseFlight(playlistId);
		try {
			const payload = await flight.payload;
			this.retainPlaylistTitlePreflight(playlistId, flight);
			return playlistTitleFromPayload(payload) ?? `Playlist ${playlistId}`;
		} catch (error) {
			this.evictPlaylistBrowseFlight(playlistId, flight);
			throw error;
		}
	}

	async fetchChannelTitle(url: string): Promise<string> {
		const flight = this.getChannelMetadataFlight(url);
		try {
			const metadata = await flight.metadata;
			this.retainChannelTitlePreflight(url, flight);
			return metadata.title;
		} catch (error) {
			this.evictChannelMetadataFlight(url, flight);
			throw new Error(`Failed to fetch channel: ${getErrorMessage(error)}`);
		}
	}

	async fetchVideoMetadata(url: string): Promise<TranscriptResponse> {
		try {
			const videoId = extractVideoId(url);
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
			const videoId = extractVideoId(url);
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
		const playlistId = extractPlaylistId(url);
		if (!playlistId) {
			throw new Error('Invalid YouTube playlist URL');
		}

		try {
			const payload = await this.claimPlaylistBrowseFlight(playlistId).payload;
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

	async fetchChannel(url: string, options: ChannelFetchOptions): Promise<ChannelResponse> {
		try {
			const contentTypes = CHANNEL_CONTENT_TYPES.filter((type) => options.contentTypes.includes(type));
			if (contentTypes.length === 0) {
				throw new Error('Select at least one channel content type');
			}

			const metadataFlight = this.claimChannelMetadataFlight(url);
			const channelId = await metadataFlight.channelId;
			const channelTail = channelId.slice(2);
			const [channelMetadata, ...entryGroups] = await Promise.all([
				metadataFlight.metadata,
				...contentTypes.map(async (contentType) => {
					const playlistId = `${CHANNEL_PLAYLIST_PREFIX[contentType]}${channelTail}`;
					const result = await requestChannelFeedBrowse(playlistId);
					if (result === null) {
						return { contentType, entries: [] };
					}
					const entries = await collectPlaylistEntries(
						result.payload,
						playlistId,
						requestContinuation,
						options.videoLimit,
						(entry) => entry.liveStatus === undefined,
					);
					return { contentType, entries };
				}),
			]);

			const entriesById = new Map<string, ChannelResponse['entries'][number]>();
			for (const group of entryGroups) {
				for (const entry of group.entries) {
					if (entriesById.has(entry.videoId)) {
						continue;
					}
					entriesById.set(entry.videoId, {
						...entry,
						url: `https://www.youtube.com/watch?v=${entry.videoId}`,
						position: entriesById.size + 1,
						contentType: group.contentType,
					});
				}
			}

			const entries = Array.from(entriesById.values());
			if (entries.length === 0) {
				throw new Error('No videos found for the selected channel content types');
			}

			return {
				url,
				channelId,
				title: channelMetadata.title,
				contentTypes,
				entries,
			};
		} catch (error) {
			throw new Error(`Failed to fetch channel: ${getErrorMessage(error)}`);
		}
	}

	private getPlaylistBrowseFlight(playlistId: string): PlaylistBrowseFlight {
		const current = this.playlistBrowseFlights.get(playlistId);
		if (current) {
			return current;
		}

		const flight: PlaylistBrowseFlight = {
			payload: requestPlaylistBrowse(playlistId),
			executionClaimed: false,
		};
		this.playlistBrowseFlights.set(playlistId, flight);
		void flight.payload.then(undefined, () => this.evictPlaylistBrowseFlight(playlistId, flight));
		return flight;
	}

	private claimPlaylistBrowseFlight(playlistId: string): PlaylistBrowseFlight {
		const flight = this.getPlaylistBrowseFlight(playlistId);
		flight.executionClaimed = true;
		if (flight.cleanupTimer !== undefined) {
			window.clearTimeout(flight.cleanupTimer);
			delete flight.cleanupTimer;
		}
		void flight.payload.then(
			() => this.evictPlaylistBrowseFlight(playlistId, flight),
			() => this.evictPlaylistBrowseFlight(playlistId, flight),
		);
		return flight;
	}

	private retainPlaylistTitlePreflight(playlistId: string, flight: PlaylistBrowseFlight): void {
		if (flight.executionClaimed || flight.cleanupTimer !== undefined) {
			return;
		}
		flight.cleanupTimer = window.setTimeout(
			() => this.evictPlaylistBrowseFlight(playlistId, flight),
			TITLE_PREFLIGHT_TTL_MS,
		);
	}

	private evictPlaylistBrowseFlight(playlistId: string, flight: PlaylistBrowseFlight): void {
		if (flight.cleanupTimer !== undefined) {
			window.clearTimeout(flight.cleanupTimer);
			delete flight.cleanupTimer;
		}
		if (this.playlistBrowseFlights.get(playlistId) === flight) {
			this.playlistBrowseFlights.delete(playlistId);
		}
	}

	private getChannelMetadataFlight(url: string): ChannelMetadataFlight {
		const current = this.channelMetadataFlights.get(url);
		if (current) {
			return current;
		}

		const channelId = this.resolveChannelId(url);
		const metadata = channelId.then(async (resolvedChannelId) => {
			const payload = await requestChannelBrowse(resolvedChannelId);
			return {
				channelId: resolvedChannelId,
				title: channelTitleFromBrowsePayload(payload) ?? `Channel ${resolvedChannelId}`,
			};
		});
		const flight: ChannelMetadataFlight = {
			channelId,
			metadata,
			executionClaimed: false,
		};
		this.channelMetadataFlights.set(url, flight);
		void metadata.then(undefined, () => this.evictChannelMetadataFlight(url, flight));

		return flight;
	}

	private claimChannelMetadataFlight(url: string): ChannelMetadataFlight {
		const flight = this.getChannelMetadataFlight(url);
		flight.executionClaimed = true;
		if (flight.cleanupTimer !== undefined) {
			window.clearTimeout(flight.cleanupTimer);
			delete flight.cleanupTimer;
		}
		void flight.metadata.then(
			() => this.evictChannelMetadataFlight(url, flight),
			() => this.evictChannelMetadataFlight(url, flight),
		);
		return flight;
	}

	private retainChannelTitlePreflight(url: string, flight: ChannelMetadataFlight): void {
		if (flight.executionClaimed || flight.cleanupTimer !== undefined) {
			return;
		}
		flight.cleanupTimer = window.setTimeout(
			() => this.evictChannelMetadataFlight(url, flight),
			TITLE_PREFLIGHT_TTL_MS,
		);
	}

	private evictChannelMetadataFlight(url: string, flight: ChannelMetadataFlight): void {
		if (flight.cleanupTimer !== undefined) {
			window.clearTimeout(flight.cleanupTimer);
			delete flight.cleanupTimer;
		}
		if (this.channelMetadataFlights.get(url) === flight) {
			this.channelMetadataFlights.delete(url);
		}
	}

	private async resolveChannelId(url: string): Promise<string> {
		const channelRef = extractChannelRef(url);
		if (!channelRef) {
			throw new Error('Invalid YouTube channel URL');
		}
		if (channelRef.kind === 'id') {
			return channelRef.value;
		}

		const resolveUrl = `https://www.youtube.com/${channelRef.value}`;
		const payload = await requestResolveUrl(resolveUrl);
		const channelId = channelIdFromResolvePayload(payload);
		if (!channelId) {
			throw new Error('Could not resolve YouTube channel ID');
		}
		return channelId;
	}
}
