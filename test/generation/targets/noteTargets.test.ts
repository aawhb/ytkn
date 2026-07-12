import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../../mocks/obsidian');
	class TFile {
		extension = 'md';
		parent = { path: 'Notes' };
		constructor(public path: string) { }
	}
	class MarkdownView { }
	return { ...mod, MarkdownView, TFile };
});

import { TFile } from 'obsidian';
import { buildSafeBaseName, NoteTargetWriter } from '../../../src/generation/targets/noteTargets';

describe('note target helpers', () => {
	it('sanitizes note base names and falls back when the result is empty', () => {
		expect(buildSafeBaseName('Bad / Name?', 'Fallback')).toBe('Bad Name');
		expect(buildSafeBaseName('///', 'Fallback')).toBe('Fallback');
	});

	it('opens a target file in a new workspace tab', async () => {
		const openFile = vi.fn(async () => undefined);
		const app = { workspace: { getLeaf: vi.fn(() => ({ openFile })) } };
		const writer = new NoteTargetWriter(app as any, vi.fn());
		const target = {
			file: { path: 'Notes/Video.md' },
			fromOffset: 0,
			toOffset: 0,
			jobId: 'job',
			createdByPlugin: true,
			finalized: true,
		} as any;

		await writer.openTargetInNewTab(target);

		expect(app.workspace.getLeaf).toHaveBeenCalledWith('tab');
		expect(openFile).toHaveBeenCalledWith(target.file);
	});

	it('does not throw when opening the note fails', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const app = {
			workspace: {
				getLeaf: vi.fn(() => ({ openFile: vi.fn(async () => { throw new Error('boom'); }) })),
			},
		};
		const writer = new NoteTargetWriter(app as any, vi.fn());
		const target = { file: { path: 'Notes/Video.md' } } as any;

		await expect(writer.openTargetInNewTab(target)).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('closes the tab it opened when a disposable target is deleted', async () => {
		const target = {
			file: { path: 'Notes/Video.md' },
			fromOffset: 0,
			toOffset: 0,
			jobId: 'job-1',
			createdByPlugin: true,
			finalized: false,
		} as any;
		const leaf = { view: { file: target.file }, detach: vi.fn(), openFile: vi.fn(async () => undefined) };
		const app = {
			workspace: { getLeaf: vi.fn(() => leaf) },
			fileManager: { trashFile: vi.fn(async () => undefined) },
		};
		const writer = new NoteTargetWriter(app as any, vi.fn());

		await writer.openTargetInNewTab(target);
		await writer.deleteTargetIfDisposable(target);

		expect(leaf.detach).toHaveBeenCalledTimes(1);
		expect(app.fileManager.trashFile).toHaveBeenCalledWith(target.file);
	});

	it('does not close the tab when the user navigated it to another file', async () => {
		const target = {
			file: { path: 'Notes/Video.md' },
			fromOffset: 0,
			toOffset: 0,
			jobId: 'job-1',
			createdByPlugin: true,
			finalized: false,
		} as any;
		const leaf = { view: { file: { path: 'Other.md' } }, detach: vi.fn(), openFile: vi.fn(async () => undefined) };
		const app = {
			workspace: { getLeaf: vi.fn(() => leaf) },
			fileManager: { trashFile: vi.fn(async () => undefined) },
		};
		const writer = new NoteTargetWriter(app as any, vi.fn());

		await writer.openTargetInNewTab(target);
		await writer.deleteTargetIfDisposable(target);

		expect(leaf.detach).not.toHaveBeenCalled();
		expect(app.fileManager.trashFile).toHaveBeenCalledWith(target.file);
	});

	it('stops tracking the opened tab once the target is finalized', async () => {
		const target = {
			file: { path: 'Notes/Video.md' },
			fromOffset: 0,
			toOffset: 0,
			jobId: 'job-1',
			createdByPlugin: true,
			finalized: false,
		} as any;
		const leaf = { view: { file: target.file }, detach: vi.fn(), openFile: vi.fn(async () => undefined) };
		const app = {
			workspace: { getLeaf: vi.fn(() => leaf) },
			fileManager: { trashFile: vi.fn(async () => undefined) },
			vault: { process: vi.fn(async () => undefined) },
		};
		const writer = new NoteTargetWriter(app as any, vi.fn());
		const progressState = { target: null, url: 'u', hasProgressContent: false };

		await writer.openTargetInNewTab(target);
		await writer.finalizeTargetNote(target, 'content', null, progressState);
		target.finalized = false;
		await writer.deleteTargetIfDisposable(target);

		expect(leaf.detach).not.toHaveBeenCalled();
		expect(app.fileManager.trashFile).toHaveBeenCalledWith(target.file);
	});

	it('creates parent folders and a unique note target', async () => {
		const folders = new Set<string>();
		const files = new Set<string>(['Notes/Video.md']);
		const app = {
			vault: {
				getAbstractFileByPath: vi.fn((path: string) => folders.has(path) || files.has(path) ? { path } : null),
				createFolder: vi.fn(async (path: string) => { folders.add(path); }),
				create: vi.fn(async (path: string) => {
					files.add(path);
					return {
						path,
						extension: 'md',
						parent: { path: path.split('/').slice(0, -1).join('/') },
					};
				}),
			},
		};
		const writer = new NoteTargetWriter(app as any, vi.fn());

		const target = await writer.createFolderTarget('Notes/Nested', 'Video');

		expect(app.vault.createFolder).toHaveBeenCalledWith('Notes');
		expect(app.vault.createFolder).toHaveBeenCalledWith('Notes/Nested');
		expect(app.vault.create).toHaveBeenCalledWith('Notes/Nested/Video.md', '');
		expect(target.createdByPlugin).toBe(true);
	});

	it('resolves an unchanged queued selection target', async () => {
		const file = Object.assign(new TFile(), { path: 'Notes/Video.md' });
		const app = {
			workspace: { getActiveViewOfType: vi.fn(() => null) },
			vault: {
				getAbstractFileByPath: vi.fn(() => file),
				cachedRead: vi.fn(async () => 'before selected after'),
			},
		};
		const writer = new NoteTargetWriter(app as any, vi.fn());

		const target = await writer.resolveInitialTarget({
			initialTargetRef: {
				filePath: file.path,
				mode: 'replace-range',
				fromOffset: 7,
				toOffset: 15,
				expectedContent: 'before selected after',
				createdByPlugin: false,
			},
		} as any);

		expect(target).toMatchObject({ file, fromOffset: 7, toOffset: 15 });
	});

	it('rejects a queued selection target after the note changes', async () => {
		const file = Object.assign(new TFile(), { path: 'Notes/Video.md' });
		const app = {
			workspace: { getActiveViewOfType: vi.fn(() => null) },
			vault: {
				getAbstractFileByPath: vi.fn(() => file),
				cachedRead: vi.fn(async () => 'edited before selected after'),
			},
		};
		const writer = new NoteTargetWriter(app as any, vi.fn());

		await expect(writer.resolveInitialTarget({
			initialTargetRef: {
				filePath: file.path,
				mode: 'replace-range',
				fromOffset: 7,
				toOffset: 15,
				expectedContent: 'before selected after',
				createdByPlugin: false,
			},
		} as any)).rejects.toThrow('The target note changed while this run was waiting.');
	});
});
