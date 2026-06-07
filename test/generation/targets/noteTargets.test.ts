import { describe, expect, it, vi } from 'vitest';
import { buildSafeBaseName, NoteTargetWriter } from '../../../src/generation/targets/noteTargets';

describe('note target helpers', () => {
	it('sanitizes note base names and falls back when the result is empty', () => {
		expect(buildSafeBaseName('Bad / Name?', 'Fallback')).toBe('Bad Name');
		expect(buildSafeBaseName('///', 'Fallback')).toBe('Fallback');
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
});
