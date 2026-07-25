import type { App } from 'obsidian';
import { Modal, Setting, setIcon } from 'obsidian';
import type { QueuedRun, RunQueueService } from '../../queue/runQueueService';
import type { QueueRunResult } from '../../types';
import { createSettingsCard } from '../shared/cards';
import { setDestructiveButton } from '../shared/buttonStyles';

const MAX_VISIBLE_HISTORY = 10;
type QueueStatus = QueueRunResult['outcome'] | 'queued' | 'running';

export class QueueModal extends Modal {
	private offListener?: () => void;

	constructor(app: App, private readonly runQueue: RunQueueService) {
		super(app);
	}

	onOpen(): void {
		this.offListener = this.runQueue.on(() => this.render());
		this.render();
	}

	onClose(): void {
		this.offListener?.();
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ytkn-queue-modal');
		contentEl.setAttribute('aria-labelledby', 'ytkn-queue-modal-title');

		const snap = this.runQueue.getSnapshot();
		this.renderHeader(contentEl, snap.current !== null, snap.queued.length, snap.history.length);
		const hasWork = snap.current !== null || snap.queued.length > 0;
		if (hasWork) {
			this.renderQueueActions(contentEl);
		}

		if (snap.current) {
			createSettingsCard(contentEl, 'Active', (body) => {
				this.renderActiveRun(body, snap.current!);
			});
		}

		if (snap.queued.length > 0) {
			createSettingsCard(contentEl, `Queued (${snap.queued.length})`, (body) => {
				for (const run of snap.queued) {
					this.renderQueuedRun(body, run);
				}
			});
		}

		if (snap.history.length > 0) {
			createSettingsCard(contentEl, `Recent results (${snap.history.length})`, (body) => {
				const entries = snap.history.slice(-MAX_VISIBLE_HISTORY).reverse();
				for (const entry of entries) {
					this.renderHistoryEntry(body, entry);
				}
				if (snap.history.length > MAX_VISIBLE_HISTORY) {
					body.createEl('p', {
						cls: 'ytkn-queue-modal__history-note',
						text: `Showing the ${MAX_VISIBLE_HISTORY} most recent results.`,
					});
				}
			});
		}

		if (!snap.current && snap.queued.length === 0 && snap.history.length === 0) {
			const empty = contentEl.createDiv({ cls: 'ytkn-queue-modal__empty' });
			const icon = empty.createSpan({ cls: 'ytkn-queue-modal__empty-icon' });
			setIcon(icon, 'circle-check-big');
			empty.createEl('h3', { text: 'Queue is clear' });
			empty.createEl('p', { text: 'New generation runs will appear here.' });
		}

	}

	private renderQueueActions(container: HTMLElement): void {
		const controls = container.createDiv({ cls: 'ytkn-queue-modal__controls' });
		new Setting(controls)
			.addButton((btn) =>
				setDestructiveButton(btn.setButtonText('Cancel all runs'))
					.onClick(() => {
						this.runQueue.cancelAll();
					}),
			);
	}

	private renderHeader(
		container: HTMLElement,
		hasActiveRun: boolean,
		queuedCount: number,
		historyCount: number,
	): void {
		const header = container.createDiv({ cls: 'ytkn-queue-modal__header ytkn-brand-header' });
		const mark = header.createDiv({ cls: 'ytkn-brand-mark ytkn-queue-modal__mark' });
		mark.setAttribute('aria-hidden', 'true');
		setIcon(mark, 'play');
		const copy = header.createDiv({ cls: 'ytkn-queue-modal__header-copy' });
		copy.createEl('h2', {
			attr: { id: 'ytkn-queue-modal-title' },
			cls: 'ytkn-brand-title ytkn-queue-modal__title',
			text: 'Generation queue',
		});
		const activeText = hasActiveRun ? '1 active' : 'No active runs';
		const queuedText = `${queuedCount} queued`;
		const recentText = `${historyCount} recent`;
		copy.createEl('p', {
			attr: { 'aria-live': 'polite' },
			cls: 'ytkn-queue-modal__summary',
			text: `${activeText}, ${queuedText}, ${recentText}`,
		});
	}

	private renderActiveRun(container: HTMLElement, run: QueuedRun): void {
		this.renderRunRow(container, run.displayTitle, 'running', undefined, () => {
			this.runQueue.cancelRun(run.id);
		});
	}

	private renderQueuedRun(container: HTMLElement, run: QueuedRun): void {
		this.renderRunRow(container, run.displayTitle, 'queued', undefined, () => {
			this.runQueue.cancelRun(run.id);
		});
	}

	private renderHistoryEntry(container: HTMLElement, entry: QueueRunResult): void {
		this.renderRunRow(container, entry.displayTitle, entry.outcome, entry.reason);
	}

	private renderRunRow(
		container: HTMLElement,
		title: string,
		status: QueueStatus,
		reason?: string,
		onCancel?: () => void,
	): void {
		const row = container.createDiv({ cls: 'ytkn-queue-modal__row' });
		const info = row.createDiv({ cls: 'ytkn-queue-modal__row-info' });
		info.createSpan({
			attr: { title },
			text: title,
			cls: 'ytkn-queue-modal__run-title',
		});
		if (reason && status !== 'completed') {
			info.createSpan({ text: reason, cls: 'ytkn-queue-modal__reason' });
		}
		const actions = row.createDiv({ cls: 'ytkn-queue-modal__row-actions' });
		const badgeText = status.charAt(0).toUpperCase() + status.slice(1);
		actions.createSpan({
			attr: { 'aria-label': `Status: ${badgeText}` },
			text: badgeText,
			cls: `ytkn-queue__badge ytkn-queue__badge--${status}`,
		});
		if (onCancel) {
			const cancelButton = actions.createEl('button', {
				attr: { 'aria-label': `Cancel ${title}`, type: 'button' },
				text: 'Cancel',
				cls: 'ytkn-queue-modal__cancel-btn',
			});
			cancelButton.addEventListener('click', onCancel);
		}
	}
}
