import type { TranscriptResponse, VideoCollectionResponse } from '../types';
import { formatSequenceName } from '../utils';
import { buildSafeBaseName } from './targets/noteTargets';
import type { EffectiveGenerationOptions } from './effectiveOptions';

export function buildSingleVideoBaseName(transcript: TranscriptResponse, options: EffectiveGenerationOptions): string {
	if (options.useVideoTitleAsNoteName) {
		return buildSafeBaseName(transcript.title, 'Video Note');
	}
	return 'Video Note';
}

export function buildCombinedPlaylistBaseName(playlist: VideoCollectionResponse, options: EffectiveGenerationOptions): string {
	if (options.useVideoTitleAsNoteName) {
		return buildSafeBaseName(playlist.title, 'channelId' in playlist ? 'Channel Note' : 'Playlist Note');
	}
	return 'channelId' in playlist ? 'Channel Note' : 'Playlist Note';
}

export function buildPerVideoBaseName(
	playlist: VideoCollectionResponse,
	transcript: TranscriptResponse,
	index: number,
	options: EffectiveGenerationOptions,
): string {
	const fallbackPrefix = 'channelId' in playlist ? 'Channel Video' : 'Playlist Video';
	if (options.useVideoTitleAsNoteName) {
		return buildSafeBaseName(transcript.title, formatSequenceName(fallbackPrefix, index, playlist.entries.length));
	}
	const prefix = buildSafeBaseName(playlist.title, fallbackPrefix);
	return formatSequenceName(prefix, index, playlist.entries.length);
}
