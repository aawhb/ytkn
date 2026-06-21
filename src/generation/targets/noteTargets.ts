import type { App } from 'obsidian';
import { Notice, TFile } from 'obsidian';
import type { ProgressMarkers } from '../../queue/progress';
import {
	buildProgressContent,
	buildProgressMarkers,
	replaceMarkedContent,
} from '../../queue/progress';
import type { QueuedRun } from '../../queue/runQueueService';
import {
	createJobId,
	getErrorMessage,
	normalizeVaultFolderPath,
	resolveUniqueNotePath,
	sanitizeNoteFileName,
} from '../../utils';

export interface NoteInsertionTarget {
	file: TFile;
	fromOffset: number;
	toOffset: number;
	jobId: string;
	createdByPlugin: boolean;
	finalized: boolean;
}

export interface ProgressState {
	target: NoteInsertionTarget | null;
	url: string;
	hasProgressContent: boolean;
}

export function buildSafeBaseName(baseName: string, fallbackName: string): string {
	return sanitizeNoteFileName(baseName) || fallbackName;
}

export class NoteTargetWriter {
	constructor(
		private app: App,
		private onStatusBar: (message: string | null) => void,
	) { }

	async ensureFolderExists(folderPath: string): Promise<void> {
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

	async createNewTarget(directoryPath: string, baseName: string, extension = 'md'): Promise<NoteInsertionTarget> {
		await this.ensureFolderExists(directoryPath);
		const targetPath = resolveUniqueNotePath(
			directoryPath,
			buildSafeBaseName(baseName, 'Untitled'),
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

	async createAdjacentTarget(referenceFile: TFile, baseName: string): Promise<NoteInsertionTarget> {
		return this.createNewTarget(referenceFile.parent?.path ?? '', baseName, referenceFile.extension);
	}

	async createFolderTarget(folderPath: string, baseName: string): Promise<NoteInsertionTarget> {
		return this.createNewTarget(normalizeVaultFolderPath(folderPath), baseName);
	}

	async deleteTargetIfDisposable(target: NoteInsertionTarget | null): Promise<void> {
		if (!target || !target.createdByPlugin || target.finalized) {
			return;
		}
		try {
			await this.app.fileManager.trashFile(target.file);
		} catch (error) {
			console.warn('Failed to delete temporary note:', error);
		}
	}

	async upsertProgressContent(
		target: NoteInsertionTarget,
		url: string,
		status: string,
		kind: 'info' | 'failure' = 'info',
		errorMessage?: string,
	): Promise<void> {
		const content = buildProgressContent(this.getMarkers(target), { url, status, kind, errorMessage });
		await this.app.vault.process(target.file, (data) => this.replaceMarkedContent(target, data, content));
	}

	async writeContentToTarget(target: NoteInsertionTarget, content: string): Promise<void> {
		await this.app.vault.process(target.file, (data) => this.replaceMarkedContent(target, data, content));
	}

	async appendContentToTarget(target: NoteInsertionTarget, content: string): Promise<void> {
		await this.app.vault.process(target.file, (data) => {
			const trimmed = data.trimEnd();
			const isPlaceholderProgress = target.createdByPlugin && !target.finalized && trimmed.length === 0;
			const existingContent = isPlaceholderProgress ? '' : trimmed;
			const prefix = existingContent ? `${existingContent}\n\n` : '';
			return `${prefix}${content}`;
		});
	}

	async showProgress(target: NoteInsertionTarget, url: string, status: string, progressState: ProgressState): Promise<void> {
		progressState.target = target;
		progressState.url = url;
		progressState.hasProgressContent = true;
		await this.upsertProgressContent(target, url, status);
	}

	async finalizeTargetNote(
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

	async resolveInitialTarget(run: QueuedRun): Promise<NoteInsertionTarget | null> {
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

	private getMarkers(target: NoteInsertionTarget): ProgressMarkers {
		return buildProgressMarkers(target.jobId);
	}

	private replaceMarkedContent(target: NoteInsertionTarget, data: string, content: string): string {
		return replaceMarkedContent(this.getMarkers(target), data, content, {
			start: target.fromOffset,
			end: target.toOffset,
		});
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
}
