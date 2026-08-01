import { describe, expect, it, vi, beforeEach } from 'vitest';
import type {
	BatchEnqueueInput,
	QueuedRun,
	RunBatch,
	RunQueueEvent,
	RunWorker,
} from '../../src/queue/runQueueService';
import {
	RunQueueService,
	buildFolderTargetPolicy,
} from '../../src/queue/runQueueService';
import type { GenerationOptions, BatchReport, QueueRunResult } from '../../src/types';

function makeEntry(run: QueuedRun, outcome: QueueRunResult['outcome'] = 'completed'): QueueRunResult {
	return {
		kind: 'video',
		runId: run.id,
		batchId: run.batchId,
		ordinal: run.ordinal,
		url: run.url,
		displayTitle: run.displayTitle,
		outcome,
	};
}

function makeWorker(opts: {
	executeDelay?: number;
	executeOutcome?: QueueRunResult['outcome'];
	executeError?: Error;
	resolveTitle?: string;
	resolveDelay?: number;
} = {}): RunWorker & { persistCalls: Array<{ batch: RunBatch; report: BatchReport }> } {
	const persistCalls: Array<{ batch: RunBatch; report: BatchReport }> = [];
	return {
		persistCalls,
		executeRun: vi.fn(async (run: QueuedRun, signal: AbortSignal): Promise<QueueRunResult> => {
			if (opts.executeDelay) {
				await new Promise<void>((resolve, reject) => {
					const timer = setTimeout(resolve, opts.executeDelay);
					signal.addEventListener('abort', () => {
						clearTimeout(timer);
						reject(signal.reason);
					}, { once: true });
				});
			}
			if (opts.executeError) throw opts.executeError;
			return makeEntry(run, opts.executeOutcome ?? 'completed');
		}),
		resolveTitle: vi.fn(async (_run: QueuedRun, signal: AbortSignal): Promise<string> => {
			if (signal.aborted) throw signal.reason;
			if (opts.resolveDelay) await new Promise((r) => setTimeout(r, opts.resolveDelay));
			if (opts.resolveTitle === undefined) throw new Error('no title');
			return opts.resolveTitle;
		}),
		persistBatchReport: vi.fn(async (batch: RunBatch, report: BatchReport) => {
			persistCalls.push({ batch, report });
		}),
	};
}

function makeInput(urlCount = 1, reportInclude = true): BatchEnqueueInput {
	return {
		urls: Array.from({ length: urlCount }, (_, i) => ({
			url: `https://youtube.com/watch?v=vid${i}`,
			kind: 'video' as const,
		})),
		options: { generateAiSummary: true },
		targetPolicy: buildFolderTargetPolicy(),
		reportPolicy: { include: reportInclude, location: 'separate-note' },
	};
}

function collectEvents(svc: RunQueueService): RunQueueEvent[] {
	const events: RunQueueEvent[] = [];
	svc.on((e) => events.push(e));
	return events;
}

async function flushMicrotasks(): Promise<void> {
	await new Promise<void>((resolve) => setTimeout(resolve, 50));
}

