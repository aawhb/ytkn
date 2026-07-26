import { describe, expect, it } from 'vitest';
import {
	appendCanceledEntries,
	buildCollectionReportEntry,
	classifyCollectionEntryError,
	countCollectionOutcomes,
	collectionRunOutcome,
} from '../../src/generation/reportEntries';
import type { ChannelResponse, PlaylistEntry, CollectionItemResult } from '../../src/types';

const entries: PlaylistEntry[] = [
	{ videoId: 'one', title: 'One', url: 'https://youtu.be/one', position: 1 },
	{ videoId: 'two', title: 'Two', url: 'https://youtu.be/two', position: 2 },
	{ videoId: 'three', title: 'Three', url: 'https://youtu.be/three', position: 3 },
];

describe('collection report entries', () => {
	it('builds entries with optional run details only when provided', () => {
		expect(buildCollectionReportEntry(entries[0], 'completed', {
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

	it('preserves channel content types in report entries', () => {
		const short: ChannelResponse['entries'][number] = {
			...entries[0],
			contentType: 'shorts',
		};

		expect(buildCollectionReportEntry(short, 'completed')).toMatchObject({
			title: 'One',
			contentType: 'shorts',
		});
	});

	it('classifies transcript failures according to the run failure mode', () => {
		const signal = new AbortController().signal;
		expect(classifyCollectionEntryError(new Error('Failed to fetch transcript: missing'), { transcriptFailureMode: 'skip' }, signal).kind)
			.toBe('transcript-skip');
		expect(classifyCollectionEntryError(new Error('Failed to fetch transcript: missing'), { transcriptFailureMode: 'fail' }, signal).kind)
			.toBe('transcript-fail');
		expect(classifyCollectionEntryError(new Error('Network timeout'), { transcriptFailureMode: 'skip' }, signal).kind)
			.toBe('other');
	});

	it('classifies aborts as user cancellations', () => {
		const controller = new AbortController();
		controller.abort(new Error('stopped'));

		expect(classifyCollectionEntryError(controller.signal.reason, { transcriptFailureMode: 'skip' }, controller.signal))
			.toEqual({ kind: 'cancel', message: 'Generation canceled by user.' });
	});

	it('appends canceled entries and derives counts/outcome', () => {
		const reportEntries: CollectionItemResult[] = [
			buildCollectionReportEntry(entries[0], 'completed'),
		];

		appendCanceledEntries(entries, reportEntries, 1);

		expect(reportEntries.map((entry) => entry.outcome)).toEqual(['completed', 'canceled', 'canceled']);
		expect(countCollectionOutcomes(reportEntries)).toEqual({
			completed: 1,
			skipped: 0,
			failed: 0,
			canceled: 2,
		});
		expect(collectionRunOutcome(reportEntries)).toBe('completed');
	});

	it('uses failed, skipped, then canceled as fallback collection outcomes', () => {
		expect(collectionRunOutcome([buildCollectionReportEntry(entries[0], 'failed')])).toBe('failed');
		expect(collectionRunOutcome([buildCollectionReportEntry(entries[0], 'skipped')])).toBe('skipped');
		expect(collectionRunOutcome([buildCollectionReportEntry(entries[0], 'canceled')])).toBe('canceled');
	});
});
