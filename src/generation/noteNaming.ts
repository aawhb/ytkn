import type { PlaylistResponse, TranscriptResponse } from '../types';
import { formatSequenceName } from '../utils';
import { buildSafeBaseName } from './targets/noteTargets';
import type { EffectiveGenerationOptions } from './effectiveOptions';

export function buildSingleVideoBaseName(transcript: TranscriptResponse, options: EffectiveGenerationOptions): string {
	if (options.useVideoTitleAsNoteName) {
		return buildSafeBaseName(transcript.title, 'Video Note');
	}
	return 'Video Note';
}

export function buildCombinedPlaylistBaseName(playlist: PlaylistResponse, options: EffectiveGenerationOptions): string {
	if (options.useVideoTitleAsNoteName) {
		return buildSafeBaseName(playlist.title, 'Playlist Note');
	}
	return 'Playlist Note';
}

export function buildPerVideoBaseName(
	playlist: PlaylistResponse,
	transcript: TranscriptResponse,
	index: number,
	options: EffectiveGenerationOptions,
): string {
	if (options.useVideoTitleAsNoteName) {
		return buildSafeBaseName(transcript.title, formatSequenceName('Playlist Video', index, playlist.entries.length));
	}
	const prefix = buildSafeBaseName(playlist.title, 'Playlist Video');
	return formatSequenceName(prefix, index, playlist.entries.length);
}