describe('RunQueueService', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe('FIFO ordering', () => {
		it('executes runs from two batches in enqueue order', async () => {
			const executionOrder: string[] = [];
			const worker: RunWorker = {
				executeRun: vi.fn(async (run: QueuedRun) => {
					executionOrder.push(run.url);
					return makeEntry(run);
				}),
				resolveTitle: vi.fn().mockRejectedValue(new Error('no title')),
				persistBatchReport: vi.fn().mockResolvedValue(undefined),
			};
			const svc = new RunQueueService(worker);
			svc.enqueueBatch(makeInput(1));
			svc.enqueueBatch(makeInput(1));
			await flushMicrotasks();
			expect(executionOrder).toHaveLength(2);
			expect(worker.executeRun).toHaveBeenCalledTimes(2);
		});

		it('emits started/finished in FIFO order', async () => {
			const order: string[] = [];
			const worker = makeWorker();
			const svc = new RunQueueService(worker);
			svc.on((e) => {
				if (e.type === 'started' || e.type === 'finished') {
					order.push(`${e.type}:${(e as { run: QueuedRun }).run.url}`);
				}
			});
			const b1 = svc.enqueueBatch(makeInput(1));
			const b2 = svc.enqueueBatch(makeInput(1));
			const url1 = b1.runIds.length > 0 ? 'https://youtube.com/watch?v=vid0' : '';
			const url2 = b2.runIds.length > 0 ? 'https://youtube.com/watch?v=vid0' : '';
			await flushMicrotasks();
			expect(order[0]).toBe(`started:${url1}`);
			expect(order[1]).toBe(`finished:${url1}`);
			expect(order[2]).toBe(`started:${url2}`);
			expect(order[3]).toBe(`finished:${url2}`);
		});
	});

	describe('single-worker non-concurrency', () => {
		it('does not start run #2 until run #1 resolves', async () => {
			let callCount = 0;
			let run1Done = false;
			const executeOrder: number[] = [];
			const worker: RunWorker = {
				executeRun: vi.fn(async (run: QueuedRun) => {
					callCount++;
					if (callCount === 1) {
						await new Promise<void>((r) => setTimeout(r, 20));
						run1Done = true;
					} else {
						executeOrder.push(run1Done ? 1 : 0);
					}
					return makeEntry(run);
				}),
				resolveTitle: vi.fn().mockRejectedValue(new Error()),
				persistBatchReport: vi.fn().mockResolvedValue(undefined),
			};
			const svc = new RunQueueService(worker);
			svc.enqueueBatch(makeInput(2));
			await new Promise((r) => setTimeout(r, 80));
			expect(executeOrder[0]).toBe(1);
		});
	});

	describe('mid-run cancel-one', () => {
		it('aborts running run signal; next run starts', async () => {
			const started: string[] = [];
			const worker: RunWorker = {
				executeRun: vi.fn(async (run: QueuedRun, signal: AbortSignal) => {
					started.push(run.url);
					if (started.length === 1) {
						await new Promise<void>((_, reject) => {
							signal.addEventListener('abort', () => reject(signal.reason), { once: true });
						});
					}
					return makeEntry(run, signal.aborted ? 'canceled' : 'completed');
				}),
				resolveTitle: vi.fn().mockRejectedValue(new Error()),
				persistBatchReport: vi.fn().mockResolvedValue(undefined),
			};
			const svc = new RunQueueService(worker);
			svc.enqueueBatch(makeInput(2));
			await flushMicrotasks();
			const currentId = svc.getSnapshot().current?.id;
			expect(currentId).toBeDefined();
			svc.cancelRun(currentId!);
			await new Promise((r) => setTimeout(r, 50));
			expect(started).toHaveLength(2);
		});
	});

	describe('cancel queued (not running)', () => {
		it('removes from queue, emits removed, pushes to history, run never executes', async () => {
			const worker: RunWorker = {
				executeRun: vi.fn(async (_run: QueuedRun, signal: AbortSignal) => {
					await new Promise<void>((resolve, reject) => {
						signal.addEventListener('abort', () => reject(signal.reason), { once: true });
					});
					throw new Error('aborted');
				}),
				resolveTitle: vi.fn().mockRejectedValue(new Error()),
				persistBatchReport: vi.fn().mockResolvedValue(undefined),
			};
			const svc = new RunQueueService(worker);
			const events = collectEvents(svc);
			const batch = svc.enqueueBatch(makeInput(2));
			await flushMicrotasks();
			const queuedRunId = batch.runIds[1];
			svc.cancelRun(queuedRunId);
			expect(worker.executeRun).toHaveBeenCalledTimes(1);
			const removed = events.find((e) => e.type === 'removed' && (e as { runId: string }).runId === queuedRunId);
			expect(removed).toBeDefined();
			const hist = svc.getSnapshot().history;
			expect(hist.some((e) => e.runId === queuedRunId)).toBe(true);
			svc.cancelAll();
			await new Promise((r) => setTimeout(r, 20));
		});

		it('preserves channel identity and selected content when a queued channel is canceled', async () => {
			const worker = makeWorker({ executeDelay: 100 });
			const svc = new RunQueueService(worker);
			const batch = svc.enqueueBatch({
				urls: [
					{ url: 'https://youtube.com/watch?v=abcdefghijk', kind: 'video' },
					{ url: 'https://youtube.com/@channel', kind: 'channel' },
				],
				options: { channelContentTypes: ['shorts', 'streams'], channelVideoLimit: null },
				targetPolicy: buildFolderTargetPolicy(),
				reportPolicy: { include: false, location: 'generated-note' },
			});
			await flushMicrotasks();

			svc.cancelRun(batch.runIds[1]);
			const entry = svc.getSnapshot().history.find((candidate) => candidate.runId === batch.runIds[1]);

			expect(entry).toMatchObject({
				kind: 'channel',
				channelUrl: 'https://youtube.com/@channel',
				contentTypes: ['shorts', 'streams'],
				outcome: 'canceled',
			});
			svc.cancelAll();
		});

		it('preserves Shorts identity when a queued Short is canceled', async () => {
			const worker = makeWorker({ executeDelay: 100 });
			const svc = new RunQueueService(worker);
			const batch = svc.enqueueBatch({
				...makeInput(),
				urls: [
					{ url: 'https://youtube.com/watch?v=abcdefghijk', kind: 'video' },
					{ url: 'https://youtube.com/shorts/short000001', kind: 'video' },
				],
			});
			await flushMicrotasks();

			svc.cancelRun(batch.runIds[1]);
			const entry = svc.getSnapshot().history.find((candidate) => candidate.runId === batch.runIds[1]);

			expect(entry).toMatchObject({ kind: 'video', contentType: 'shorts', outcome: 'canceled' });
			svc.cancelAll();
		});
	});

	describe('cancelAll', () => {
		it('aborts running run, removes queued, pushes all to history, emits cleared', async () => {
			const worker = makeWorker({ executeDelay: 100 });
			const svc = new RunQueueService(worker);
			const events = collectEvents(svc);
			const batch = svc.enqueueBatch(makeInput(3));
			await flushMicrotasks();
			svc.cancelAll();
			await new Promise((r) => setTimeout(r, 50));
			const cleared = events.find((e) => e.type === 'cleared');
			expect(cleared).toBeDefined();
			const hist = svc.getSnapshot().history;
			expect(hist.filter((e) => e.batchId === batch.batchId).length).toBeGreaterThanOrEqual(2);
		});

		it('finalizes batch after cancelAll drains queued runs', async () => {
			const worker = makeWorker({ executeDelay: 50 });
			const svc = new RunQueueService(worker);
			const batch = svc.enqueueBatch(makeInput(2));
			await flushMicrotasks();
			svc.cancelAll();
			await new Promise((r) => setTimeout(r, 100));
			expect(batch.finalized).toBe(true);
		});
	});

	describe('failure continues queue', () => {
		it('run #1 throws → run #2 still executes', async () => {
			const executed: string[] = [];
			const worker: RunWorker = {
				executeRun: vi.fn(async (run: QueuedRun) => {
					executed.push(run.url);
					if (executed.length === 1) throw new Error('api error');
					return makeEntry(run);
				}),
				resolveTitle: vi.fn().mockRejectedValue(new Error()),
				persistBatchReport: vi.fn().mockResolvedValue(undefined),
			};
			const svc = new RunQueueService(worker);
			svc.enqueueBatch(makeInput(2));
			await flushMicrotasks();
			expect(executed).toHaveLength(2);
		});

		it('failed run gets failed outcome entry in batch', async () => {
			const worker: RunWorker = {
				executeRun: vi.fn(async (run: QueuedRun) => {
					throw new Error('fail');
				}),
				resolveTitle: vi.fn().mockRejectedValue(new Error()),
				persistBatchReport: vi.fn().mockResolvedValue(undefined),
			};
			const svc = new RunQueueService(worker);
			const batch = svc.enqueueBatch(makeInput(1));
			await flushMicrotasks();
			expect(batch.results[0]?.outcome).toBe('failed');
		});

		it('classifies AbortError-shaped thrown values as canceled', async () => {
			const worker: RunWorker = {
				executeRun: vi.fn(() => Promise.reject({ name: 'AbortError', message: 'The operation was aborted.' })),
				resolveTitle: vi.fn().mockRejectedValue(new Error()),
				persistBatchReport: vi.fn().mockResolvedValue(undefined),
			};
			const svc = new RunQueueService(worker);
			const batch = svc.enqueueBatch(makeInput(1));
			await flushMicrotasks();
			expect(batch.results[0]?.outcome).toBe('canceled');
		});
	});

	describe('option clone isolation', () => {
		it('mutating options after enqueue does not affect worker-received options', async () => {
			const receivedOptions: GenerationOptions[] = [];
			const worker: RunWorker = {
				executeRun: vi.fn(async (run: QueuedRun) => {
					receivedOptions.push(run.options);
					return makeEntry(run);
				}),
				resolveTitle: vi.fn().mockRejectedValue(new Error()),
				persistBatchReport: vi.fn().mockResolvedValue(undefined),
			};
			const svc = new RunQueueService(worker);
			const opts = { generateAiSummary: true, modelIds: ['original'] };
			svc.enqueueBatch({
				urls: [{ url: 'https://youtube.com/watch?v=v1', kind: 'video' }],
				options: opts,
				targetPolicy: buildFolderTargetPolicy(),
				reportPolicy: { include: false, location: 'generated-note' },
			});
			opts.modelIds[0] = 'mutated';
			await flushMicrotasks();
			expect(receivedOptions[0]?.modelIds).toEqual(['original']);
		});
	});

	describe('title resolution', () => {
		it('updates displayTitle and emits title-resolved on success', async () => {
			const worker = makeWorker({ resolveTitle: 'Real Title', resolveDelay: 10 });
			const svc = new RunQueueService(worker);
			const events = collectEvents(svc);
			const batch = svc.enqueueBatch(makeInput(1));
			await new Promise((r) => setTimeout(r, 100));
			const resolved = events.find((e) => e.type === 'title-resolved');
			expect(resolved).toBeDefined();
			const run = svc.getSnapshot().history.find((e) => e.batchId === batch.batchId);
			expect(run).toBeDefined();
		});

		it('keeps URL fallback on title resolution failure', async () => {
			const worker = makeWorker({ resolveTitle: undefined });
			const svc = new RunQueueService(worker);
			const batch = svc.enqueueBatch(makeInput(1));
			await flushMicrotasks();
			const snap = svc.getSnapshot();
			const entry = batch.results[0] ?? snap.history.find((e) => e.batchId === batch.batchId);
			expect(entry?.displayTitle).toMatch(/^#\d+ · video:/);
		});

		it('keeps the parsed channel handle in the exact fallback when title resolution fails', async () => {
			const worker = makeWorker({ resolveTitle: undefined });
			const svc = new RunQueueService(worker);
			const batch = svc.enqueueBatch({
				urls: [{ url: 'https://youtube.com/@GoogleDevelopers/streams', kind: 'channel' }],
				options: { channelContentTypes: ['streams'] },
				targetPolicy: buildFolderTargetPolicy(),
				reportPolicy: { include: false, location: 'generated-note' },
			});
			await flushMicrotasks();

			const entry = batch.results[0];
			expect(entry?.displayTitle).toBe(`#${entry?.ordinal} · channel:@GoogleDevelopers`);
		});
	});

	describe('listener unsubscribe', () => {
		it('off() stops receiving events', async () => {
			const worker = makeWorker();
			const svc = new RunQueueService(worker);
			const received: RunQueueEvent[] = [];
			const off = svc.on((e) => received.push(e));
			const before = received.length;
			off();
			svc.enqueueBatch(makeInput(1));
			await flushMicrotasks();
			expect(received.length).toBe(before);
		});
	});

	describe('history ring caps at 50', () => {
		it('oldest entry drops on overflow', async () => {
			const worker = makeWorker();
			const svc = new RunQueueService(worker);
			for (let i = 0; i < 55; i++) {
				svc.enqueueBatch(makeInput(1, false));
			}
			await new Promise((r) => setTimeout(r, 300));
			expect(svc.getSnapshot().history.length).toBeLessThanOrEqual(50);
		});
	});

	describe('per-batch finalization', () => {
		it('calls persistBatchReport when reportPolicy.include is true', async () => {
			const worker = makeWorker();
			const svc = new RunQueueService(worker);
			svc.enqueueBatch(makeInput(1, true));
			await flushMicrotasks();
			expect(worker.persistCalls).toHaveLength(1);
		});

		it('does NOT call persistBatchReport when reportPolicy.include is false', async () => {
			const worker = makeWorker();
			const svc = new RunQueueService(worker);
			svc.enqueueBatch(makeInput(1, false));
			await flushMicrotasks();
			expect(worker.persistCalls).toHaveLength(0);
		});

		it('continues with later runs when report persistence fails', async () => {
			const executed: number[] = [];
			const onBatchReportError = vi.fn();
			const persistBatchReport = vi.fn()
				.mockRejectedValueOnce(new Error('report write failed'))
				.mockResolvedValueOnce(undefined);
			const worker: RunWorker = {
				executeRun: vi.fn(async (run: QueuedRun) => {
					executed.push(run.ordinal);
					return makeEntry(run);
				}),
				resolveTitle: vi.fn().mockRejectedValue(new Error()),
				persistBatchReport,
				onBatchReportError,
			};
			const svc = new RunQueueService(worker);

			svc.enqueueBatch(makeInput(1, true));
			svc.enqueueBatch(makeInput(1, true));
			await flushMicrotasks();

			expect(executed).toHaveLength(2);
			expect(persistBatchReport).toHaveBeenCalledTimes(2);
			expect(onBatchReportError).toHaveBeenCalledTimes(1);
			expect(svc.getSnapshot().history).toHaveLength(2);
		});

		it('continues when report-error notification fails', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
			const worker = makeWorker();
			worker.persistBatchReport = vi.fn().mockRejectedValue(new Error('report write failed'));
			worker.onBatchReportError = vi.fn(() => { throw new Error('notification failed'); });
			const svc = new RunQueueService(worker);

			svc.enqueueBatch(makeInput(1, true));
			svc.enqueueBatch(makeInput(1, true));
			await flushMicrotasks();

			expect(worker.executeRun).toHaveBeenCalledTimes(2);
			expect(consoleSpy).toHaveBeenCalledWith(
				'Batch report error callback failed:',
				expect.any(Error),
			);
		});

		it('notifies onBatchFinalized for every finished batch, reports on or off', async () => {
			const finalizedBatchIds: string[] = [];
			const worker = makeWorker();
			worker.onBatchFinalized = vi.fn((batch: RunBatch) => { finalizedBatchIds.push(batch.batchId); });
			const svc = new RunQueueService(worker);

			svc.enqueueBatch(makeInput(1, false));
			await flushMicrotasks();
			svc.enqueueBatch(makeInput(1, true));
			await flushMicrotasks();

			expect(finalizedBatchIds).toHaveLength(2);
			expect(worker.persistCalls).toHaveLength(1);
		});

		it('notifies onBatchFinalized when a reports-off batch is fully canceled', async () => {
			const worker = makeWorker({ executeDelay: 1000 });
			worker.onBatchFinalized = vi.fn();
			const svc = new RunQueueService(worker);

			svc.enqueueBatch(makeInput(2, false));
			svc.cancelAll();
			await flushMicrotasks();

			expect(worker.onBatchFinalized).toHaveBeenCalledTimes(1);
			expect(worker.persistCalls).toHaveLength(0);
		});

		it('ordinals are monotonically increasing across batches', async () => {
			const ordinals: number[] = [];
			const worker: RunWorker = {
				executeRun: vi.fn(async (run: QueuedRun) => {
					ordinals.push(run.ordinal);
					return makeEntry(run);
				}),
				resolveTitle: vi.fn().mockRejectedValue(new Error()),
				persistBatchReport: vi.fn().mockResolvedValue(undefined),
			};
			const svc = new RunQueueService(worker);
			svc.enqueueBatch(makeInput(2, false));
			svc.enqueueBatch(makeInput(2, false));
			await new Promise((r) => setTimeout(r, 100));
			expect(ordinals.length).toBe(4);
			for (let i = 1; i < ordinals.length; i++) {
				expect(ordinals[i]).toBeGreaterThan(ordinals[i - 1]);
			}
		});
	});
});
