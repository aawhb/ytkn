import { App, Notice, TFile } from 'obsidian';
import { notifyError } from '../ui/shared/notifications';
import {
	PluginSettings,
	QueueBatchReport,
	QueueRunReportEntry,
} from '../types';
import { YouTubeService } from '../youtube/youtubeService';
import { isAbortError } from '../queue/progress';
import { renderQueueBatchReport } from '../rendering/runReport';
import { getErrorMessage } from '../utils';
import { QueuedRun, RunBatch } from '../queue/runQueueService';
import { resolveEffectiveGenerationOptions } from './effectiveOptions';
import { buildAiExecutionContext } from './aiPolicy';
import { playlistRunOutcome } from './reportEntries';
import type { GenerationWorkflowContext } from './workflows/context';
import { generatePlaylistNotes } from './workflows/playlist';
import { generateSingleVideoNote } from './workflows/singleVideo';
import { buildSafeBaseName, NoteTargetWriter } from './targets/noteTargets';
import type { ProgressState } from './targets/noteTargets';

export type { NoteInsertionTarget } from './targets/noteTargets';
export { INSERT_AT_CARET_REQUIRES_NOTE } from './constants';

export class GenerationService {
	private targets: NoteTargetWriter;

	constructor(
		private app: App,
		private youtubeService: YouTubeService,
		private settings: PluginSettings,
		private onStatusBar: (message: string | null) => void,
	) {
		this.targets = new NoteTargetWriter(app, onStatusBar);
	}

	async executeRun(run: QueuedRun, signal: AbortSignal): Promise<QueueRunReportEntry> {
		const progressState: ProgressState = {
			target: null,
			url: run.url,
			hasProgressContent: false,
		};

		try {
			let effectiveOptions = resolveEffectiveGenerationOptions(run.options, this.settings);
			const aiContext = buildAiExecutionContext(effectiveOptions, this.settings);

			const initialTarget = await this.targets.resolveInitialTarget(run);

			// When multi-URL paste coerces a `current-note` target to append-end,
			// effectiveOptions.noteDestinationMode stays 'current-note' but runtime
			// behavior must be append mode. Normalize here so the rendering (H1->H2
			// fragment), rename-suppression, and progress-write branches all fire
			// correctly. Does not affect single-URL current-note (mode='replace-range').
			if (run.initialTargetRef?.mode === 'append-end' && effectiveOptions.noteDestinationMode === 'current-note') {
				effectiveOptions = { ...effectiveOptions, noteDestinationMode: 'append-to-active-note' };
			}

			if (YouTubeService.isPlaylistUrl(run.url)) {
				const { playlist, notePath, entries } = await generatePlaylistNotes(
					this.workflowContext(), run.url, initialTarget, effectiveOptions, aiContext, progressState, signal,
				);
				return {
					kind: 'playlist',
					runId: run.id,
					batchId: run.batchId,
					ordinal: run.ordinal,
					url: run.url,
					displayTitle: run.displayTitle,
					playlistTitle: playlist.title,
					playlistUrl: run.url,
					outcome: playlistRunOutcome(entries),
					notePath: notePath ?? undefined,
					entries,
				};
			}

			const { notePath, transcriptLanguageCode, warnings } = await generateSingleVideoNote(
				this.workflowContext(), run.url, initialTarget, effectiveOptions, aiContext, progressState, signal,
			);
			return {
				kind: 'video',
				runId: run.id,
				batchId: run.batchId,
				ordinal: run.ordinal,
				url: run.url,
				displayTitle: run.displayTitle,
				outcome: 'completed',
				notePath: notePath ?? undefined,
				transcriptLanguageCode,
				warnings: warnings.length > 0 ? warnings : undefined,
			};
		} catch (error) {
			if (progressState.hasProgressContent && progressState.target) {
				try {
					const isCanceled = this.isCancellationError(error, signal);
					const message = getErrorMessage(error);
					await this.targets.upsertProgressContent(
						progressState.target,
						progressState.url,
						isCanceled ? 'Canceled' : 'Failed',
						isCanceled ? 'info' : 'failure',
						isCanceled ? undefined : message,
					);
				} catch (progressError) {
					console.error('Failed to update progress block:', progressError);
				}
			}

			if (this.isCancellationError(error, signal)) {
				new Notice('Generation canceled.');
			} else {
				notifyError('Generation failed', error);
			}
			throw error;
		}
	}

	async resolveTitle(run: QueuedRun, signal: AbortSignal): Promise<string> {
		if (signal.aborted) throw signal.reason;
		if (YouTubeService.isPlaylistUrl(run.url)) {
			const playlistId = YouTubeService.extractPlaylistId(run.url);
			if (!playlistId) throw new Error('Could not extract playlist ID');
			const title = await this.youtubeService.fetchPlaylistTitle(playlistId);
			if (signal.aborted) throw signal.reason;
			return title;
		}
		const videoId = YouTubeService.extractVideoId(run.url);
		if (!videoId) throw new Error('Could not extract video ID');
		const title = await this.youtubeService.fetchVideoTitle(videoId);
		if (signal.aborted) throw signal.reason;
		return title;
	}

	async persistBatchReport(batch: RunBatch, report: QueueBatchReport): Promise<void> {
		if (!batch.reportPolicy.include) return;

		const rendered = renderQueueBatchReport(report);

		if (batch.reportPolicy.location === 'generated-note') {
			const firstNotePath = this.pickFirstNotePath(report.entries);
			if (!firstNotePath) return;
			const file = this.app.vault.getAbstractFileByPath(firstNotePath);
			if (!(file instanceof TFile)) return;
			await this.app.vault.process(file, (data) => {
				const trimmed = data.trimEnd();
				return trimmed ? `${trimmed}\n\n${rendered}` : rendered;
			});
			return;
		}

		const folderPath = this.pickReportFolder(report.entries);
		const baseName = this.buildReportBaseName(report);
		const target = await this.targets.createNewTarget(folderPath, baseName);
		await this.targets.writeContentToTarget(target, `# Queue Run Report\n\n${rendered}`);
		target.finalized = true;
	}

	private workflowContext(): GenerationWorkflowContext {
		return {
			youtubeService: this.youtubeService,
			targets: this.targets,
			onStatusBar: this.onStatusBar,
		};
	}

	private isCancellationError(error: unknown, signal: AbortSignal): boolean {
		return isAbortError(error, signal);
	}

	private pickFirstNotePath(entries: QueueRunReportEntry[]): string | null {
		for (const entry of entries) {
			if (entry.notePath) return entry.notePath;
			if (entry.kind === 'playlist') {
				const nested = entry.entries.find((e) => e.notePath);
				if (nested?.notePath) return nested.notePath;
			}
		}
		return null;
	}

	private pickReportFolder(entries: QueueRunReportEntry[]): string {
		const firstPath = this.pickFirstNotePath(entries);
		if (!firstPath) return '';
		const parts = firstPath.split('/');
		return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
	}

	private buildReportBaseName(report: QueueBatchReport): string {
		const firstEntry = report.entries[0];
		if (firstEntry) {
			return buildSafeBaseName(`${firstEntry.displayTitle} Queue Run Report`, 'Queue Run Report');
		}
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}${pad(now.getMinutes())}`;
		return `Queue Run Report ${dateStr}`;
	}
}
