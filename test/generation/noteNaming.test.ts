import { describe, expect, it } from 'vitest';
import {
	buildCombinedPlaylistBaseName,
	buildPerVideoBaseName,
	buildSingleVideoBaseName,
} from '../../src/generation/noteNaming';
import type { EffectiveGenerationOptions } from '../../src/generation/effectiveOptions';
import type { PlaylistResponse, TranscriptResponse } from '../../src/types';

function makeOptions(useVideoTitleAsNoteName: boolean): EffectiveGenerationOptions {
	return {
		useAi: false,
		generateAiSummary: false,
		instructionMode: 'template',
		instructionTemplate: 'general',
		manualInstructions: '',
		includeMindmap: false,
		includeMemorableQuotes: false,
		controlValues: {},
		transcriptMode: 'readable',
		playlistMode: 'combined',
		transcriptLanguageMode: 'default',
		preferredTranscriptLanguage: '',
		transcriptFailureMode: 'skip',
		mediaEmbedMode: 'thumbnail',
		includeRunReport: true,
		runReportLocation: 'generated-note',
		useVideoTitleAsNoteName,
		noteDestinationMode: 'folder',
		noteDestinationFolder: '',
		temperature: 0.3,
		requestTimeoutMs: 60000,
		includeFrontmatter: true,
		frontmatterTags: '',
		frontmatterPropertyAllowlist: '',
		sourceSectionPosition: 'top',
		linkTimestamps: false,
		tldrCalloutAtTop: false,
	};
}

const transcript: TranscriptResponse = {
	url: 'https://youtu.be/video',
	videoId: 'video',
	title: 'Bad / Title: One?',
	author: 'Channel',
	lines: [],
};

const playlist: PlaylistResponse = {
	url: 'https://youtube.com/playlist?list=PL123',
	playlistId: 'PL123',
	title: 'Playlist / Name',
	entries: [
		{ title: 'One', url: 'https://youtu.be/one', position: 1 },
		{ title: 'Two', url: 'https://youtu.be/two', position: 2 },
		{ title: 'Three', url: 'https://youtu.be/three', position: 3 },
	],
};

describe('generation note naming', () => {
	it('uses sanitized source titles when configured', () => {
		expect(buildSingleVideoBaseName(transcript, makeOptions(true))).toBe('Bad Title One');
		expect(buildCombinedPlaylistBaseName(playlist, makeOptions(true))).toBe('Playlist Name');
	});

	it('falls back to generic note names when source-title naming is disabled', () => {
		expect(buildSingleVideoBaseName(transcript, makeOptions(false))).toBe('Video Note');
		expect(buildCombinedPlaylistBaseName(playlist, makeOptions(false))).toBe('Playlist Note');
	});

	it('formats per-video playlist names from either video title or playlist title', () => {
		expect(buildPerVideoBaseName(playlist, transcript, 2, makeOptions(true))).toBe('Bad Title One');
		expect(buildPerVideoBaseName(playlist, transcript, 2, makeOptions(false))).toBe('Playlist Name 02');
	});
});
