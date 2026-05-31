import { Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import {
	GenerationOptions,
	PluginSettings,
} from './types';

import { SettingsTab } from './ui/settings';
import { notifyError } from './ui/notifications';
import { YouTubeService } from './services/youtube';
import { SettingsService } from './services/settings';
import {
	GenerationService,
	INSERT_AT_CARET_REQUIRES_NOTE,
	NoteInsertionTarget,
} from './services/generation';
import { GenerationOptionsModal } from './ui/modals/GenerationOptionsModal';
import { QueueModal } from './ui/modals/QueueModal';
import { WhatsNewModal } from './ui/modals/WhatsNewModal';
import { resolveReleaseNotesStartupAction } from './release-notes';
import {
	buildModelId,
	createJobId,
} from './utils';
import {
	BatchTargetPolicy,
	QueuedRunInsertionTargetRef,
	RunQueueEvent,
	RunQueueService,
	buildEditorAppendSequentialPolicy,
	buildEditorReplaceRangeFirstPolicy,
	buildFolderTargetPolicy,
} from './services/runQueue';
export class YTKN extends Plugin {
	settings!: PluginSettings;
	private youtubeService!: YouTubeService;
	private generationService!: GenerationService;
	private statusBarEl?: HTMLElement;
	private runQueue!: RunQueueService;

	async onload(): Promise<void> {
		try {
			await this.initializeServices();
			this.initializeStatusBar();
			this.addSettingTab(new SettingsTab(this.app, this));
			this.registerCommands();
			window.setTimeout(() => {
				void this.showReleaseNotesIfUpdated();
			}, 0);
		} catch (error) {
			notifyError('YT Knowledge Notes failed to load', error);
		}
	}

	onunload(): void {
		this.runQueue?.cancelAll();
		this.statusBarEl?.detach();
		this.statusBarEl = undefined;
	}

	public async initializeServices(): Promise<void> {
		this.settings = new SettingsService(this);
		await this.settings.loadSettings();
		this.youtubeService = new YouTubeService();
		this.generationService = new GenerationService(
			this.app,
			this.youtubeService,
			this.settings,
			(message) => this.setStatusBar(message),
		);
		this.runQueue = new RunQueueService({
			executeRun: (run, signal) => this.generationService.executeRun(run, signal),
			resolveTitle: (run, signal) => this.generationService.resolveTitle(run, signal),
			persistBatchReport: (batch, report) => this.generationService.persistBatchReport(batch, report),
		});
		this.runQueue.on((event) => this.onQueueEvent(event));
	}

	private registerCommands(): void {
		this.addCommand({
			id: 'generate-video-knowledge-note',
			name: 'Generate knowledge note',
			callback: async () => {
				try {
					const context = await this.captureInsertionTargetFromActiveView();
					this.openGenerationModal(
						context?.target ?? null,
						context?.selectedText ?? '',
					);
				} catch (error) {
					notifyError('Could not start generation', error);
				}
			},
		});

		this.addCommand({
			id: 'cancel-all-generations',
			name: 'Cancel all generations',
			callback: () => {
				const snap = this.runQueue.getSnapshot();
				if (!snap.current && snap.queued.length === 0) {
					new Notice('Nothing to cancel.');
					return;
				}
				this.runQueue.cancelAll();
				new Notice('Cancel requested. Waiting for the running step to stop.');
			},
		});

		this.addCommand({
			id: 'manage-knowledge-note-queue',
			name: 'Manage queue',
			callback: () => {
				new QueueModal(this.app, this.runQueue).open();
			},
		});
	}

	private async showReleaseNotesIfUpdated(): Promise<void> {
		try {
			const currentVersion = this.manifest.version;
			const action = resolveReleaseNotesStartupAction({
				currentVersion,
				hasSavedSettings: this.settings.hasSavedSettings(),
				lastSeenVersion: this.settings.getLastSeenReleaseNotesVersion(),
			});

			if (action.kind === 'none') {
				return;
			}

			await this.settings.setLastSeenReleaseNotesVersion(currentVersion);

			if (action.kind === 'show') {
				new WhatsNewModal(this.app, currentVersion, action.notes).open();
			}
		} catch (error) {
			console.warn('Could not show release notes:', error);
		}
	}

	private getInitialGenerationOptions(): GenerationOptions {
		const outputDefaults = this.settings.getOutputDefaults();
		const instructionConfig = this.settings.getInstructionConfig();
		const selectedModel = this.settings.getSelectedModel();

		return {
			useAi: outputDefaults.useAi,
			generateAiSummary: outputDefaults.generateAiSummary,
			transcriptMode: outputDefaults.transcriptMode,
			playlistMode: outputDefaults.playlistMode,
			transcriptLanguageMode: outputDefaults.transcriptLanguageMode,
			preferredTranscriptLanguage: outputDefaults.preferredTranscriptLanguage,
			transcriptFailureMode: outputDefaults.transcriptFailureMode,
			mediaEmbedMode: outputDefaults.mediaEmbedMode,
			includeRunReport: outputDefaults.includeRunReport,
			runReportLocation: outputDefaults.runReportLocation,
			useVideoTitleAsNoteName: outputDefaults.useVideoTitleAsNoteName,
			noteDestinationMode: outputDefaults.noteDestinationMode,
			noteDestinationFolder: outputDefaults.noteDestinationFolder,
			includeFrontmatter: outputDefaults.includeFrontmatter,
			frontmatterTags: outputDefaults.frontmatterTags,
			frontmatterPropertyAllowlist: outputDefaults.frontmatterPropertyAllowlist,
			sourceSectionPosition: outputDefaults.sourceSectionPosition,
			linkTimestamps: outputDefaults.linkTimestamps,
			tldrCalloutAtTop: outputDefaults.tldrCalloutAtTop,
			modelId: selectedModel ? buildModelId(selectedModel) : undefined,
			instructionMode: instructionConfig.mode,
			instructionTemplate: instructionConfig.template,
			manualInstructions: instructionConfig.manualInstructions,
			includeMindmap: instructionConfig.includeMindmap,
			includeMemorableQuotes: instructionConfig.includeMemorableQuotes,
			controlValues: instructionConfig.controlValues,
			temperature: this.settings.getTemperature(),
			requestTimeoutMs: this.settings.getRequestTimeoutMs(),
		};
	}

	private openGenerationModal(target: NoteInsertionTarget | null, selectedText: string): void {
		const initialUrl = YouTubeService.isYouTubeUrl(selectedText) ? selectedText : '';
		const hasActiveNote = target !== null;

		new GenerationOptionsModal(
			this.app,
			initialUrl,
			this.settings.getModels(),
			this.getInitialGenerationOptions(),
			(urls, options) => {
				const classifications = YouTubeService.classifyUrls(urls);
				const invalidIdx = classifications.indexOf('invalid');
				if (invalidIdx >= 0) {
					new Notice(`URL #${invalidIdx + 1} is not a YouTube link: ${urls[invalidIdx]}`);
					return;
				}

				const validClassifications = classifications as Array<'video' | 'playlist'>;
				const targetPolicy = this.resolveBatchTargetPolicy(
					target,
					options,
					urls.length,
					validClassifications,
				);
				if (!targetPolicy) return;

				this.runQueue.enqueueBatch({
					urls: urls.map((url, i) => ({ url, kind: validClassifications[i] })),
					options,
					targetPolicy,
					reportPolicy: { include: options.includeRunReport ?? false, location: options.runReportLocation ?? 'generated-note' },
				});
			},
			hasActiveNote,
			this.manifest.version,
		).open();
	}

	private resolveBatchTargetPolicy(
		target: NoteInsertionTarget | null,
		options: GenerationOptions,
		urlCount: number,
		classifications: Array<'video' | 'playlist'>,
	): BatchTargetPolicy | null {
		if (options.noteDestinationMode === 'folder') {
			return buildFolderTargetPolicy();
		}
		if (!target) {
			new Notice(INSERT_AT_CARET_REQUIRES_NOTE);
			return null;
		}
		// Decision 9: hard-fail editor-target + per-video playlist mode + playlist URL in multi-URL batch
		if (urlCount > 1 && options.playlistMode === 'per-video' && classifications.includes('playlist')) {
			new Notice("Multi-URL paste with editor target can't include playlists in per-video mode. Switch playlist mode to combined, switch destination to a folder, or remove playlist links.");
			return null;
		}
		if (options.noteDestinationMode === 'current-note' && urlCount === 1) {
			const ref: QueuedRunInsertionTargetRef = {
				filePath: target.file.path,
				mode: 'replace-range',
				fromOffset: target.fromOffset,
				toOffset: target.toOffset,
				createdByPlugin: target.createdByPlugin,
			};
			return buildEditorReplaceRangeFirstPolicy(ref);
		}
		// append-to-active-note, or current-note with multiple URLs → sequential append
		return buildEditorAppendSequentialPolicy(target.file.path);
	}

	private initializeStatusBar(): void {
		try {
			this.statusBarEl = this.addStatusBarItem();
			this.statusBarEl.addClass('ytkn__status-bar--clickable');
			this.registerDomEvent(this.statusBarEl, 'click', () => this.onStatusBarClick());
			this.renderStatusBar();
		} catch (error) {
			console.warn('Status bar is unavailable:', error);
		}
	}

	private onStatusBarClick(): void {
		new QueueModal(this.app, this.runQueue).open();
	}

	private renderStatusBar(message?: string): void {
		if (!this.statusBarEl) return;
		this.statusBarEl.empty();

		const snap = this.runQueue?.getSnapshot();
		const current = snap?.current ?? null;
		const queuedCount = snap?.queued.length ?? 0;

		if (message) {
			this.statusBarEl.createSpan({ text: `YouTube · ${message}` });
			this.statusBarEl.show();
			return;
		}

		if (!current && queuedCount === 0) {
			this.statusBarEl.hide();
			return;
		}

		let text: string;
		if (current) {
			text = `YouTube · #${current.ordinal} · ${current.displayTitle} — ${current.statusMessage ?? 'Working…'}`;
			if (queuedCount > 0) text += ` (${queuedCount} queued)`;
		} else {
			text = `YouTube · ${queuedCount} queued`;
		}

		this.statusBarEl.createSpan({ text });
		this.statusBarEl.show();
	}

	private setStatusBar(message: string | null): void {
		this.renderStatusBar(message ?? undefined);
	}

	private async captureInsertionTargetFromActiveView(): Promise<{ target: NoteInsertionTarget; selectedText: string } | null> {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		const file = activeView?.file;
		if (!activeView || !file) {
			return null;
		}

		const editor = activeView.editor;
		if (editor) {
			return {
				target: this.captureInsertionTarget(editor, file),
				selectedText: editor.getSelection().trim(),
			};
		}

		const fileContent = await this.app.vault.cachedRead(file);
		return {
			target: {
				file,
				fromOffset: fileContent.length,
				toOffset: fileContent.length,
				jobId: createJobId(),
				createdByPlugin: false,
				finalized: false,
			},
			selectedText: '',
		};
	}

	private captureInsertionTarget(editor: Editor, file: TFile): NoteInsertionTarget {
		return {
			file,
			fromOffset: editor.posToOffset(editor.getCursor('from')),
			toOffset: editor.posToOffset(editor.getCursor('to')),
			jobId: createJobId(),
			createdByPlugin: false,
			finalized: false,
		};
	}

	private onQueueEvent(event: RunQueueEvent): void {
		if (event.type === 'finished' || event.type === 'cleared' || event.type === 'enqueued' || event.type === 'started' || event.type === 'removed') {
			this.renderStatusBar();
		}
	}
}

export default YTKN;
