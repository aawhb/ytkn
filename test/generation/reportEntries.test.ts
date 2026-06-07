import { describe, expect, it } from 'vitest';
import {
	appendCanceledEntries,
	buildPlaylistReportEntry,
	classifyPlaylistEntryError,
	countPlaylistOutcomes,
	playlistRunOutcome,
} from '../../src/generation/reportEntries';
import type { PlaylistEntry, PlaylistRunReportEntry } from '../../src/types';

const entries: PlaylistEntry[] = [
	{ title: 'One', url: 'https://youtu.be/one', position: 1 },
	{ title: 'Two', url: 'https://youtu.be/two', position: 2 },
	{ title: 'Three', url: 'https://youtu.be/three', position: 3 },
];

describe('playlist report entries', () => {
	it('builds entries with optional run details only when provided', () => {
		expect(buildPlaylistReportEntry(entries[0], 'completed', {
			title: 'Fetched title',
			transcriptLanguageCode: 'en',
			notePath: 'Notes/Fetched.md',
		})).toEqual({
			title: 'Fetched title',
			url: entries[0].url,
			position: 1,
			outcome: 'completed',
			transcriptLanguageCode: 'en',
			notePath: 'Notes/Fetched.md',
		});
	});

	it('classifies transcript failures according to the run failure mode', () => {
		const signal = new AbortController().signal;
		expect(classifyPlaylistEntryError(new Error('Failed to fetch transcript: missing'), { transcriptFailureMode: 'skip' }, signal).kind)
			.toBe('transcript-skip');
		expect(classifyPlaylistEntryError(new Error('Failed to fetch transcript: missing'), { transcriptFailureMode: 'fail' }, signal).kind)
			.toBe('transcript-fail');
		expect(classifyPlaylistEntryError(new Error('Network timeout'), { transcriptFailureMode: 'skip' }, signal).kind)
			.toBe('other');
	});

	it('classifies aborts as user cancellations', () => {
		const controller = new AbortController();
		controller.abort(new Error('stopped'));

		expect(classifyPlaylistEntryError(controller.signal.reason, { transcriptFailureMode: 'skip' }, controller.signal))
			.toEqual({ kind: 'cancel', message: 'Generation canceled by user.' });
	});

	it('appends canceled entries and derives counts/outcome', () => {
		const reportEntries: PlaylistRunReportEntry[] = [
			buildPlaylistReportEntry(entries[0], 'completed'),
		];

		appendCanceledEntries(entries, reportEntries, 1);

		expect(reportEntries.map((entry) => entry.outcome)).toEqual(['completed', 'canceled', 'canceled']);
		expect(countPlaylistOutcomes(reportEntries)).toEqual({
			completed: 1,
			skipped: 0,
			failed: 0,
			canceled: 2,
		});
		expect(playlistRunOutcome(reportEntries)).toBe('completed');
	});

	it('uses failed, skipped, then canceled as fallback playlist outcomes', () => {
		expect(playlistRunOutcome([buildPlaylistReportEntry(entries[0], 'failed')])).toBe('failed');
		expect(playlistRunOutcome([buildPlaylistReportEntry(entries[0], 'skipped')])).toBe('skipped');
		expect(playlistRunOutcome([buildPlaylistReportEntry(entries[0], 'canceled')])).toBe('canceled');
	});
});
