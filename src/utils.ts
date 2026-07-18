import { decode } from 'html-entities';
import { normalizePath } from 'obsidian';

const INVALID_NOTE_NAME_CHARS = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|']);
const TRAILING_NOTE_NAME_CHARS_REGEX = /[. ]+$/;
const WINDOWS_RESERVED_NAMES = new Set([
	'CON', 'PRN', 'AUX', 'NUL',
	'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
	'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);
const MAX_UNIQUE_PATH_SUFFIX = 1000;

export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

export function decodeHtmlEntities(text: string): string {
	return decode(text, { level: 'html5', scope: 'strict' });
}

const MAX_ENTITY_DECODE_PASSES = 5;

export function decodeHtmlEntitiesDeep(text: string): string {
	let current = text;
	for (let pass = 0; pass < MAX_ENTITY_DECODE_PASSES; pass += 1) {
		const next = decodeHtmlEntities(current);
		if (next === current) {
			return current;
		}
		current = next;
	}
	return current;
}

export function sanitizeNoteFileName(title: string): string {
	const cleaned = normalizeWhitespace(replaceInvalidNoteNameChars(title))
		.replace(TRAILING_NOTE_NAME_CHARS_REGEX, '')
		.trim();

	if (!cleaned) {
		return '';
	}

	const upper = cleaned.toUpperCase();
	if (WINDOWS_RESERVED_NAMES.has(upper)) {
		return `${cleaned} note`;
	}

	return cleaned;
}

function replaceInvalidNoteNameChars(value: string): string {
	return Array.from(value, (char) => (
		INVALID_NOTE_NAME_CHARS.has(char) || char.charCodeAt(0) <= 31 ? ' ' : char
	)).join('');
}

export function normalizeVaultFolderPath(folderPath: string): string {
	return normalizePath(folderPath.trim()).replace(/^\/+|\/+$/g, '');
}

export function formatSequenceName(prefix: string, index: number, total: number): string {
	const digits = Math.max(2, String(Math.max(total, index)).length);
	return `${prefix} ${String(index).padStart(digits, '0')}`;
}

export function resolveUniqueNotePath(
	directoryPath: string,
	baseName: string,
	extension: string,
	currentPath: string,
	pathExists: (path: string) => boolean,
): string {
	const createPath = (name: string): string => (directoryPath ? `${directoryPath}/${name}.${extension}` : `${name}.${extension}`);
	const desiredPath = createPath(baseName);

	if (desiredPath === currentPath || !pathExists(desiredPath)) {
		return desiredPath;
	}

	for (let suffix = 2; suffix <= MAX_UNIQUE_PATH_SUFFIX; suffix += 1) {
		const candidatePath = createPath(`${baseName} ${suffix}`);
		if (candidatePath === currentPath || !pathExists(candidatePath)) {
			return candidatePath;
		}
	}

	throw new Error(`Could not find a unique note path for "${baseName}" after ${MAX_UNIQUE_PATH_SUFFIX} attempts.`);
}

export function createJobId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
