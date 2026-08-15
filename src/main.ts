import type { Editor, TFile } from 'obsidian';
import { MarkdownView, Notice, Plugin } from 'obsidian';
import type {
	GenerationOptions,
	PluginSettings,
} from './types';

import { SettingsScreen } from './ui/settings/settingsScreen';
import { notifyError } from './ui/shared/notifications';
import { YouTubeService } from './youtube/youtubeService';
import { classifyUrls, extractUnsupportedChannelTab, isYouTubeUrl } from './youtube/urls';
import { SettingsService } from './settings/settingsService';
import { GenerationService } from './generation/generationService';
import { INSERT_AT_CARET_REQUIRES_NOTE } from './generation/constants';
import type { NoteInsertionTarget } from './generation/targets/noteTargets';
import { GenerationOptionsModal } from './ui/generation/generationOptionsModal';
import { QueueModal } from './ui/queue/queueModal';
import { WhatsNewModal } from './ui/releaseNotes/whatsNewModal';
import { resolveReleaseNotesStartupAction } from './releaseNotes';
import { serializeEnabledFrontmatterProperties } from './frontmatterProperties';
import { createJobId } from './utils';
import type {
	BatchTargetPolicy,
	QueuedRunInsertionTargetRef,
} from './queue/runQueueService';
import {
	RunQueueService,
	buildEditorAppendSequentialPolicy,
	buildEditorReplaceRangeFirstPolicy,
	buildFolderTargetPolicy,
} from './queue/runQueueService';
export class YTKN extends Plugin {
	settings!: PluginSettings;
	private youtubeService!: YouTubeService;
	private generationService!: GenerationService;
	private statusBarEl?: HTMLElement;
	private runQueue!: RunQueueService;
	private unloaded = false;

	async onload(): Promise<void> {
		this.unloaded = false;
		try {
			await this.initializeServices();
			this.initializeStatusBar();
			this.addSettingTab(new SettingsScreen(
				this.app,
				this,
				this.settings,
				() => this.openQueueModal(),
			));
			this.registerCommands();
			this.app.workspace.onLayoutReady(() => {
				if (!this.unloaded) {
					void this.showReleaseNotesIfUpdated();
				}
			});
		} catch (error) {
			notifyError('YT Knowledge Notes failed to load', error);
		}
	}

	onunload(): void {
		this.unloaded = true;
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
			onBatchFinalized: (batch) => this.generationService.onBatchFinalized(batch),
			onBatchReportError: (_batch, error) => notifyError("Couldn't save the report", error),
		});
		this.runQueue.on(() => this.renderStatusBar());
	}

	private registerCommands(): void {
		this.addCommand({
			id: 'generate-video-knowledge-note',
			name: 'Generate',
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
			id: 'cancel-all-queued',
			name: 'Cancel all runs',
			callback: () => {
				const snap = this.runQueue.getSnapshot();
				if (!snap.current && snap.queued.length === 0) {
					new Notice('Nothing to cancel.');
					return;
				}
				this.runQueue.cancelAll();
				new Notice('Cancel requested. The current step will stop as soon as possible.');
			},
		});

		this.addCommand({
			id: 'manage-knowledge-note-queue',
			name: 'Manage queue',
			callback: () => {
				this.openQueueModal();
			},
		});
	}

	public openQueueModal(): void {
		new QueueModal(this.app, this.runQueue).open();
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
		const { frontmatterProperties, ...outputDefaults } = this.settings.getOutputDefaults();
		const instructionConfig = this.settings.getInstructionConfig();
		const modelIds = this.settings.getModelIds();

		return {
			...outputDefaults,
			frontmatterPropertyAllowlist: serializeEnabledFrontmatterProperties(frontmatterProperties),
			modelIds,
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
		const initialUrl = isYouTubeUrl(selectedText) ? selectedText : '';
		const hasActiveNote = target !== null;

		new GenerationOptionsModal(
			this.app,
			initialUrl,
			this.settings.getModels(),
			this.getInitialGenerationOptions(),
			(urls, options) => {
				const classifications = classifyUrls(urls);
				const invalidIdx = classifications.indexOf('invalid');
				if (invalidIdx >= 0) {
					const unsupportedChannelTab = extractUnsupportedChannelTab(urls[invalidIdx]);
					new Notice(unsupportedChannelTab
						? `URL #${invalidIdx + 1} uses the unsupported channel tab "${unsupportedChannelTab}". Use a channel Home, Videos, Shorts, or Live link.`
						: `URL #${invalidIdx + 1} is not a supported YouTube link: ${urls[invalidIdx]}`);
					return;
				}

				const validClassifications = classifications as Array<'video' | 'playlist' | 'channel'>;
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
					reportPolicy: { include: options.includeReport ?? false, location: options.reportLocation ?? 'generated-note' },
				});
			},
			hasActiveNote,
			this.manifest.version,
			() => this.openQueueModal(),
		).open();
	}

	private resolveBatchTargetPolicy(
		target: NoteInsertionTarget | null,
		options: GenerationOptions,
		urlCount: number,
		classifications: Array<'video' | 'playlist' | 'channel'>,
	): BatchTargetPolicy | null {
		if (options.noteDestinationMode === 'folder') {
			return buildFolderTargetPolicy();
		}
		if (!target) {
			new Notice(INSERT_AT_CARET_REQUIRES_NOTE);
			return null;
		}
		if (urlCount > 1 && options.playlistMode === 'per-video' && classifications.some((kind) => kind === 'playlist' || kind === 'channel')) {
			new Notice('A multi-URL run cannot create one note per video from a playlist or channel when using the current note. Choose One combined note, choose Folder, or remove the playlist or channel URL.');
			return null;
		}
		if (options.noteDestinationMode === 'current-note' && urlCount === 1) {
			const ref: QueuedRunInsertionTargetRef = {
				filePath: target.file.path,
				mode: 'replace-range',
				fromOffset: target.fromOffset,
				toOffset: target.toOffset,
				expectedContent: target.expectedContent,
				createdByPlugin: target.createdByPlugin,
			};
			return buildEditorReplaceRangeFirstPolicy(ref);
		}
		return buildEditorAppendSequentialPolicy(target.file.path);
	}

	private initializeStatusBar(): void {
		try {
			this.statusBarEl = this.addStatusBarItem();
			this.statusBarEl.addClass('ytkn-status-bar--clickable');
			this.registerDomEvent(this.statusBarEl, 'click', () => this.onStatusBarClick());
			this.renderStatusBar();
		} catch (error) {
			console.warn('Status bar is unavailable:', error);
		}
	}

	private onStatusBarClick(): void {
		this.openQueueModal();
	}

	private renderStatusBar(message?: string): void {
		if (!this.statusBarEl) return;
		this.statusBarEl.empty();

		const snap = this.runQueue?.getSnapshot();
		const current = snap?.current ?? null;
		const queuedCount = snap?.queued.length ?? 0;

		if (message) {
			this.statusBarEl.createSpan({ text: `YTKN · ${message}` });
			this.statusBarEl.show();
			return;
		}

		if (!current && queuedCount === 0) {
			this.statusBarEl.hide();
			return;
		}

		let text: string;
		if (current) {
			text = `YTKN · ${current.displayTitle} · Working…`;
			if (queuedCount > 0) text += ` (${queuedCount} queued)`;
		} else {
			text = `YTKN · ${queuedCount} queued`;
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
				expectedContent: fileContent,
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
			expectedContent: editor.getValue(),
			jobId: createJobId(),
			createdByPlugin: false,
			finalized: false,
		};
	}
}

export default YTKN;
