import { App, Notice, TFile } from 'obsidian';
import { notifyError } from '../ui/notifications';
import {
	AIModelProvider,
	GenerationOptions,
	InstructionConfig,
	ModelConfig,
	PlaylistEntry,
	PlaylistResponse,
	PlaylistRunReportEntry,
	PlaylistTranscriptResponse,
	PluginSettings,
	QueueBatchReport,
	QueueRunReportEntry,
	TranscriptFetchResult,
	TranscriptResponse,
} from '../types';
import { YouTubeService } from './youtube';
import { PromptService } from './prompt';
import { ProvidersFactory } from './providers/factory';
import {
	buildProgressContent,
	buildProgressMarkers,
	isAbortError,
	ProgressMarkers,
	replaceMarkedContent,
} from './progress';
import { renderPlaylistNote, renderQueueBatchReport, renderVideoNote } from './renderer';
import { getTemplate } from './templates';
import {
	buildModelId,
	createJobId,
	formatSequenceName,
	getErrorMessage,
	normalizeVaultFolderPath,
	resolveUniqueNotePath,
	sanitizeNoteFileName,
} from '../utils';
import { QueuedRun, RunBatch } from './runQueue';

export const INSERT_AT_CARET_REQUIRES_NOTE = 'Open a note before choosing "Insert at caret".';

export interface NoteInsertionTarget {
	file: TFile;
	fromOffset: number;
	toOffset: number;
	jobId: string;
	createdByPlugin: boolean;
	finalized: boolean;
}

interface ProgressState {
	target: NoteInsertionTarget | null;
	url: string;
	hasProgressContent: boolean;
}

interface AiExecutionContext {
	selectedModel: ModelConfig;
	provider: AIModelProvider;
	promptService: PromptService;
}

export class GenerationService {
	constructor(
		private app: App,
		private youtubeService: YouTubeService,
		private settings: PluginSettings,
		private onStatusBar: (message: string | null) => void,
	) { }

