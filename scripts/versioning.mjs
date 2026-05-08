import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;
const VERSION_FLAGS = ['--plugin-version', '--version'];

export function assertValidVersion(targetVersion) {
    if (!SEMVER_REGEX.test(targetVersion)) {
        throw new Error(`Invalid version format: ${targetVersion}. Expected format: x.y.z`);
    }
}

export function resolveTargetVersion(argv = process.argv.slice(2), env = process.env) {
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        for (const flag of VERSION_FLAGS) {
            if (arg === flag) {
                return argv[index + 1] ?? null;
            }

            if (arg.startsWith(`${flag}=`)) {
                return arg.slice(`${flag}=`.length) || null;
            }
        }
    }

    for (const arg of argv) {
        if (!arg.startsWith('-') && SEMVER_REGEX.test(arg)) {
            return arg;
        }
    }

    return env.VERSION ?? env.npm_config_plugin_version ?? null;
}

function readJsonFile(filePath) {
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
        throw new Error(`Failed to read ${filePath}: ${error.message}`);
    }
}

function writeJsonFile(filePath, data) {
    try {
        writeFileSync(filePath, JSON.stringify(data, null, '\t'));
    } catch (error) {
        throw new Error(`Failed to write ${filePath}: ${error.message}`);
    }
}

export function updateVersionFiles(targetVersion, rootDir = process.cwd()) {
    assertValidVersion(targetVersion);

    const manifestPath = resolve(rootDir, 'manifest.json');
    const packagePath = resolve(rootDir, 'package.json');
    const versionsPath = resolve(rootDir, 'versions.json');

    const manifest = readJsonFile(manifestPath);
    const packageJson = readJsonFile(packagePath);
    const versions = readJsonFile(versionsPath);
    const { minAppVersion } = manifest;

    manifest.version = targetVersion;
    packageJson.version = targetVersion;
    versions[targetVersion] = minAppVersion;

    writeJsonFile(manifestPath, manifest);
    writeJsonFile(packagePath, packageJson);
    writeJsonFile(versionsPath, versions);

    return { targetVersion, minAppVersion };
}
