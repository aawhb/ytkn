import type {
	PlaylistEntry,
	PlaylistRunReportEntry,
} from '../types';
import { isAbortError } from '../queue/progress';
import { getErrorMessage } from '../utils';
import type { EffectiveGenerationOptions } from './effectiveOptions';

export interface PlaylistOutcomeCounts {
	completed: number;
	skipped: number;
	failed: number;
	canceled: number;
}

export function buildPlaylistReportEntry(
	entry: { title: string; url: string; position: number },
	outcome: PlaylistRunReportEntry['outcome'],
	opts?: {
		title?: string;
		reason?: string;
		transcriptLanguageCode?: string;
		notePath?: string;
		warnings?: string[];
	},
): PlaylistRunReportEntry {
	return {
		title: opts?.title ?? entry.title,
		url: entry.url,
		position: entry.position,
		outcome,
		...(opts?.reason !== undefined ? { reason: opts.reason } : {}),
		...(opts?.transcriptLanguageCode !== undefined ? { transcriptLanguageCode: opts.transcriptLanguageCode } : {}),
		...(opts?.notePath !== undefined ? { notePath: opts.notePath } : {}),
		...(opts?.warnings !== undefined ? { warnings: opts.warnings } : {}),
	};
}

export function classifyPlaylistEntryError(
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

export function appendCanceledEntries(entries: PlaylistEntry[], reportEntries: PlaylistRunReportEntry[], startIndex: number): void {
	for (let index = startIndex; index < entries.length; index += 1) {
		const entry = entries[index];
		reportEntries.push({
			title: entry.title,
			url: entry.url,
			position: entry.position,
			outcome: 'canceled',
			reason: 'Generation canceled by user.',
		});
	}
}

export function countPlaylistOutcomes(entries: PlaylistRunReportEntry[]): PlaylistOutcomeCounts {
	const counts: PlaylistOutcomeCounts = {
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

export function playlistRunOutcome(entries: PlaylistRunReportEntry[]): PlaylistRunReportEntry['outcome'] {
	if (entries.some((entry) => entry.outcome === 'completed')) return 'completed';
	if (entries.some((entry) => entry.outcome === 'failed')) return 'failed';
	if (entries.some((entry) => entry.outcome === 'skipped')) return 'skipped';
	return 'canceled';
}
