import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../../mocks/obsidian');
	return { ...mod };
});

import { generatePlaylistNotes } from '../../../src/generation/workflows/playlist';
import type { GenerationWorkflowContext } from '../../../src/generation/workflows/context';
import type { EffectiveGenerationOptions } from '../../../src/generation/effectiveOptions';
import type { NoteInsertionTarget, ProgressState } from '../../../src/generation/targets/noteTargets';
import type { PlaylistResponse } from '../../../src/types';

function makeOptions(overrides: Partial<EffectiveGenerationOptions> = {}): EffectiveGenerationOptions {
	return {
		useAi: false,
		generateAiSummary: false,
		instructionMode: 'template',
		instructionTemplate: 'general',
		manualInstructions: '',
		includeMindmap: false,
		includeMemorableQuotes: false,
		controlValues: {},
		transcriptMode: 'none',
		playlistMode: 'combined',
		transcriptLanguageMode: 'default',
		preferredTranscriptLanguage: '',
		transcriptFailureMode: 'skip',
		mediaEmbedMode: 'thumbnail',
		includeRunReport: true,
		runReportLocation: 'generated-note',
		useVideoTitleAsNoteName: true,
		noteDestinationMode: 'folder',
		noteDestinationFolder: 'Notes',
		temperature: 0.3,
		requestTimeoutMs: 60000,
		includeFrontmatter: true,
		frontmatterTags: '',
		frontmatterPropertyAllowlist: '',
		sourceSectionPosition: 'top',
		linkTimestamps: false,
		tldrCalloutAtTop: false,
		...overrides,
	};
}

const playlist: PlaylistResponse = {
	url: 'https://youtube.com/playlist?list=PL123',
	playlistId: 'PL123',
	title: 'Workflow Playlist',
	entries: [
		{ title: 'Video One', url: 'https://youtu.be/one', position: 1 },
		{ title: 'Video Two', url: 'https://youtu.be/two', position: 2 },
	],
};

function makeTarget(): NoteInsertionTarget {
	return {
		file: { path: 'Notes/Workflow Playlist.md' } as any,
		fromOffset: 0,
		toOffset: 0,
		jobId: 'job',
		createdByPlugin: true,
		finalized: false,
	};
}

function makeContext(): GenerationWorkflowContext {
	return {
		youtubeService: {
			fetchPlaylist: vi.fn(async () => playlist),
			fetchTranscript: vi.fn(),
			fetchVideoMetadata: vi.fn(),
		} as any,
		targets: {
			ensureFolderExists: vi.fn(async () => undefined),
			createFolderTarget: vi.fn(async () => makeTarget()),
			showProgress: vi.fn(async () => undefined),
			finalizeTargetNote: vi.fn(async (target: NoteInsertionTarget) => { target.finalized = true; }),
			appendContentToTarget: vi.fn(async () => undefined),
			deleteTargetIfDisposable: vi.fn(async () => undefined),
		} as any,
		onStatusBar: vi.fn(),
	};
}

describe('playlist workflow', () => {
	it('renders combined metadata-only playlists without fetching per-video data', async () => {
		const context = makeContext();
		const progressState: ProgressState = { target: null, url: playlist.url, hasProgressContent: false };

		const result = await generatePlaylistNotes(
			context,
			playlist.url,
			null,
			makeOptions(),
			null,
			progressState,
			new AbortController().signal,
		);

		expect(result.playlist).toBe(playlist);
		expect(result.notePath).toBe('Notes/Workflow Playlist.md');
		expect(result.entries.map((entry) => entry.outcome)).toEqual(['completed', 'completed']);
		expect(context.youtubeService.fetchPlaylist).toHaveBeenCalledWith(playlist.url);
		expect(context.youtubeService.fetchTranscript).not.toHaveBeenCalled();
		expect(context.youtubeService.fetchVideoMetadata).not.toHaveBeenCalled();
		expect(context.targets.ensureFolderExists).toHaveBeenCalledWith('Notes');
		expect(context.targets.finalizeTargetNote).toHaveBeenCalledWith(
			expect.objectContaining({ file: expect.objectContaining({ path: 'Notes/Workflow Playlist.md' }) }),
			expect.stringContaining('# Workflow Playlist'),
			null,
			progressState,
		);
	});
});
