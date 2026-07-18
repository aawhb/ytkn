import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../../mocks/obsidian');
	return mod;
});

import { App } from 'obsidian';
import { QueueModal } from '../../../src/ui/queue/queueModal';
import type {
	RunWorker,
	QueuedRun,
	BatchEnqueueInput,
} from '../../../src/queue/runQueueService';
import {
	RunQueueService,
	buildFolderTargetPolicy,
} from '../../../src/queue/runQueueService';
import type { QueueRunReportEntry } from '../../../src/types';

function makeWorker(): RunWorker {
	return {
		executeRun: vi.fn().mockResolvedValue(undefined as unknown as QueueRunReportEntry),
		resolveTitle: vi.fn().mockRejectedValue(new Error('no title')),
		persistBatchReport: vi.fn().mockResolvedValue(undefined),
	};
}

function makeInput(urlCount = 1): BatchEnqueueInput {
	return {
		urls: Array.from({ length: urlCount }, (_, i) => ({
			url: `https://youtube.com/watch?v=vid${i}`,
			kind: 'video' as const,
		})),
		options: { generateAiSummary: false },
		targetPolicy: buildFolderTargetPolicy(),
		reportPolicy: { include: false, location: 'generated-note' as const },
	};
}

async function flush(): Promise<void> {
	await new Promise<void>((r) => setTimeout(r, 30));
}

