import type { App } from 'obsidian';
import { Notice, TFile } from 'obsidian';
import { notifyError } from '../ui/shared/notifications';
import type {
	PluginSettings,
	QueueBatchReport,
	QueueRunReportEntry,
} from '../types';
import type { YouTubeService } from '../youtube/youtubeService';
import { classifyVideoContentType, extractPlaylistId, extractVideoId } from '../youtube/urls';
import { isAbortError } from '../queue/progress';
import { renderQueueBatchReport } from '../rendering/runReport';
import { getErrorMessage } from '../utils';
import type { QueuedRun, RunBatch } from '../queue/runQueueService';
import { resolveEffectiveGenerationOptions, type EffectiveGenerationOptions } from './effectiveOptions';
import { buildAiExecutionContext } from './aiPolicy';
import { playlistRunOutcome } from './reportEntries';
import type { GenerationWorkflowContext } from './workflows/context';
import { generateChannelNotes, generatePlaylistNotes } from './workflows/playlist';
import { generateSingleVideoNote } from './workflows/singleVideo';
import { buildSafeBaseName, NoteTargetWriter } from './targets/noteTargets';
import type { ProgressState } from './targets/noteTargets';

export class GenerationService {
	private targets: NoteTargetWriter;
	private openedNoteBatchIds = new Set<string>();

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

			// Multi-URL editor batches need append behavior even though `current-note`
			// means replace-range for single URLs; normalize the runtime mode here.
			if (run.initialTargetRef?.mode === 'append-end' && effectiveOptions.noteDestinationMode === 'current-note') {
				effectiveOptions = { ...effectiveOptions, noteDestinationMode: 'append-to-active-note' };
			}

			const context = this.workflowContext(run, effectiveOptions);

			if (run.kind === 'channel') {
				const { channel, notePath, entries, warnings } = await generateChannelNotes(
					context, run.url, initialTarget, effectiveOptions, aiContext, progressState, signal,
				);
				return {
					kind: 'channel',
					runId: run.id,
					batchId: run.batchId,
					ordinal: run.ordinal,
					url: run.url,
					displayTitle: run.displayTitle,
					channelTitle: channel.title,
					channelUrl: run.url,
					contentTypes: channel.contentTypes,
					outcome: playlistRunOutcome(entries),
					notePath: notePath ?? undefined,
					warnings: warnings.length > 0 ? warnings : undefined,
					entries,
				};
			}

			if (run.kind === 'playlist') {
				const { playlist, notePath, entries, warnings } = await generatePlaylistNotes(
					context, run.url, initialTarget, effectiveOptions, aiContext, progressState, signal,
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
					warnings: warnings.length > 0 ? warnings : undefined,
					entries,
				};
			}

			const { notePath, transcriptLanguageCode, warnings } = await generateSingleVideoNote(
				context, run.url, initialTarget, effectiveOptions, aiContext, progressState, signal,
			);
			return {
				kind: 'video',
				runId: run.id,
				batchId: run.batchId,
				ordinal: run.ordinal,
				url: run.url,
				displayTitle: run.displayTitle,
				contentType: classifyVideoContentType(run.url),
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
		if (run.kind === 'channel') {
			const title = await this.youtubeService.fetchChannelTitle(run.url);
			if (signal.aborted) throw signal.reason;
			return title;
		}
		if (run.kind === 'playlist') {
			const playlistId = extractPlaylistId(run.url);
			if (!playlistId) throw new Error('Could not extract playlist ID');
			const title = await this.youtubeService.fetchPlaylistTitle(playlistId);
			if (signal.aborted) throw signal.reason;
			return title;
		}
		const videoId = extractVideoId(run.url);
		if (!videoId) throw new Error('Could not extract video ID');
		const title = await this.youtubeService.fetchVideoTitle(videoId);
		if (signal.aborted) throw signal.reason;
		return title;
	}

	onBatchFinalized(batch: RunBatch): void {
		this.openedNoteBatchIds.delete(batch.batchId);
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

	private workflowContext(run: QueuedRun, effectiveOptions: EffectiveGenerationOptions): GenerationWorkflowContext {
		return {
			youtubeService: this.youtubeService,
			targets: this.targets,
			onStatusBar: this.onStatusBar,
			maybeOpenCreatedNote: async (target) => {
				if (!effectiveOptions.openCreatedNote || effectiveOptions.noteDestinationMode !== 'folder') {
					return;
				}
				if (this.openedNoteBatchIds.has(run.batchId)) {
					return;
				}
				this.openedNoteBatchIds.add(run.batchId);
				await this.targets.openTargetInNewTab(target);
			},
		};
	}

	private isCancellationError(error: unknown, signal: AbortSignal): boolean {
		return isAbortError(error, signal);
	}

	private pickFirstNotePath(entries: QueueRunReportEntry[]): string | null {
		for (const entry of entries) {
			if (entry.notePath) return entry.notePath;
			if (entry.kind !== 'video') {
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
