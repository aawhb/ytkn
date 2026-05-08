import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { createRequire } from 'module';
import { assertValidVersion, resolveTargetVersion, updateVersionFiles } from './versioning.mjs';

const require = createRequire(import.meta.url);

function runNodeCommand(scriptPath, args) {
    const result = spawnSync(process.execPath, [scriptPath, ...args], {
        cwd: process.cwd(),
        stdio: 'inherit',
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

const targetVersion = resolveTargetVersion();
if (targetVersion) {
    assertValidVersion(targetVersion);
}

runNodeCommand(require.resolve('typescript/bin/tsc'), ['--noEmit', '--skipLibCheck']);
runNodeCommand(resolve(process.cwd(), 'esbuild.config.mjs'), ['production']);

if (targetVersion) {
    const { minAppVersion } = updateVersionFiles(targetVersion);
    console.log(`✓ Updated plugin version to ${targetVersion} (minAppVersion: ${minAppVersion})`);
}