	async executeRun(run: QueuedRun, signal: AbortSignal): Promise<QueueRunReportEntry> {
		const progressState: ProgressState = {
			target: null,
			url: run.url,
			hasProgressContent: false,
		};

		try {
			let effectiveOptions = run.options;
			const aiContext = this.buildAiExecutionContext(effectiveOptions);
			this.validateGenerationOptions(run.url, effectiveOptions, aiContext);

			const initialTarget = await this.resolveInitialTarget(run);

			// When multi-URL paste coerces a `current-note` target to append-end,
			// effectiveOptions.noteDestinationMode stays 'current-note' but runtime
			// behavior must be append mode. Normalize here so the rendering (H1→H2
			// fragment), rename-suppression, and progress-write branches all fire
			// correctly. Does not affect single-URL current-note (mode='replace-range').
			if (run.initialTargetRef?.mode === 'append-end' && effectiveOptions.noteDestinationMode === 'current-note') {
				effectiveOptions = { ...effectiveOptions, noteDestinationMode: 'append-to-active-note' };
			}

			if (YouTubeService.isPlaylistUrl(run.url)) {
				const { playlist, notePath, entries } = await this.generatePlaylistNotes(
					run.url, initialTarget, effectiveOptions, aiContext, progressState, signal,
				);
				const outcome = entries.some((e) => e.outcome === 'completed') ? 'completed'
					: entries.some((e) => e.outcome === 'failed') ? 'failed'
						: entries.some((e) => e.outcome === 'skipped') ? 'skipped'
							: 'canceled';
				return {
					kind: 'playlist',
					runId: run.id,
					batchId: run.batchId,
					ordinal: run.ordinal,
					url: run.url,
					displayTitle: run.displayTitle,
					playlistTitle: playlist.title,
					playlistUrl: run.url,
					outcome,
					notePath: notePath ?? undefined,
					entries,
				};
			}

			const { notePath, transcriptLanguageCode, warnings } = await this.generateSingleVideoNote(
				run.url, initialTarget, effectiveOptions, aiContext, progressState, signal,
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
					await this.upsertProgressContent(
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
		const baseName = this.getReportBaseName(report);
		const target = await this.createNewTarget(folderPath, baseName);
		await this.writeContentToTarget(target, `# Queue Run Report\n\n${rendered}`);
		target.finalized = true;
	}

	private buildAiExecutionContext(effectiveOptions: GenerationOptions): AiExecutionContext | null {
		if (!effectiveOptions.generateAiSummary) {
			return null;
		}

		const selectedModel = this.resolveSelectedModel(effectiveOptions.modelId);
		if (!selectedModel) {
			throw new Error('No AI model selected. Please select a model in the plugin settings or in the generation modal.');
		}

		if (!selectedModel.provider.apiKey && selectedModel.provider.type !== 'openai' && selectedModel.provider.type !== 'openai-compatible') {
			throw new Error(`${selectedModel.provider.name} requires an API key. Please set it in the plugin settings.`);
		}

		const provider = this.createProvider(
			selectedModel,
			effectiveOptions,
		);

		return {
			selectedModel,
			provider,
			promptService: this.createPromptService(this.createInstructionConfig(effectiveOptions)),
		};
	}

	private validateGenerationOptions(url: string, effectiveOptions: GenerationOptions, aiContext: AiExecutionContext | null): void {
		if (!effectiveOptions.generateAiSummary && effectiveOptions.transcriptMode === 'none') {
			throw new Error('Enable transcript inclusion or AI summary. Both cannot be off.');
		}

		if (YouTubeService.isPlaylistUrl(url) && effectiveOptions.playlistMode === 'combined' && !aiContext) {
			throw new Error('Combined playlist notes require AI summary generation. Use per-video mode for transcript-only runs.');
		}
	}

	private resolveSelectedModel(modelId?: string): ModelConfig | null {
		if (!modelId) {
			return null;
		}
		return this.settings.getModels().find((model) => buildModelId(model) === modelId) ?? null;
	}

	private createProvider(
		selectedModel: ModelConfig,
		effectiveOptions: GenerationOptions,
	): AIModelProvider {
		const effectiveTimeoutMs = effectiveOptions.requestTimeoutMs ?? this.settings.getRequestTimeoutMs();
		const effectiveTemperature = effectiveOptions.temperature ?? this.settings.getTemperature();

		return ProvidersFactory.createProvider(
			selectedModel,
			effectiveTemperature,
			effectiveTimeoutMs,
		);
	}

	private createInstructionConfig(effectiveOptions: GenerationOptions): InstructionConfig {
		const savedInstructionConfig = this.settings.getInstructionConfig();
		return {
			mode: effectiveOptions.instructionMode ?? savedInstructionConfig.mode,
			template: effectiveOptions.instructionTemplate ?? savedInstructionConfig.template,
			manualInstructions: effectiveOptions.manualInstructions ?? savedInstructionConfig.manualInstructions,
			includeMindmap: effectiveOptions.includeMindmap ?? savedInstructionConfig.includeMindmap,
			includeMemorableQuotes: effectiveOptions.includeMemorableQuotes ?? savedInstructionConfig.includeMemorableQuotes,
			controlValues: effectiveOptions.controlValues,
		};
	}

	private createPromptService(instructionConfig: InstructionConfig): PromptService {
		return new PromptService(instructionConfig);
	}

	private async summarizeTranscript(
		aiContext: AiExecutionContext,
		transcript: TranscriptResponse,
		url: string,
		target: NoteInsertionTarget,
		progressState: ProgressState,
		signal: AbortSignal,
	): Promise<string> {
		const chunks = aiContext.promptService.splitTranscript(transcript, url, {
			model: aiContext.selectedModel,
		});

		if (chunks.length <= 1) {
			if (signal.aborted) throw signal.reason;
			if (progressState.hasProgressContent) {
				await this.upsertProgressContent(target, url, 'Generating summary...');
			}
			this.onStatusBar('Generating summary...');
			return aiContext.provider.summarizeVideo(aiContext.promptService.buildPrompt(transcript, url), signal);
		}

		const chunkSummaries: string[] = [];
		for (const [index, chunk] of chunks.entries()) {
			if (signal.aborted) throw signal.reason;
			if (progressState.hasProgressContent) {
				await this.upsertProgressContent(target, url, `Summarizing transcript chunk ${index + 1}/${chunks.length}...`);
			}
			this.onStatusBar(`Summarizing chunk ${index + 1}/${chunks.length}...`);
			chunkSummaries.push(
				await aiContext.provider.summarizeVideo(
					aiContext.promptService.buildChunkPrompt(transcript, url, chunk, index + 1, chunks.length),
					signal,
				),
			);
		}

		if (signal.aborted) throw signal.reason;
		if (progressState.hasProgressContent) {
			await this.upsertProgressContent(target, url, 'Combining chunk summaries...');
		}
		this.onStatusBar('Combining chunk summaries...');
		return aiContext.provider.summarizeVideo(
			aiContext.promptService.buildSynthesisPrompt(transcript, url, chunkSummaries),
			signal,
		);
	}

	private getSafeBaseName(baseName: string, fallbackName: string): string {
		return sanitizeNoteFileName(baseName) || fallbackName;
	}

	private getSingleVideoBaseName(transcript: TranscriptResponse, options: GenerationOptions): string {
		if (options.useVideoTitleAsNoteName) {
			return this.getSafeBaseName(transcript.title, 'Video Note');
		}
		return 'Video Note';
	}

	private getCombinedPlaylistBaseName(playlist: PlaylistResponse, options: GenerationOptions): string {
		if (options.useVideoTitleAsNoteName) {
			return this.getSafeBaseName(playlist.title, 'Playlist Note');
		}
		return 'Playlist Note';
	}

	private getPerVideoBaseName(
		playlist: PlaylistResponse,
		transcript: TranscriptResponse,
		index: number,
		options: GenerationOptions,
	): string {
		if (options.useVideoTitleAsNoteName) {
			return this.getSafeBaseName(transcript.title, formatSequenceName('Playlist Video', index, playlist.entries.length));
		}
		const prefix = this.getSafeBaseName(playlist.title, 'Playlist Video');
		return formatSequenceName(prefix, index, playlist.entries.length);
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		const normalizedPath = normalizeVaultFolderPath(folderPath);
		if (!normalizedPath) {
			return;
		}
		let currentPath = '';
		for (const segment of normalizedPath.split('/')) {
			currentPath = currentPath ? `${currentPath}/${segment}` : segment;
			if (!this.app.vault.getAbstractFileByPath(currentPath)) {
				await this.app.vault.createFolder(currentPath);
			}
		}
	}

	private async createNewTarget(directoryPath: string, baseName: string, extension = 'md'): Promise<NoteInsertionTarget> {
		await this.ensureFolderExists(directoryPath);
		const targetPath = resolveUniqueNotePath(
			directoryPath,
			this.getSafeBaseName(baseName, 'Untitled'),
			extension,
			'',
			(path) => this.app.vault.getAbstractFileByPath(path) !== null,
		);
		const file = await this.app.vault.create(targetPath, '');
		return {
			file,
			fromOffset: 0,
			toOffset: 0,
			jobId: createJobId(),
			createdByPlugin: true,
			finalized: false,
		};
	}

	private async createAdjacentTarget(referenceFile: TFile, baseName: string): Promise<NoteInsertionTarget> {
		return this.createNewTarget(referenceFile.parent?.path ?? '', baseName, referenceFile.extension);
	}

	private async createFolderTarget(folderPath: string, baseName: string): Promise<NoteInsertionTarget> {
		return this.createNewTarget(normalizeVaultFolderPath(folderPath), baseName);
	}

	private async deleteTargetIfDisposable(target: NoteInsertionTarget | null): Promise<void> {
		if (!target || !target.createdByPlugin || target.finalized) {
			return;
		}
		try {
			await this.app.fileManager.trashFile(target.file);
		} catch (error) {
			console.warn('Failed to delete temporary note:', error);
		}
	}

	private getMarkers(target: NoteInsertionTarget): ProgressMarkers {
		return buildProgressMarkers(target.jobId);
	}

	private replaceMarkedContent(target: NoteInsertionTarget, data: string, content: string): string {
		return replaceMarkedContent(this.getMarkers(target), data, content, {
			start: target.fromOffset,
			end: target.toOffset,
		});
	}

	private async upsertProgressContent(
		target: NoteInsertionTarget,
		url: string,
		status: string,
		kind: 'info' | 'failure' = 'info',
		errorMessage?: string,
	): Promise<void> {
		const content = buildProgressContent(this.getMarkers(target), { url, status, kind, errorMessage });
		await this.app.vault.process(target.file, (data) => this.replaceMarkedContent(target, data, content));
	}

	private async writeContentToTarget(target: NoteInsertionTarget, content: string): Promise<void> {
		await this.app.vault.process(target.file, (data) => this.replaceMarkedContent(target, data, content));
	}

	private async appendContentToTarget(target: NoteInsertionTarget, content: string): Promise<void> {
		await this.app.vault.process(target.file, (data) => {
			const trimmed = data.trimEnd();
			const isPlaceholderProgress = target.createdByPlugin && !target.finalized && trimmed.length === 0;
			const existingContent = isPlaceholderProgress ? '' : trimmed;
			const prefix = existingContent ? `${existingContent}\n\n` : '';
			return `${prefix}${content}`;
		});
	}

	private async showProgress(target: NoteInsertionTarget, url: string, status: string, progressState: ProgressState): Promise<void> {
		progressState.target = target;
		progressState.url = url;
		progressState.hasProgressContent = true;
		await this.upsertProgressContent(target, url, status);
	}

	private isCancellationError(error: unknown, signal: AbortSignal): boolean {
		return isAbortError(error, signal);
	}

	private async renameTargetNote(target: NoteInsertionTarget, title: string): Promise<void> {
		const baseName = sanitizeNoteFileName(title);
		if (!baseName) {
			new Notice('Knowledge note generated, but skipped renaming because the title is not a valid note name.');
			return;
		}

		const directoryPath = target.file.parent?.path ?? '';
		const nextPath = resolveUniqueNotePath(
			directoryPath,
			baseName,
			target.file.extension,
			target.file.path,
			(path) => this.app.vault.getAbstractFileByPath(path) !== null,
		);

		if (nextPath === target.file.path) {
			return;
		}

		await this.app.fileManager.renameFile(target.file, nextPath);
	}

	private async finalizeTargetNote(
		target: NoteInsertionTarget,
		content: string,
		titleToRenameTo: string | null,
		progressState: ProgressState,
	): Promise<void> {
		await this.showProgress(target, progressState.url, 'Rendering note...', progressState);
		this.onStatusBar('Rendering note...');
		await this.writeContentToTarget(target, content);

		if (titleToRenameTo) {
			try {
				await this.renameTargetNote(target, titleToRenameTo);
			} catch (renameError) {
				new Notice(`Knowledge note generated, but failed to rename note: ${getErrorMessage(renameError)}`);
				console.error('Failed to rename generated note:', renameError);
			}
		}

		target.finalized = true;
		progressState.hasProgressContent = false;
	}

	private async fetchTranscriptForUrl(url: string, effectiveOptions: GenerationOptions, signal: AbortSignal): Promise<TranscriptFetchResult> {
		if (signal.aborted) throw signal.reason;
		const result = await this.youtubeService.fetchTranscript(url, this.getTranscriptFetchOptions(effectiveOptions));
		if (signal.aborted) throw signal.reason;
		return result;
	}

	private getTranscriptFetchOptions(effectiveOptions: GenerationOptions): {
		languageMode?: GenerationOptions['transcriptLanguageMode'];
		preferredLanguageCode?: string;
	} {
		return {
			languageMode: effectiveOptions.transcriptLanguageMode,
			preferredLanguageCode: effectiveOptions.preferredTranscriptLanguage,
		};
	}

	private buildPlaylistReportEntry(
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

	private classifyPlaylistEntryError(
		error: unknown,
		options: Pick<GenerationOptions, 'transcriptFailureMode'>,
		signal: AbortSignal,
	): { kind: 'cancel' | 'transcript-skip' | 'transcript-fail' | 'other'; message: string } {
		const message = getErrorMessage(error);
		if (this.isCancellationError(error, signal)) {
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

	private appendCanceledEntries(entries: PlaylistEntry[], reportEntries: PlaylistRunReportEntry[], startIndex: number): void {
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

	private async generateSingleVideoToTarget(
		url: string,
		target: NoteInsertionTarget,
		transcript: TranscriptResponse,
		effectiveOptions: GenerationOptions,
		aiContext: AiExecutionContext | null,
		progressState: ProgressState,
		titleToRenameTo: string | null,
		signal: AbortSignal,
	): Promise<string[]> {
		progressState.target = target;
		progressState.url = url;
		const isAppendMode = effectiveOptions.noteDestinationMode === 'append-to-active-note';
		if (!isAppendMode) {
			progressState.hasProgressContent = true;
		}

		const thumbnailUrl = YouTubeService.getThumbnailUrl(transcript.videoId);
		const summary = aiContext
			? await this.summarizeTranscript(aiContext, transcript, url, target, progressState, signal)
			: null;

		const template = effectiveOptions.instructionMode === 'manual'
			? null
			: getTemplate(effectiveOptions.instructionTemplate ?? this.settings.getInstructionConfig().template);
		const { content, warnings } = renderVideoNote(transcript, thumbnailUrl, url, summary, effectiveOptions, template, isAppendMode ? 'fragment' : 'standalone');
		for (const warning of warnings) {
			if (warning.toLowerCase().includes('required section')) {
				new Notice(`Note generated with warning: ${warning}`);
			}
		}
		if (isAppendMode) {
			this.onStatusBar('Rendering note...');
			await this.appendContentToTarget(target, content);
			target.finalized = true;
		} else {
			await this.finalizeTargetNote(target, content, titleToRenameTo, progressState);
		}
		return warnings;
	}

	private async generateSingleVideoNote(
		url: string,
		initialTarget: NoteInsertionTarget | null,
		effectiveOptions: GenerationOptions,
		aiContext: AiExecutionContext | null,
		progressState: ProgressState,
		signal: AbortSignal,
	): Promise<{ notePath: string | null; transcriptLanguageCode: string | undefined; warnings: string[] }> {
		let target: NoteInsertionTarget | null = initialTarget;
		let titleToRenameTo: string | null = null;

		if (effectiveOptions.noteDestinationMode === 'current-note') {
			if (!target) {
				throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
			}
			await this.showProgress(target, url, 'Fetching transcript...', progressState);
		} else if (effectiveOptions.noteDestinationMode === 'append-to-active-note') {
			if (!target) {
				throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
			}
			// Skip showProgress — do not write progress markers into the user's existing note
		}

		this.onStatusBar('Fetching transcript…');
		new Notice('Fetching video transcript…');
		const transcriptResult = await this.fetchTranscriptForUrl(url, effectiveOptions, signal);
		const transcript = transcriptResult.transcript;

		if (effectiveOptions.noteDestinationMode === 'folder') {
			target = await this.createFolderTarget(
				effectiveOptions.noteDestinationFolder ?? '',
				this.getSingleVideoBaseName(transcript, effectiveOptions),
			);
		} else if (effectiveOptions.noteDestinationMode !== 'append-to-active-note' && effectiveOptions.useVideoTitleAsNoteName) {
			titleToRenameTo = transcript.title;
		}

		if (aiContext) {
			new Notice('Generating summary…');
		}

		if (!target) {
			throw new Error('Internal error: missing note target.');
		}

		let warnings: string[];
		try {
			warnings = await this.generateSingleVideoToTarget(
				url, target, transcript, effectiveOptions, aiContext, progressState, titleToRenameTo, signal,
			);
		} catch (error) {
			await this.deleteTargetIfDisposable(target);
			throw error;
		}

		new Notice(aiContext ? 'Knowledge note generated.' : 'Transcript note generated.');
		return { notePath: target.file.path, transcriptLanguageCode: transcriptResult.languageCode, warnings };
	}

	private async generateCombinedPlaylistNote(
		playlist: PlaylistResponse,
		initialTarget: NoteInsertionTarget | null,
		effectiveOptions: GenerationOptions,
		aiContext: AiExecutionContext | null,
		progressState: ProgressState,
		signal: AbortSignal,
	): Promise<{ notePath: string | null; entries: PlaylistRunReportEntry[] }> {
		if (!aiContext) {
			throw new Error('Combined playlist notes require AI summary generation.');
		}

		if ((effectiveOptions.noteDestinationMode === 'current-note' || effectiveOptions.noteDestinationMode === 'append-to-active-note') && !initialTarget) {
			throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
		}
		const isAppendMode = effectiveOptions.noteDestinationMode === 'append-to-active-note';
		const target: NoteInsertionTarget = effectiveOptions.noteDestinationMode === 'folder'
			? await this.createFolderTarget(
				effectiveOptions.noteDestinationFolder ?? '',
				this.getCombinedPlaylistBaseName(playlist, effectiveOptions),
			)
			: initialTarget!;

		const titleToRenameTo = effectiveOptions.noteDestinationMode === 'current-note' && effectiveOptions.useVideoTitleAsNoteName
			? playlist.title
			: null;

		const transcripts: TranscriptResponse[] = [];
		const videoSummaries: Array<{ transcript: TranscriptResponse; summary: string }> = [];
		const reportEntries: PlaylistRunReportEntry[] = [];

		for (const [index, entry] of playlist.entries.entries()) {
			if (signal.aborted) {
				this.appendCanceledEntries(playlist.entries, reportEntries, index);
				break;
			}

			try {
				if (!isAppendMode) {
					await this.showProgress(target, entry.url, `Fetching transcript ${index + 1}/${playlist.entries.length}...`, progressState);
				}
				this.onStatusBar(`Fetching playlist transcript ${index + 1}/${playlist.entries.length}...`);
				const transcriptResult = await this.fetchTranscriptForUrl(entry.url, effectiveOptions, signal);
				const transcript = transcriptResult.transcript;

				if (!isAppendMode) {
					await this.showProgress(target, entry.url, `Summarizing playlist video ${index + 1}/${playlist.entries.length}...`, progressState);
				}
				this.onStatusBar(`Summarizing playlist video ${index + 1}/${playlist.entries.length}...`);
				const summary = await this.summarizeTranscript(aiContext, transcript, entry.url, target, progressState, signal);

				transcripts.push(transcript);
				videoSummaries.push({ transcript, summary });
				reportEntries.push(this.buildPlaylistReportEntry(entry, 'completed', {
					title: transcript.title,
					transcriptLanguageCode: transcriptResult.languageCode,
				}));
			} catch (error) {
				const classified = this.classifyPlaylistEntryError(error, effectiveOptions, signal);
				if (classified.kind === 'cancel') {
					reportEntries.push(this.buildPlaylistReportEntry(entry, 'canceled', { reason: classified.message }));
					this.appendCanceledEntries(playlist.entries, reportEntries, index + 1);
					break;
				}
				if (classified.kind === 'transcript-fail') {
					throw error;
				}
				reportEntries.push(this.buildPlaylistReportEntry(
					entry,
					classified.kind === 'transcript-skip' ? 'skipped' : 'failed',
					{ reason: classified.message },
				));
			}
		}

		if (signal.aborted) {
			await this.deleteTargetIfDisposable(target);
			const completed = reportEntries.filter((e) => e.outcome === 'completed').length;
			const canceled = reportEntries.filter((e) => e.outcome === 'canceled').length;
			new Notice(`Playlist generation canceled (${completed} completed, ${canceled} canceled).`);
			return { notePath: null, entries: reportEntries };
		}

		if (videoSummaries.length === 0) {
			await this.deleteTargetIfDisposable(target);
			throw new Error('No playlist videos could be summarized.');
		}

		if (!isAppendMode) {
			await this.showProgress(target, playlist.url, 'Generating combined playlist summary...', progressState);
		}
		this.onStatusBar('Generating combined playlist summary...');

		let summary: string;
		try {
			summary = await aiContext.provider.summarizeVideo(
				aiContext.promptService.buildPlaylistSynthesisPrompt({ ...playlist, transcripts }, videoSummaries),
				signal,
			);
		} catch (error) {
			if (isAbortError(error, signal)) {
				await this.deleteTargetIfDisposable(target);
				const completed = reportEntries.filter((e) => e.outcome === 'completed').length;
				const canceled = reportEntries.filter((e) => e.outcome === 'canceled').length;
				new Notice(`Playlist generation canceled (${completed} completed, ${canceled} canceled).`);
				return { notePath: null, entries: reportEntries };
			}
			throw error;
		}

		const playlistWithTranscripts: PlaylistTranscriptResponse = { ...playlist, transcripts };
		const thumbnailUrl = transcripts[0] ? YouTubeService.getThumbnailUrl(transcripts[0].videoId) : null;
		const template = effectiveOptions.instructionMode === 'manual'
			? null
			: getTemplate(effectiveOptions.instructionTemplate ?? this.settings.getInstructionConfig().template);
		const { content } = renderPlaylistNote(playlistWithTranscripts, thumbnailUrl, summary, effectiveOptions, template, isAppendMode ? 'fragment' : 'standalone');
		if (isAppendMode) {
			this.onStatusBar('Rendering note...');
			await this.appendContentToTarget(target, content);
			target.finalized = true;
		} else {
			await this.finalizeTargetNote(target, content, titleToRenameTo, progressState);
		}

		const notePath = target.file.path;
		const finalEntries = reportEntries.map((e) => (e.outcome === 'completed' ? { ...e, notePath } : e));
		const completed = finalEntries.filter((e) => e.outcome === 'completed').length;
		const skipped = finalEntries.filter((e) => e.outcome === 'skipped').length;
		const failed = finalEntries.filter((e) => e.outcome === 'failed').length;
		new Notice(`Playlist note generated (${completed} completed, ${skipped} skipped, ${failed} failed).`);
		return { notePath, entries: finalEntries };
	}

	private async generatePerVideoPlaylistNotes(
		playlist: PlaylistResponse,
		initialTarget: NoteInsertionTarget | null,
		effectiveOptions: GenerationOptions,
		aiContext: AiExecutionContext | null,
		progressState: ProgressState,
		signal: AbortSignal,
	): Promise<PlaylistRunReportEntry[]> {
		if (effectiveOptions.noteDestinationMode === 'append-to-active-note') {
			throw new Error('Append to active note is not supported with per-video playlist mode. Switch to "Combined" playlist mode or choose a different destination.');
		}

		const reportEntries: PlaylistRunReportEntry[] = [];

		for (const [index, entry] of playlist.entries.entries()) {
			if (signal.aborted) {
				this.appendCanceledEntries(playlist.entries, reportEntries, index);
				break;
			}

			let target: NoteInsertionTarget | null = null;
			let titleToRenameTo: string | null = null;

			try {
				if (effectiveOptions.noteDestinationMode === 'current-note' && index === 0) {
					if (!initialTarget) {
						throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
					}
					target = initialTarget;
					await this.showProgress(target, entry.url, 'Fetching transcript...', progressState);
				}

				this.onStatusBar(`Fetching playlist transcript ${index + 1}/${playlist.entries.length}...`);
				const transcriptResult = await this.fetchTranscriptForUrl(entry.url, effectiveOptions, signal);
				const transcript = transcriptResult.transcript;

				if (!target) {
					const baseName = this.getPerVideoBaseName(playlist, transcript, index + 1, effectiveOptions);
					if (effectiveOptions.noteDestinationMode === 'folder') {
						target = await this.createFolderTarget(effectiveOptions.noteDestinationFolder ?? '', baseName);
					} else {
						if (!initialTarget) {
							throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
						}
						target = await this.createAdjacentTarget(initialTarget.file, baseName);
					}
				} else if (effectiveOptions.useVideoTitleAsNoteName) {
					titleToRenameTo = transcript.title;
				}

				const videoWarnings = await this.generateSingleVideoToTarget(
					entry.url, target, transcript, effectiveOptions, aiContext, progressState, titleToRenameTo, signal,
				);

				reportEntries.push(this.buildPlaylistReportEntry(entry, 'completed', {
					title: transcript.title,
					transcriptLanguageCode: transcriptResult.languageCode,
					notePath: target.file.path,
					warnings: videoWarnings.length > 0 ? videoWarnings : undefined,
				}));
			} catch (error) {
				const classified = this.classifyPlaylistEntryError(error, effectiveOptions, signal);
				if (classified.kind === 'cancel') {
					await this.deleteTargetIfDisposable(target);
					reportEntries.push(this.buildPlaylistReportEntry(entry, 'canceled', { reason: classified.message }));
					this.appendCanceledEntries(playlist.entries, reportEntries, index + 1);
					break;
				}
				await this.deleteTargetIfDisposable(target);
				if (classified.kind === 'transcript-fail') {
					throw error;
				}
				reportEntries.push(this.buildPlaylistReportEntry(
					entry,
					classified.kind === 'transcript-skip' ? 'skipped' : 'failed',
					{ reason: classified.message },
				));
			}
		}

		const completed = reportEntries.filter((e) => e.outcome === 'completed').length;
		const skipped = reportEntries.filter((e) => e.outcome === 'skipped').length;
		const failed = reportEntries.filter((e) => e.outcome === 'failed').length;
		const canceled = reportEntries.filter((e) => e.outcome === 'canceled').length;
		if (signal.aborted) {
			new Notice(`Playlist generation canceled (${completed} completed, ${canceled} canceled).`);
		} else {
			new Notice(`Playlist generation finished (${completed} completed, ${skipped} skipped, ${failed} failed).`);
		}
		return reportEntries;
	}

	private async generatePlaylistNotes(
		url: string,
		initialTarget: NoteInsertionTarget | null,
		effectiveOptions: GenerationOptions,
		aiContext: AiExecutionContext | null,
		progressState: ProgressState,
		signal: AbortSignal,
	): Promise<{ playlist: PlaylistResponse; notePath: string | null; entries: PlaylistRunReportEntry[] }> {
		if (effectiveOptions.noteDestinationMode === 'current-note') {
			if (!initialTarget) {
				throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
			}
			await this.showProgress(initialTarget, url, 'Fetching playlist...', progressState);
		} else if (effectiveOptions.noteDestinationMode === 'append-to-active-note') {
			if (!initialTarget) {
				throw new Error(INSERT_AT_CARET_REQUIRES_NOTE);
			}
			// Skip showProgress — do not write progress markers into the user's existing note
		}

		this.onStatusBar('Fetching playlist…');
		new Notice('Fetching playlist videos…');
		const playlist = await this.youtubeService.fetchPlaylist(url);

		if (effectiveOptions.noteDestinationMode === 'folder') {
			await this.ensureFolderExists(effectiveOptions.noteDestinationFolder ?? '');
		}

		if (effectiveOptions.playlistMode === 'combined') {
			const { notePath, entries } = await this.generateCombinedPlaylistNote(
				playlist, initialTarget, effectiveOptions, aiContext, progressState, signal,
			);
			return { playlist, notePath, entries };
		}

		const entries = await this.generatePerVideoPlaylistNotes(
			playlist, initialTarget, effectiveOptions, aiContext, progressState, signal,
		);
		return { playlist, notePath: null, entries };
	}

	private async resolveInitialTarget(run: QueuedRun): Promise<NoteInsertionTarget | null> {
		const ref = run.initialTargetRef;
		if (!ref) return null;

		const file = this.app.vault.getAbstractFileByPath(ref.filePath);
		if (!(file instanceof TFile)) {
			throw new Error(`Target note not found: ${ref.filePath}`);
		}

		if (ref.mode === 'append-end') {
			const fileContent = await this.app.vault.cachedRead(file);
			return {
				file,
				fromOffset: fileContent.length,
				toOffset: fileContent.length,
				jobId: createJobId(),
				createdByPlugin: ref.createdByPlugin,
				finalized: false,
			};
		}

		return {
			file,
			fromOffset: ref.fromOffset ?? 0,
			toOffset: ref.toOffset ?? 0,
			jobId: createJobId(),
			createdByPlugin: ref.createdByPlugin,
			finalized: false,
		};
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

	private getReportBaseName(report: QueueBatchReport): string {
		const firstEntry = report.entries[0];
		if (firstEntry) {
			return this.getSafeBaseName(`${firstEntry.displayTitle} Queue Run Report`, 'Queue Run Report');
		}
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}${pad(now.getMinutes())}`;
		return `Queue Run Report ${dateStr}`;
	}
}
