import { App, Modal, Setting } from 'obsidian';
import { QueuedRun, RunQueueService } from '../../services/runQueue';
import { QueueRunReportEntry } from '../../types';
import { createSettingsCard } from '../components/SettingsUIComponents';

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

		const snap = this.runQueue.getSnapshot();

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
			createSettingsCard(contentEl, 'Recent results', (body) => {
				const entries = snap.history.slice().reverse();
				for (const entry of entries) {
					this.renderHistoryEntry(body, entry);
				}
			});
		}

		if (!snap.current && snap.queued.length === 0 && snap.history.length === 0) {
			contentEl.createEl('p', { text: 'No active or queued runs.', cls: 'ytkn-queue-modal__empty' });
		}

		const footer = contentEl.createDiv({ cls: 'ytkn-queue-modal__footer' });
		const hasWork = snap.current !== null || snap.queued.length > 0;
		new Setting(footer)
			.addButton((btn) =>
				btn
					.setButtonText('Cancel all')
					// setWarning() keeps compatibility with minAppVersion 1.11.4; setDestructive() requires Obsidian 1.13.0.
					.setWarning()
					.setDisabled(!hasWork)
					.onClick(() => {
						this.runQueue.cancelAll();
					}),
			);
	}

	private renderActiveRun(container: HTMLElement, run: QueuedRun): void {
		const row = container.createDiv({ cls: 'ytkn-queue-modal__row' });
		const info = row.createDiv({ cls: 'ytkn-queue-modal__row-info' });
		info.createSpan({ text: run.displayTitle, cls: 'ytkn-queue-modal__run-title' });
		if (run.statusMessage) {
			info.createSpan({ text: run.statusMessage, cls: 'ytkn-queue-modal__run-status' });
		}
		row.createSpan({ text: 'Running', cls: 'ytkn-queue__badge ytkn-queue__badge--running' });
		row.createEl('button', { text: 'Cancel', cls: 'ytkn-queue-modal__cancel-btn' })
			.addEventListener('click', () => this.runQueue.cancelRun(run.id));
	}

	private renderQueuedRun(container: HTMLElement, run: QueuedRun): void {
		const row = container.createDiv({ cls: 'ytkn-queue-modal__row' });
		row.createSpan({ text: run.displayTitle, cls: 'ytkn-queue-modal__run-title' });
		row.createSpan({ text: 'Queued', cls: 'ytkn-queue__badge ytkn-queue__badge--queued' });
		row.createEl('button', { text: 'Cancel', cls: 'ytkn-queue-modal__cancel-btn' })
			.addEventListener('click', () => this.runQueue.cancelRun(run.id));
	}

	private renderHistoryEntry(container: HTMLElement, entry: QueueRunReportEntry): void {
		const row = container.createDiv({ cls: 'ytkn-queue-modal__row' });
		row.createSpan({ text: entry.displayTitle, cls: 'ytkn-queue-modal__run-title' });
		const badgeCls = `ytkn-queue__badge ytkn-queue__badge--${entry.outcome}`;
		const badgeText = entry.outcome.charAt(0).toUpperCase() + entry.outcome.slice(1);
		row.createSpan({ text: badgeText, cls: badgeCls });
		const reason = entry.kind === 'video' ? entry.reason : undefined;
		if (reason && entry.outcome !== 'completed') {
			row.createSpan({ text: reason, cls: 'ytkn-queue-modal__reason' });
		}
	}
}