describe('QueueModal', () => {
	let app: App;

	beforeEach(() => {
		app = new App();
		vi.restoreAllMocks();
	});

	it('shows empty state when nothing active and history empty', () => {
		const worker = makeWorker();
		const svc = new RunQueueService(worker);
		const modal = new QueueModal(app, svc);
		modal.open();

		expect(modal.contentEl.querySelector('h2')?.textContent).toBe('Generation queue');
		const brandMark = modal.contentEl.querySelector('.ytkn-queue-modal__mark.ytkn-brand-mark');
		expect(brandMark?.getAttribute('aria-hidden')).toBe('true');
		const empty = modal.contentEl.querySelector('.ytkn-queue-modal__empty');
		expect(empty).not.toBeNull();
		expect(empty?.textContent).toContain('Queue is clear');
	});

	it('renders active run section when run is current', async () => {
		let resolveRun!: () => void;
		const worker: RunWorker = {
			executeRun: vi.fn((_run: QueuedRun, signal: AbortSignal) =>
				new Promise<QueueRunReportEntry>((resolve, reject) => {
					resolveRun = () => resolve({
						kind: 'video', runId: _run.id, batchId: _run.batchId,
						ordinal: _run.ordinal, url: _run.url, displayTitle: _run.displayTitle,
						outcome: 'completed',
					});
					signal.addEventListener('abort', () => reject(signal.reason), { once: true });
				}),
			),
			resolveTitle: vi.fn().mockRejectedValue(new Error()),
			persistBatchReport: vi.fn().mockResolvedValue(undefined),
		};
		const svc = new RunQueueService(worker);
		svc.enqueueBatch(makeInput(1));
		await flush();

		const modal = new QueueModal(app, svc);
		modal.open();

		const runningBadge = modal.contentEl.querySelector('.ytkn-queue__badge--running');
		expect(runningBadge).not.toBeNull();

		resolveRun();
		await flush();
	});

	it('renders queued runs section', async () => {
		const worker: RunWorker = {
			executeRun: vi.fn((_run: QueuedRun, signal: AbortSignal) =>
				new Promise<QueueRunReportEntry>((_, reject) => {
					signal.addEventListener('abort', () => reject(signal.reason), { once: true });
				}),
			),
			resolveTitle: vi.fn().mockRejectedValue(new Error()),
			persistBatchReport: vi.fn().mockResolvedValue(undefined),
		};
		const svc = new RunQueueService(worker);
		svc.enqueueBatch(makeInput(2));
		await flush();

		const modal = new QueueModal(app, svc);
		modal.open();

		const queuedBadge = modal.contentEl.querySelector('.ytkn-queue__badge--queued');
		expect(queuedBadge).not.toBeNull();

		svc.cancelAll();
		await flush();
	});

	it('renders recent results from history', async () => {
		const worker = makeWorker();
		(worker.executeRun as ReturnType<typeof vi.fn>).mockImplementation(async (run: QueuedRun) => ({
			kind: 'video' as const,
			runId: run.id,
			batchId: run.batchId,
			ordinal: run.ordinal,
			url: run.url,
			displayTitle: run.displayTitle,
			outcome: 'completed' as const,
		}));
		const svc = new RunQueueService(worker);
		svc.enqueueBatch(makeInput(1));
		await flush();

		const modal = new QueueModal(app, svc);
		modal.open();

		const completedBadge = modal.contentEl.querySelector('.ytkn-queue__badge--completed');
		expect(completedBadge).not.toBeNull();
	});

	it('limits visible history while reporting the full recent count', () => {
		const history = Array.from({ length: 12 }, (_, index): QueueRunReportEntry => ({
			kind: 'video',
			runId: `run-${index}`,
			batchId: 'batch',
			ordinal: index + 1,
			url: `https://youtube.com/watch?v=vid${index}`,
			displayTitle: `Video ${index}`,
			outcome: 'completed',
		}));
		const service = {
			on: vi.fn(() => vi.fn()),
			getSnapshot: vi.fn(() => ({ current: null, queued: [], history })),
		} as unknown as RunQueueService;
		const modal = new QueueModal(app, service);

		modal.open();

		expect(modal.contentEl.textContent).toContain('Recent results (12)');
		expect(modal.contentEl.querySelectorAll('.ytkn-queue-modal__row')).toHaveLength(10);
		expect(modal.contentEl.textContent).toContain('Showing the 10 most recent results.');
	});

	it('cancel-one button calls cancelRun on the service', async () => {
		const worker: RunWorker = {
			executeRun: vi.fn((_run: QueuedRun, signal: AbortSignal) =>
				new Promise<QueueRunReportEntry>((_, reject) => {
					signal.addEventListener('abort', () => reject(signal.reason), { once: true });
				}),
			),
			resolveTitle: vi.fn().mockRejectedValue(new Error()),
			persistBatchReport: vi.fn().mockResolvedValue(undefined),
		};
		const svc = new RunQueueService(worker);
		const cancelRunSpy = vi.spyOn(svc, 'cancelRun');
		svc.enqueueBatch(makeInput(2));
		await flush();

		const modal = new QueueModal(app, svc);
		modal.open();

		const cancelBtns = modal.contentEl.querySelectorAll('.ytkn-queue-modal__cancel-btn');
		expect(cancelBtns.length).toBeGreaterThanOrEqual(2);
		(cancelBtns[1] as HTMLButtonElement).click();
		expect(cancelRunSpy).toHaveBeenCalledTimes(1);

		svc.cancelAll();
		await flush();
	});

	it('cancel-all button calls cancelAll on the service', async () => {
		const worker: RunWorker = {
			executeRun: vi.fn((_run: QueuedRun, signal: AbortSignal) =>
				new Promise<QueueRunReportEntry>((_, reject) => {
					signal.addEventListener('abort', () => reject(signal.reason), { once: true });
				}),
			),
			resolveTitle: vi.fn().mockRejectedValue(new Error()),
			persistBatchReport: vi.fn().mockResolvedValue(undefined),
		};
		const svc = new RunQueueService(worker);
		const cancelAllSpy = vi.spyOn(svc, 'cancelAll');
		svc.enqueueBatch(makeInput(1));
		await flush();

		const modal = new QueueModal(app, svc);
		modal.open();

		const cancelAllBtn = Array.from(modal.contentEl.querySelectorAll('button')).find(
			(b) => b.textContent === 'Cancel all runs',
		) as HTMLButtonElement | undefined;
		expect(cancelAllBtn).toBeDefined();
		const activeCard = Array.from(modal.contentEl.querySelectorAll('.ytkn-card')).find(
			(card) => card.textContent?.includes('Active'),
		);
		expect(cancelAllBtn!.compareDocumentPosition(activeCard!))
			.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		cancelAllBtn!.click();
		expect(cancelAllSpy).toHaveBeenCalledTimes(1);

		await flush();
	});

	it('re-renders when queue events fire', async () => {
		const worker = makeWorker();
		(worker.executeRun as ReturnType<typeof vi.fn>).mockImplementation(async (run: QueuedRun) => ({
			kind: 'video' as const,
			runId: run.id,
			batchId: run.batchId,
			ordinal: run.ordinal,
			url: run.url,
			displayTitle: run.displayTitle,
			outcome: 'completed' as const,
		}));
		const svc = new RunQueueService(worker);
		const modal = new QueueModal(app, svc);
		modal.open();

		expect(modal.contentEl.querySelector('.ytkn-queue-modal__empty')).not.toBeNull();

		svc.enqueueBatch(makeInput(1));
		await flush();

		expect(modal.contentEl.querySelector('.ytkn-queue-modal__empty')).toBeNull();
		expect(modal.contentEl.querySelector('.ytkn-queue__badge--completed')).not.toBeNull();
	});

	it('off() stops re-renders after modal closes', async () => {
		const worker = makeWorker();
		(worker.executeRun as ReturnType<typeof vi.fn>).mockImplementation(async (run: QueuedRun) => ({
			kind: 'video' as const, runId: run.id, batchId: run.batchId,
			ordinal: run.ordinal, url: run.url, displayTitle: run.displayTitle,
			outcome: 'completed' as const,
		}));
		const svc = new RunQueueService(worker);
		const modal = new QueueModal(app, svc);
		modal.open();
		modal.close();

		expect(modal.contentEl.innerHTML).toBe('');
	});
});
