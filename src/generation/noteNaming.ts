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

export function buildCombinedCollectionBaseName(collection: VideoCollectionResponse, options: EffectiveGenerationOptions): string {
	if (options.useVideoTitleAsNoteName) {
		return buildSafeBaseName(collection.title, 'channelId' in collection ? 'Channel Note' : 'Playlist Note');
	}
	return 'channelId' in collection ? 'Channel Note' : 'Playlist Note';
}

export function buildPerVideoBaseName(
	collection: VideoCollectionResponse,
	transcript: TranscriptResponse,
	index: number,
	options: EffectiveGenerationOptions,
): string {
	const fallbackPrefix = 'channelId' in collection ? 'Channel Video' : 'Playlist Video';
	if (options.useVideoTitleAsNoteName) {
		return buildSafeBaseName(transcript.title, formatSequenceName(fallbackPrefix, index, collection.entries.length));
	}
	const prefix = buildSafeBaseName(collection.title, fallbackPrefix);
	return formatSequenceName(prefix, index, collection.entries.length);
}
