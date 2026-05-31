import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function readText(rootDir, fileName) {
	return readFileSync(resolve(rootDir, fileName), 'utf8');
}

function readJson(rootDir, fileName) {
	return JSON.parse(readText(rootDir, fileName));
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function verifyChangelog(rootDir = process.cwd()) {
	const packageJson = readJson(rootDir, 'package.json');
	const version = packageJson.version;
	if (typeof version !== 'string' || !version) {
		throw new Error('package.json must define a version.');
	}

	const escapedVersion = escapeRegExp(version);
	const changelog = readText(rootDir, 'CHANGELOG.md');
	const releaseNotes = readText(rootDir, 'src/releaseNotes.ts');

	if (!new RegExp(`^##\\s+(?:\\[${escapedVersion}\\]|${escapedVersion})\\b`, 'm').test(changelog)) {
		throw new Error(`CHANGELOG.md is missing a section for ${version}.`);
	}

	if (!new RegExp(`version:\\s*['"]${escapedVersion}['"]`).test(releaseNotes)) {
		throw new Error(`src/releaseNotes.ts is missing a release note for ${version}.`);
	}

	return version;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
	const version = verifyChangelog();
	console.log(`Changelog metadata OK for ${version}.`);
}
