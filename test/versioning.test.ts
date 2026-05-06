import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';
import { resolveTargetVersion, updateVersionFiles } from '../scripts/versioning.mjs';

describe('versioning helpers', () => {
    it('returns null when no version is provided', () => {
        expect(resolveTargetVersion([], {} as NodeJS.ProcessEnv)).toBeNull();
    });

    it('prefers the CLI version over the environment', () => {
        expect(resolveTargetVersion(['1.2.3'], { VERSION: '9.9.9' } as NodeJS.ProcessEnv)).toBe('1.2.3');
        expect(resolveTargetVersion(['--plugin-version=1.2.3'], { VERSION: '9.9.9' } as NodeJS.ProcessEnv)).toBe('1.2.3');
        expect(resolveTargetVersion(['--plugin-version', '2.3.4'], { VERSION: '9.9.9' } as NodeJS.ProcessEnv)).toBe('2.3.4');
        expect(resolveTargetVersion(['--version=3.4.5'], { VERSION: '9.9.9' } as NodeJS.ProcessEnv)).toBe('3.4.5');
        expect(resolveTargetVersion([], { npm_config_plugin_version: '4.5.6' } as NodeJS.ProcessEnv)).toBe('4.5.6');
    });

    it('updates manifest, package, and versions files together', () => {
        const rootDir = mkdtempSync(join(tmpdir(), 'ytkn-versioning-'));

        try {
            writeFileSync(join(rootDir, 'manifest.json'), JSON.stringify({ version: '1.0.0', minAppVersion: '1.5.0' }, null, '\t'));
            writeFileSync(join(rootDir, 'package.json'), JSON.stringify({ version: '1.0.0' }, null, '\t'));
            writeFileSync(join(rootDir, 'versions.json'), JSON.stringify({ '1.0.0': '1.5.0' }, null, '\t'));

            const result = updateVersionFiles('1.2.3', rootDir);
            const manifest = JSON.parse(readFileSync(join(rootDir, 'manifest.json'), 'utf8'));
            const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
            const versions = JSON.parse(readFileSync(join(rootDir, 'versions.json'), 'utf8'));

            expect(result).toEqual({ targetVersion: '1.2.3', minAppVersion: '1.5.0' });
            expect(manifest.version).toBe('1.2.3');
            expect(packageJson.version).toBe('1.2.3');
            expect(versions).toEqual({
                '1.0.0': '1.5.0',
                '1.2.3': '1.5.0',
            });
        } finally {
            rmSync(rootDir, { recursive: true, force: true });
        }
    });

    it('rejects invalid versions', () => {
        expect(() => updateVersionFiles('1.2', process.cwd())).toThrow(/Invalid version format/);
    });
});
