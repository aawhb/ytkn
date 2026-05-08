import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;
const VERSION_FLAGS = ['--plugin-version', '--version'];

export function assertValidVersion(targetVersion) {
	if (!SEMVER_REGEX.test(targetVersion)) {
		throw new Error(`Invalid version format: ${targetVersion}. Expected format: x.y.z`);
	}
}

export function resolveTargetVersion(argv = process.argv.slice(2), env = process.env, rootDir = process.cwd()) {
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

	return env.VERSION
		?? env.npm_config_plugin_version
		?? env.npm_new_version
		?? env.npm_package_version
		?? readPackageVersion(rootDir)
		?? null;
}

function readPackageVersion(rootDir = process.cwd()) {
	const packagePath = resolve(rootDir, 'package.json');
	if (!existsSync(packagePath)) {
		return null;
	}

	const packageJson = readJsonFile(packagePath);
	return typeof packageJson.version === 'string' ? packageJson.version : null;
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
	const packageLockPath = resolve(rootDir, 'package-lock.json');
	const versionsPath = resolve(rootDir, 'versions.json');

	const manifest = readJsonFile(manifestPath);
	const packageJson = readJsonFile(packagePath);
	const versions = readJsonFile(versionsPath);
	const packageLock = existsSync(packageLockPath) ? readJsonFile(packageLockPath) : null;
	const { minAppVersion } = manifest;

	if (packageJson.version !== targetVersion) {
		throw new Error(
			`package.json version (${packageJson.version}) does not match target version (${targetVersion}). Run \`npm version ${targetVersion} --no-git-tag-version\` first.`,
		);
	}

	if (packageLock && packageLock.version !== targetVersion) {
		throw new Error(
			`package-lock.json version (${packageLock.version}) does not match target version (${targetVersion}). Run \`npm version ${targetVersion} --no-git-tag-version\` first.`,
		);
	}

	if (packageLock?.packages?.['']?.version && packageLock.packages[''].version !== targetVersion) {
		throw new Error(
			`package-lock.json root package version (${packageLock.packages[''].version}) does not match target version (${targetVersion}). Run \`npm version ${targetVersion} --no-git-tag-version\` first.`,
		);
	}

	manifest.version = targetVersion;
	versions[targetVersion] = minAppVersion;

	writeJsonFile(manifestPath, manifest);
	writeJsonFile(versionsPath, versions);

	return { targetVersion, minAppVersion };
}
