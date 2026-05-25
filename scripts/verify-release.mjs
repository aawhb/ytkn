import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

function readJson(fileName) {
	const filePath = resolve(process.cwd(), fileName);
	return JSON.parse(readFileSync(filePath, 'utf8'));
}

function resolveTagName() {
	if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME) {
		return process.env.GITHUB_REF_NAME;
	}

	try {
		return execFileSync('git', ['describe', '--tags', '--exact-match'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
	} catch {
		throw new Error('No exact git tag found. Run this check from a release tag or in GitHub Actions tag context.');
	}
}

const tagName = resolveTagName();
const manifest = readJson('manifest.json');
const packageJson = readJson('package.json');
const versions = readJson('versions.json');

if (!SEMVER_REGEX.test(tagName)) {
	throw new Error(`Release tag "${tagName}" must use x.y.z format with no "v" prefix.`);
}

if (manifest.version !== tagName) {
	throw new Error(`manifest.json version "${manifest.version}" does not match tag "${tagName}".`);
}

if (packageJson.version !== tagName) {
	throw new Error(`package.json version "${packageJson.version}" does not match tag "${tagName}".`);
}

if (versions[tagName] !== manifest.minAppVersion) {
	throw new Error(`versions.json must map "${tagName}" to minAppVersion "${manifest.minAppVersion}".`);
}

console.log(`Release metadata OK for ${tagName} (minAppVersion ${manifest.minAppVersion}).`);
