import type {
	VideoCollectionEntry,
	CollectionItemResult,
	ChannelContentType,
} from '../types';
import { isAbortError } from '../queue/progress';
import { getErrorMessage } from '../utils';
import type { EffectiveGenerationOptions } from './effectiveOptions';

interface CollectionOutcomeCounts {
	completed: number;
	skipped: number;
	failed: number;
	canceled: number;
}

export function buildCollectionReportEntry(
	entry: { title: string; url: string; position: number; contentType?: ChannelContentType },
	outcome: CollectionItemResult['outcome'],
	opts?: {
		title?: string;
		reason?: string;
		transcriptLanguageCode?: string;
		notePath?: string;
		warnings?: string[];
	},
): CollectionItemResult {
	return {
		title: opts?.title ?? entry.title,
		url: entry.url,
		position: entry.position,
		...(entry.contentType !== undefined ? { contentType: entry.contentType } : {}),
		outcome,
		...(opts?.reason !== undefined ? { reason: opts.reason } : {}),
		...(opts?.transcriptLanguageCode !== undefined ? { transcriptLanguageCode: opts.transcriptLanguageCode } : {}),
		...(opts?.notePath !== undefined ? { notePath: opts.notePath } : {}),
		...(opts?.warnings !== undefined ? { warnings: opts.warnings } : {}),
	};
}

export function classifyCollectionEntryError(
	error: unknown,
	options: Pick<EffectiveGenerationOptions, 'transcriptFailureMode'>,
	signal: AbortSignal,
): { kind: 'cancel' | 'transcript-skip' | 'transcript-fail' | 'other'; message: string } {
	const message = getErrorMessage(error);
	if (isAbortError(error, signal)) {
		return { kind: 'cancel', message: 'Generation canceled by user.' };
	}
	const isTranscriptFailure = message.includes('Failed to fetch transcript');
	if (isTranscriptFailure) {
		return {
			kind: options.transcriptFailureMode === 'fail' ? 'transcript-fail' : 'transcript-skip',
			message,
		};
	}
	return { kind: 'other', message };
}

export function appendCanceledEntries(
	entries: Array<VideoCollectionEntry & { contentType?: ChannelContentType }>,
	reportEntries: CollectionItemResult[],
	startIndex: number,
): void {
	for (let index = startIndex; index < entries.length; index += 1) {
		const entry = entries[index];
		reportEntries.push({
			title: entry.title,
			url: entry.url,
			position: entry.position,
			...(entry.contentType !== undefined ? { contentType: entry.contentType } : {}),
			outcome: 'canceled',
			reason: 'Generation canceled by user.',
		});
	}
}

export function countCollectionOutcomes(entries: CollectionItemResult[]): CollectionOutcomeCounts {
	const counts: CollectionOutcomeCounts = {
		completed: 0,
		skipped: 0,
		failed: 0,
		canceled: 0,
	};
	for (const entry of entries) {
		counts[entry.outcome] += 1;
	}
	return counts;
}

export function collectionRunOutcome(entries: CollectionItemResult[]): CollectionItemResult['outcome'] {
	if (entries.some((entry) => entry.outcome === 'completed')) return 'completed';
	if (entries.some((entry) => entry.outcome === 'failed')) return 'failed';
	if (entries.some((entry) => entry.outcome === 'skipped')) return 'skipped';
	return 'canceled';
}
