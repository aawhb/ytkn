import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../../mocks/obsidian');
	return { ...mod };
});

import { generatePlaylistNotes } from '../../../src/generation/workflows/playlist';
import type { GenerationWorkflowContext } from '../../../src/generation/workflows/context';
import type { EffectiveGenerationOptions } from '../../../src/generation/effectiveOptions';
import type { NoteInsertionTarget, ProgressState } from '../../../src/generation/targets/noteTargets';
import type { PlaylistResponse, TranscriptResponse } from '../../../src/types';

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
		transcriptLanguageMode: 'auto',
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
		{ videoId: 'one', title: 'Video One', url: 'https://youtu.be/one', position: 1 },
		{ videoId: 'two', title: 'Video Two', url: 'https://youtu.be/two', position: 2 },
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

function makeTranscript(url: string): TranscriptResponse {
	const entry = playlist.entries.find((candidate) => candidate.url === url)!;
	return {
		url,
		videoId: entry.videoId,
		title: `${entry.title} transcript`,
		author: 'Channel',
		channelUrl: 'https://youtube.com/@channel',
		lines: [{ text: `${entry.title} transcript text.`, offset: 0 }],
	};
}

function makeContext(): GenerationWorkflowContext {
	return {
		youtubeService: {
			fetchPlaylist: vi.fn(async () => playlist),
			fetchTranscript: vi.fn(async (url: string) => ({ transcript: makeTranscript(url), languageCode: 'en' })),
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

	it('fetches combined transcripts, skips unavailable entries, and finalizes completed entries', async () => {
		const context = makeContext();
		vi.mocked(context.youtubeService.fetchTranscript).mockImplementation(async (url: string) => {
			if (url === playlist.entries[0].url) {
				throw new Error('Failed to fetch transcript: unavailable');
			}
			return { transcript: makeTranscript(url), languageCode: 'en' };
		});
		const progressState: ProgressState = { target: null, url: playlist.url, hasProgressContent: false };

		const result = await generatePlaylistNotes(
			context,
			playlist.url,
			null,
			makeOptions({ transcriptMode: 'readable' }),
			null,
			progressState,
			new AbortController().signal,
		);

		expect(result.entries.map((entry) => entry.outcome)).toEqual(['skipped', 'completed']);
		expect(result.entries[0].notePath).toBeUndefined();
		expect(result.entries[1].notePath).toBe(result.notePath);
		expect(context.targets.finalizeTargetNote).toHaveBeenCalledWith(
			expect.anything(),
			expect.stringContaining('Video Two transcript text.'),
			null,
			progressState,
		);
		expect(context.targets.deleteTargetIfDisposable).not.toHaveBeenCalled();
	});

	it('appends combined transcript fragments without writing progress markers', async () => {
		const context = makeContext();
		const target = makeTarget();
		const progressState: ProgressState = { target: null, url: playlist.url, hasProgressContent: false };

		const result = await generatePlaylistNotes(
			context,
			playlist.url,
			target,
			makeOptions({
				transcriptMode: 'readable',
				noteDestinationMode: 'append-to-active-note',
			}),
			null,
			progressState,
			new AbortController().signal,
		);

		expect(result.notePath).toBe(target.file.path);
		expect(context.targets.showProgress).not.toHaveBeenCalled();
		expect(context.targets.appendContentToTarget).toHaveBeenCalledWith(
			target,
			expect.stringContaining('## Workflow Playlist'),
		);
		expect(context.targets.finalizeTargetNote).not.toHaveBeenCalled();
		expect(target.finalized).toBe(true);
	});

	it('renames current-note combined output to the playlist title when enabled', async () => {
		const context = makeContext();
		const target = makeTarget();
		const progressState: ProgressState = { target: null, url: playlist.url, hasProgressContent: false };

		await generatePlaylistNotes(
			context,
			playlist.url,
			target,
			makeOptions({ noteDestinationMode: 'current-note' }),
			null,
			progressState,
			new AbortController().signal,
		);

		expect(context.targets.createFolderTarget).not.toHaveBeenCalled();
		expect(context.targets.finalizeTargetNote).toHaveBeenCalledWith(
			target,
			expect.any(String),
			playlist.title,
			progressState,
		);
	});

	it('cancels the remaining combined entries and deletes a disposable target', async () => {
		const context = makeContext();
		const controller = new AbortController();
		vi.mocked(context.youtubeService.fetchTranscript).mockImplementation(async () => {
			controller.abort();
			throw controller.signal.reason;
		});
		const progressState: ProgressState = { target: null, url: playlist.url, hasProgressContent: false };

		const result = await generatePlaylistNotes(
			context,
			playlist.url,
			null,
			makeOptions({ transcriptMode: 'readable' }),
			null,
			progressState,
			controller.signal,
		);

		expect(result.notePath).toBeNull();
		expect(result.entries.map((entry) => entry.outcome)).toEqual(['canceled', 'canceled']);
		expect(context.youtubeService.fetchTranscript).toHaveBeenCalledOnce();
		expect(context.targets.deleteTargetIfDisposable).toHaveBeenCalledWith(expect.objectContaining({ createdByPlugin: true }));
		expect(context.targets.finalizeTargetNote).not.toHaveBeenCalled();
	});

	it('stops combined processing when transcript failures are configured to fail', async () => {
		const context = makeContext();
		vi.mocked(context.youtubeService.fetchTranscript).mockRejectedValue(new Error('Failed to fetch transcript: unavailable'));

		await expect(generatePlaylistNotes(
			context,
			playlist.url,
			null,
			makeOptions({ transcriptMode: 'readable', transcriptFailureMode: 'fail' }),
			null,
			{ target: null, url: playlist.url, hasProgressContent: false },
			new AbortController().signal,
		)).rejects.toThrow('Failed to fetch transcript: unavailable');

		expect(context.youtubeService.fetchTranscript).toHaveBeenCalledOnce();
		expect(context.targets.finalizeTargetNote).not.toHaveBeenCalled();
	});
});
