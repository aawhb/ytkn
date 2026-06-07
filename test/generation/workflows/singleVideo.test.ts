import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../../mocks/obsidian');
	return { ...mod };
});

import { INSERT_AT_CARET_REQUIRES_NOTE } from '../../../src/generation/constants';
import { generateSingleVideoNote, generateSingleVideoToTarget } from '../../../src/generation/workflows/singleVideo';
import type { GenerationWorkflowContext } from '../../../src/generation/workflows/context';
import type { EffectiveGenerationOptions } from '../../../src/generation/effectiveOptions';
import type { NoteInsertionTarget, ProgressState } from '../../../src/generation/targets/noteTargets';
import type { TranscriptResponse } from '../../../src/types';

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
		transcriptMode: 'readable',
		playlistMode: 'combined',
		transcriptLanguageMode: 'default',
		preferredTranscriptLanguage: '',
		transcriptFailureMode: 'skip',
		mediaEmbedMode: 'thumbnail',
		includeRunReport: true,
		runReportLocation: 'generated-note',
		useVideoTitleAsNoteName: true,
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
		...overrides,
	};
}

const transcript: TranscriptResponse = {
	url: 'https://youtu.be/video1234567',
	videoId: 'video1234567',
	title: 'Workflow Video',
	author: 'Channel',
	lines: [{ text: 'Transcript line.', offset: 0 }],
};

function makeTarget(): NoteInsertionTarget {
	return {
		file: { path: 'Notes/Workflow Video.md' } as any,
		fromOffset: 0,
		toOffset: 0,
		jobId: 'job',
		createdByPlugin: false,
		finalized: false,
	};
}

function makeContext(): GenerationWorkflowContext {
	return {
		youtubeService: {
			fetchVideoMetadata: vi.fn(async () => transcript),
			fetchTranscript: vi.fn(async () => ({ transcript, languageCode: 'en' })),
		} as any,
		targets: {
			showProgress: vi.fn(async () => undefined),
			createFolderTarget: vi.fn(async () => makeTarget()),
			appendContentToTarget: vi.fn(async () => undefined),
			finalizeTargetNote: vi.fn(async () => undefined),
			deleteTargetIfDisposable: vi.fn(async () => undefined),
			upsertProgressContent: vi.fn(async () => undefined),
		} as any,
		onStatusBar: vi.fn(),
	};
}

describe('single video workflow', () => {
	it('renders append-mode content without progress markers in the active note', async () => {
		const context = makeContext();
		const target = makeTarget();
		const progressState: ProgressState = { target: null, url: transcript.url, hasProgressContent: false };

		const warnings = await generateSingleVideoToTarget(
			context,
			transcript.url,
			target,
			transcript,
			makeOptions({ noteDestinationMode: 'append-to-active-note' }),
			null,
			progressState,
			null,
			new AbortController().signal,
		);

		expect(warnings).toEqual([]);
		expect(context.targets.appendContentToTarget).toHaveBeenCalledWith(target, expect.stringContaining('# Workflow Video'));
		expect(context.targets.finalizeTargetNote).not.toHaveBeenCalled();
		expect(target.finalized).toBe(true);
		expect(progressState.hasProgressContent).toBe(false);
	});

	it('requires an initial target for current-note runs', async () => {
		await expect(generateSingleVideoNote(
			makeContext(),
			transcript.url,
			null,
			makeOptions({ noteDestinationMode: 'current-note' }),
			null,
			{ target: null, url: transcript.url, hasProgressContent: false },
			new AbortController().signal,
		)).rejects.toThrow(INSERT_AT_CARET_REQUIRES_NOTE);
	});
});
