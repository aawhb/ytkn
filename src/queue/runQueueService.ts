import type { GenerationOptions, QueueBatchReport, QueueRunOutcome, QueueRunReportEntry, RunReportLocation } from '../types';
import { createJobId, getErrorMessage } from '../utils';
import { isAbortError } from './progress';

type QueuedRunKind = 'video' | 'playlist';

export interface QueuedRunInsertionTargetRef {
	filePath: string;
	mode: 'replace-range' | 'append-end';
	fromOffset?: number;
	toOffset?: number;
	createdByPlugin: boolean;
}

export interface QueuedRun {
	id: string;
	ordinal: number;
	batchId: string;
	url: string;
	kind: QueuedRunKind;
	displayTitle: string;
	options: GenerationOptions;
	initialTargetRef: QueuedRunInsertionTargetRef | null;
}

export interface BatchTargetPolicy {
	kind: 'editor-append-sequential' | 'editor-replace-range-first' | 'folder';
	resolve(runIndex: number): QueuedRunInsertionTargetRef | null;
}

interface RunBatchReportPolicy {
	include: boolean;
	location: RunReportLocation;
}

export interface RunBatch {
	batchId: string;
	reportPolicy: RunBatchReportPolicy;
	runIds: string[];
	outcomeEntries: QueueRunReportEntry[];
	finalized: boolean;
}

interface BatchUrlInput {
	url: string;
	kind: QueuedRunKind;
}

export interface BatchEnqueueInput {
	urls: BatchUrlInput[];
	options: GenerationOptions;
	targetPolicy: BatchTargetPolicy;
	reportPolicy: RunBatchReportPolicy;
}

export type RunQueueEvent =
	| { type: 'enqueued'; run: QueuedRun }
	| { type: 'started'; run: QueuedRun }
	| { type: 'title-resolved'; run: QueuedRun }
	| { type: 'finished'; run: QueuedRun }
	| { type: 'removed'; runId: string }
	| { type: 'cleared' };

export type RunQueueListener = (event: RunQueueEvent) => void;

export interface RunWorker {
	executeRun(run: QueuedRun, signal: AbortSignal): Promise<QueueRunReportEntry>;
	resolveTitle(run: QueuedRun, signal: AbortSignal): Promise<string>;
	persistBatchReport(batch: RunBatch, report: QueueBatchReport): Promise<void>;
	/** Fires once per batch on every termination path, even when report persistence is disabled. */
	onBatchFinalized?(batch: RunBatch): void;
}

let _ordinalCounter = 0;

function nextOrdinal(): number {
	return ++_ordinalCounter;
}

function buildUrlFallbackTitle(run: QueuedRun): string {
	return `#${run.ordinal} · ${run.kind}:${run.url.split('/').pop() ?? run.url}`;
}

function buildCanceledEntry(run: QueuedRun): QueueRunReportEntry {
	if (run.kind === 'playlist') {
		return {
			kind: 'playlist',
			runId: run.id,
			batchId: run.batchId,
			ordinal: run.ordinal,
			url: run.url,
			displayTitle: run.displayTitle,
			playlistTitle: run.displayTitle,
			playlistUrl: run.url,
			outcome: 'canceled',
			entries: [],
		};
	}
	return {
		kind: 'video',
		runId: run.id,
		batchId: run.batchId,
		ordinal: run.ordinal,
		url: run.url,
		displayTitle: run.displayTitle,
		outcome: 'canceled',
		reason: 'Removed from queue.',
	};
}

function buildErrorEntry(run: QueuedRun, error: unknown, signal: AbortSignal): QueueRunReportEntry {
	const outcome: QueueRunOutcome = isAbortError(error, signal) ? 'canceled' : 'failed';
	const reason = getErrorMessage(error);
	if (run.kind === 'playlist') {
		return {
			kind: 'playlist',
			runId: run.id,
			batchId: run.batchId,
			ordinal: run.ordinal,
			url: run.url,
			displayTitle: run.displayTitle,
			playlistTitle: run.displayTitle,
			playlistUrl: run.url,
			outcome,
			reason,
			entries: [],
		};
	}
	return {
		kind: 'video',
		runId: run.id,
		batchId: run.batchId,
		ordinal: run.ordinal,
		url: run.url,
		displayTitle: run.displayTitle,
		outcome,
		reason,
	};
}

export class RunQueueService {
	private readonly queue: QueuedRun[] = [];
	private readonly batches = new Map<string, RunBatch>();
	private readonly history: QueueRunReportEntry[] = [];
	private readonly listeners = new Set<RunQueueListener>();
	private current: { run: QueuedRun; controller: AbortController } | null = null;
	private workerActive = false;

	constructor(private readonly worker: RunWorker) { }

	on(listener: RunQueueListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private emit(event: RunQueueEvent): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}

	getSnapshot(): {
		current: QueuedRun | null;
		queued: QueuedRun[];
		history: QueueRunReportEntry[];
	} {
		return {
			current: this.current?.run ?? null,
			queued: this.queue.slice(this.current ? 1 : 0),
			history: this.history.slice(),
		};
	}

