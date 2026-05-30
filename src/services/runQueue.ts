import { GenerationOptions, QueueBatchReport, QueueRunOutcome, QueueRunReportEntry, RunReportLocation } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueuedRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';
export type QueuedRunKind = 'video' | 'playlist' | 'unknown';

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
	titleResolved: boolean;
	options: GenerationOptions;
	initialTargetRef: QueuedRunInsertionTargetRef | null;
	status: QueuedRunStatus;
	enqueuedAt: number;
	startedAt?: number;
	finishedAt?: number;
	statusMessage?: string;
	reportEntry?: QueueRunReportEntry;
}

export interface BatchTargetPolicy {
	kind: 'editor-append-sequential' | 'editor-replace-range-first' | 'folder';
	resolve(runIndex: number): QueuedRunInsertionTargetRef | null;
}

export interface RunBatchReportPolicy {
	include: boolean;
	location: RunReportLocation;
}

export interface RunBatch {
	batchId: string;
	enqueuedAt: number;
	reportPolicy: RunBatchReportPolicy;
	targetPolicy: BatchTargetPolicy;
	runIds: string[];
	outcomeEntries: QueueRunReportEntry[];
	finalized: boolean;
}

export interface BatchUrlInput {
	url: string;
	kind: QueuedRunKind;
	provisionalTitle?: string;
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
	| { type: 'status'; run: QueuedRun }
	| { type: 'title-resolved'; run: QueuedRun }
	| { type: 'finished'; run: QueuedRun }
	| { type: 'batch-finished'; batch: RunBatch }
	| { type: 'removed'; runId: string }
	| { type: 'cleared' };

export type RunQueueListener = (event: RunQueueEvent) => void;

export interface RunWorker {
	executeRun(run: QueuedRun, signal: AbortSignal): Promise<QueueRunReportEntry>;
	resolveTitle(run: QueuedRun, signal: AbortSignal): Promise<string>;
	persistBatchReport(batch: RunBatch, report: QueueBatchReport): Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _ordinalCounter = 0;

function nextOrdinal(): number {
	return ++_ordinalCounter;
}

function generateId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildUrlFallbackTitle(run: QueuedRun): string {
	return `#${run.ordinal} · ${run.kind}:${run.url.split('/').pop() ?? run.url}`;
}

function isAbortLike(error: unknown, signal: AbortSignal): boolean {
	if (signal.aborted) return true;
	if (error instanceof DOMException && error.name === 'AbortError') return true;
	if (error instanceof Error && error.message.includes('aborted')) return true;
	return false;
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
	const outcome: QueueRunOutcome = isAbortLike(error, signal) ? 'canceled' : 'failed';
	const reason = error instanceof Error ? error.message : String(error);
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

// ─── RunQueueService ──────────────────────────────────────────────────────────

export class RunQueueService {
	private readonly queue: QueuedRun[] = [];
	private readonly batches = new Map<string, RunBatch>();
	private readonly history: QueueRunReportEntry[] = [];
	private readonly listeners = new Set<RunQueueListener>();
	private current: { run: QueuedRun; controller: AbortController } | null = null;
	private workerActive = false;

	constructor(private readonly worker: RunWorker) {}

	// ── Subscriptions ──────────────────────────────────────────────────────────

	on(listener: RunQueueListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private emit(event: RunQueueEvent): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}

	// ── Snapshot ───────────────────────────────────────────────────────────────

	getSnapshot(): {
		current: QueuedRun | null;
		queued: QueuedRun[];
		batches: RunBatch[];
		history: QueueRunReportEntry[];
	} {
		return {
			current: this.current?.run ?? null,
			queued: this.queue.slice(this.current ? 1 : 0),
			batches: Array.from(this.batches.values()),
			history: this.history.slice(),
		};
	}

	getCurrent(): QueuedRun | null {
		return this.current?.run ?? null;
	}

	getRunSignal(): AbortSignal | undefined {
		return this.current?.controller.signal;
	}

	// ── Enqueue ────────────────────────────────────────────────────────────────

	enqueueBatch(input: BatchEnqueueInput): RunBatch {
		const batchId = generateId();
		const batch: RunBatch = {
			batchId,
			enqueuedAt: Date.now(),
			reportPolicy: input.reportPolicy,
			targetPolicy: input.targetPolicy,
			runIds: [],
			outcomeEntries: [],
			finalized: false,
		};
		this.batches.set(batchId, batch);

		for (let i = 0; i < input.urls.length; i++) {
			const { url, kind, provisionalTitle } = input.urls[i];
			const id = generateId();
			const ordinal = nextOrdinal();
			const run: QueuedRun = {
				id,
				ordinal,
				batchId,
				url,
				kind,
				displayTitle: '',
				titleResolved: false,
				options: structuredClone(input.options),
				initialTargetRef: input.targetPolicy.resolve(i),
				status: 'queued',
				enqueuedAt: Date.now(),
			};
			run.displayTitle = provisionalTitle ?? buildUrlFallbackTitle(run);
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
				run.titleResolved = true;
				this.emit({ type: 'title-resolved', run });
			})
			.catch(() => {
				// Best-effort — keep URL-id fallback on failure
			});
	}

	// ── Status update ──────────────────────────────────────────────────────────

	notifyStatus(run: QueuedRun): void {
		this.emit({ type: 'status', run });
	}

	// ── Cancellation ───────────────────────────────────────────────────────────

	cancelRun(runId: string): void {
		if (this.current?.run.id === runId) {
			this.current.controller.abort(new Error('Generation canceled by user.'));
			return;
		}
		const idx = this.queue.findIndex((r) => r.id === runId);
		if (idx < 0) return;
		const [removed] = this.queue.splice(idx, 1);
		removed.status = 'canceled';
		const entry = buildCanceledEntry(removed);
		removed.reportEntry = entry;
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
			run.status = 'canceled';
			const entry = buildCanceledEntry(run);
			run.reportEntry = entry;
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

		// Finalize any batch whose queued runs are all now terminal (current not yet done)
		for (const batch of this.batches.values()) {
			if (!batch.finalized && this.allRunsTerminal(batch)) {
				void this.finalizeBatch(batch);
			}
		}

		this.emit({ type: 'cleared' });
	}

	// ── Worker loop ────────────────────────────────────────────────────────────

	private kickWorker(): void {
		if (this.workerActive) return;
		this.workerActive = true;
		queueMicrotask(() => void this.workerLoop());
	}

	private async workerLoop(): Promise<void> {
		try {
			while (this.queue.length > 0) {
				const run = this.queue[0];
				run.status = 'running';
				run.startedAt = Date.now();
				const controller = new AbortController();
				this.current = { run, controller };
				this.emit({ type: 'started', run });

				let entry: QueueRunReportEntry;
				try {
					entry = await this.worker.executeRun(run, controller.signal);
				} catch (error) {
					entry = buildErrorEntry(run, error, controller.signal);
				}

				run.reportEntry = entry;
				run.finishedAt = Date.now();
				run.status = outcomeToStatus(entry.outcome);
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

	// ── Batch finalization ─────────────────────────────────────────────────────

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
		const report: QueueBatchReport = { batchId: batch.batchId, entries: batch.outcomeEntries };
		if (batch.reportPolicy.include) {
			await this.worker.persistBatchReport(batch, report);
		}
		this.emit({ type: 'batch-finished', batch });
	}

	// ── History ────────────────────────────────────────────────────────────────

	private pushHistory(entry: QueueRunReportEntry): void {
		this.history.push(entry);
		if (this.history.length > 50) {
			this.history.shift();
		}
	}
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function outcomeToStatus(outcome: QueueRunOutcome): QueuedRunStatus {
	switch (outcome) {
		case 'completed': return 'completed';
		case 'failed': return 'failed';
		case 'canceled': return 'canceled';
		case 'skipped': return 'completed';
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
