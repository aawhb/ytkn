import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';
import { verifyChangelog } from '../scripts/verify-changelog.mjs';

function writeReleaseFiles(rootDir: string, version: string, changelogVersion = version, notesVersion = version): void {
	mkdirSync(join(rootDir, 'src'), { recursive: true });
	writeFileSync(join(rootDir, 'package.json'), JSON.stringify({ version }, null, '\t'));
	writeFileSync(join(rootDir, 'CHANGELOG.md'), `# Changelog\n\n## ${changelogVersion} - 2026-01-01\n\n- Changed.\n`);
	writeFileSync(join(rootDir, 'src', 'release-notes.ts'), `export const RELEASE_NOTES = [{ version: '${notesVersion}' }];\n`);
}

describe('verifyChangelog', () => {
	it('accepts matching package, changelog, and bundled release notes versions', () => {
		const rootDir = mkdtempSync(join(tmpdir(), 'ytkn-changelog-'));
		try {
			writeReleaseFiles(rootDir, '1.2.3');

			expect(verifyChangelog(rootDir)).toBe('1.2.3');
		} finally {
			rmSync(rootDir, { recursive: true, force: true });
		}
	});

	it('rejects missing changelog and release note versions', () => {
		const missingChangelogRoot = mkdtempSync(join(tmpdir(), 'ytkn-changelog-'));
		try {
			writeReleaseFiles(missingChangelogRoot, '1.2.3', '1.2.2', '1.2.3');

			expect(() => verifyChangelog(missingChangelogRoot)).toThrow(/CHANGELOG\.md is missing/);
		} finally {
			rmSync(missingChangelogRoot, { recursive: true, force: true });
		}

		const missingNotesRoot = mkdtempSync(join(tmpdir(), 'ytkn-changelog-'));
		try {
			writeReleaseFiles(missingNotesRoot, '1.2.3', '1.2.3', '1.2.2');

			expect(() => verifyChangelog(missingNotesRoot)).toThrow(/release note/);
		} finally {
			rmSync(missingNotesRoot, { recursive: true, force: true });
		}
	});
});