	enqueueBatch(input: BatchEnqueueInput): RunBatch {
		const batchId = createJobId();
		const batch: RunBatch = {
			batchId,
			reportPolicy: input.reportPolicy,
			runIds: [],
			outcomeEntries: [],
			finalized: false,
		};
		this.batches.set(batchId, batch);

		for (let i = 0; i < input.urls.length; i++) {
			const { url, kind } = input.urls[i];
			const id = createJobId();
			const ordinal = nextOrdinal();
			const run: QueuedRun = {
				id,
				ordinal,
				batchId,
				url,
				kind,
				displayTitle: '',
				options: structuredClone(input.options),
				initialTargetRef: input.targetPolicy.resolve(i),
			};
			run.displayTitle = buildUrlFallbackTitle(run);
			batch.runIds.push(id);
			this.queue.push(run);
			this.emit({ type: 'enqueued', run });
			this.startTitleResolution(run);
		}

		this.kickWorker();
		return batch;
	}

	private startTitleResolution(run: QueuedRun): void {
		const signal = AbortSignal.timeout(8000);
		Promise.resolve()
			.then(async () => {
				if (signal.aborted) return;
				const title = await this.worker.resolveTitle(run, signal);
				if (signal.aborted) return;
				run.displayTitle = `#${run.ordinal} · ${title}`;
				this.emit({ type: 'title-resolved', run });
			})
			.catch(() => {
				// Keep the URL fallback when title resolution fails.
			});
	}

	cancelRun(runId: string): void {
		if (this.current?.run.id === runId) {
			this.current.controller.abort(new Error('Generation canceled by user.'));
			return;
		}
		const idx = this.queue.findIndex((r) => r.id === runId);
		if (idx < 0) return;
		const [removed] = this.queue.splice(idx, 1);
		const entry = buildCanceledEntry(removed);
		this.pushHistory(entry);
		const batch = this.batches.get(removed.batchId);
		if (batch) {
			batch.outcomeEntries.push(entry);
			if (this.allRunsTerminal(batch)) {
				void this.finalizeBatch(batch);
			}
		}
		this.emit({ type: 'removed', runId });
	}

	cancelAll(): void {
		const toCancel = this.current
			? this.queue.slice(1)
			: this.queue.slice();

		for (const run of toCancel) {
			const entry = buildCanceledEntry(run);
			this.pushHistory(entry);
			const batch = this.batches.get(run.batchId);
			if (batch) {
				batch.outcomeEntries.push(entry);
			}
		}

		this.queue.splice(this.current ? 1 : 0);

		if (this.current) {
			this.current.controller.abort(new Error('Generation canceled by user.'));
		}

		// Finalize terminal batches while the current run is pending.
		for (const batch of this.batches.values()) {
			if (!batch.finalized && this.allRunsTerminal(batch)) {
				void this.finalizeBatch(batch);
			}
		}

		this.emit({ type: 'cleared' });
	}

	private kickWorker(): void {
		if (this.workerActive) return;
		this.workerActive = true;
		queueMicrotask(() => void this.workerLoop());
	}

	private async workerLoop(): Promise<void> {
		try {
			while (this.queue.length > 0) {
				const run = this.queue[0];
				const controller = new AbortController();
				this.current = { run, controller };
				this.emit({ type: 'started', run });

				let entry: QueueRunReportEntry;
				try {
					entry = await this.worker.executeRun(run, controller.signal);
				} catch (error) {
					entry = buildErrorEntry(run, error, controller.signal);
				}

				this.queue.shift();
				this.current = null;

				this.pushHistory(entry);
				const batch = this.batches.get(run.batchId);
				if (batch) {
					batch.outcomeEntries.push(entry);
					if (this.allRunsTerminal(batch)) {
						await this.finalizeBatch(batch);
					}
				}

				this.emit({ type: 'finished', run });
			}
		} finally {
			this.workerActive = false;
		}
	}

	private allRunsTerminal(batch: RunBatch): boolean {
		return batch.runIds.every((id) => {
			if (this.current?.run.id === id) return false;
			const inQueue = this.queue.some((r) => r.id === id);
			return !inQueue;
		});
	}

	private async finalizeBatch(batch: RunBatch): Promise<void> {
		if (batch.finalized) return;
		batch.finalized = true;
		this.worker.onBatchFinalized?.(batch);
		const report: QueueBatchReport = { batchId: batch.batchId, entries: batch.outcomeEntries };
		if (batch.reportPolicy.include) {
			await this.worker.persistBatchReport(batch, report);
		}
	}

	private pushHistory(entry: QueueRunReportEntry): void {
		this.history.push(entry);
		if (this.history.length > 50) {
			this.history.shift();
		}
	}
}

export function buildFolderTargetPolicy(): BatchTargetPolicy {
	return {
		kind: 'folder',
		resolve: () => null,
	};
}

export function buildEditorAppendSequentialPolicy(filePath: string): BatchTargetPolicy {
	return {
		kind: 'editor-append-sequential',
		resolve: (): QueuedRunInsertionTargetRef => ({
			filePath,
			mode: 'append-end',
			createdByPlugin: false,
		}),
	};
}

export function buildEditorReplaceRangeFirstPolicy(
	ref: QueuedRunInsertionTargetRef,
): BatchTargetPolicy {
	return {
		kind: 'editor-replace-range-first',
		resolve: (runIndex: number) => (runIndex === 0 ? ref : null),
	};
}
