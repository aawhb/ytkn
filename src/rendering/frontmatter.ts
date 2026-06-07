import type { FrontmatterDeclaration, FrontmatterFieldType, GenerationOptions, PlaylistTranscriptResponse, TranscriptResponse } from '../types';
import type { Template } from '../types';
import { DEFAULT_FRONTMATTER_PROPERTY_ALLOWLIST } from '../defaults';

export const SACRED_FRONTMATTER_KEYS = [
	'title',
	'aliases',
	'source',
	'channel',
	'channelUrl',
	'channelId',
	'videoUrl',
	'playlistUrl',
	'videoId',
	'playlistId',
	'thumbnailUrl',
	'videoDescription',
	'uploadDate',
	'videoCategory',
	'durationSeconds',
	'keywords',
	'generated',
	'videoCount',
];

export interface MergeFrontmatterInput {
	globalTags: string[];
	templateTags: string[];
	declared: FrontmatterDeclaration[];
	extracted: Record<string, unknown>;
}

export interface MergeFrontmatterResult {
	merged: Record<string, unknown>;
	warnings: string[];
}

export interface RenderedFrontmatter {
	content: string | null;
	warnings: string[];
}

const KNOWN_ALLOWLIST_KEYS: ReadonlySet<string> = new Set(SACRED_FRONTMATTER_KEYS);
const DEFAULT_ALLOWLIST_KEYS: ReadonlySet<string> = new Set(DEFAULT_FRONTMATTER_PROPERTY_ALLOWLIST.split(/\s+/));

export function mergeFrontmatter(input: MergeFrontmatterInput): MergeFrontmatterResult {
	const merged: Record<string, unknown> = {};
	const warnings: string[] = [];

	const tags = unionTags(input.globalTags, input.templateTags, input.extracted.tags);
	if (tags.length > 0) {
		merged.tags = tags;
	}

	const declaredByKey = new Map(input.declared.map((d) => [d.key, d]));

	for (const declaration of input.declared) {
		const extractedValue = input.extracted[declaration.key];
		if (extractedValue === undefined) {
			if (declaration.default !== undefined) {
				merged[declaration.key] = declaration.default;
			}
			continue;
		}

		const validated = validateValue(extractedValue, declaration);
		if (validated.ok) {
			merged[declaration.key] = validated.value;
		} else {
			warnings.push(`Frontmatter key "${declaration.key}" failed validation: ${validated.reason}; using ${declaration.default !== undefined ? 'declared default' : 'no value'}.`);
			if (declaration.default !== undefined) {
				merged[declaration.key] = declaration.default;
			}
		}
	}

	for (const [key, value] of Object.entries(input.extracted)) {
		if (key === 'tags') {
			continue;
		}
		if (SACRED_FRONTMATTER_KEYS.includes(key)) {
			warnings.push(`Frontmatter key "${key}" is renderer-owned and cannot be set by the model; dropping.`);
			continue;
		}
		if (declaredByKey.has(key)) {
			continue;
		}
		warnings.push(`Frontmatter key "${key}" is not declared by this template; dropping. (value: ${truncate(safeStringify(value), 60)})`);
	}

	return { merged, warnings };
}

export function buildVideoFrontmatter(
	transcript: TranscriptResponse,
	url: string,
	options: GenerationOptions | undefined,
	template: Template | null,
	extractedFrontmatter: Record<string, unknown>,
): RenderedFrontmatter {
	if (!(options?.includeFrontmatter ?? true)) {
		return { content: null, warnings: [] };
	}

	const allowlist = parseAllowlist(options?.frontmatterPropertyAllowlist);
	const lines: string[] = ['---'];

	if (allowlist.has('title')) {
		lines.push(`title: ${quoteYamlValue(transcript.title)}`);
	}

	if (allowlist.has('aliases')) {
		lines.push('aliases:');
		lines.push(`  - ${quoteYamlValue(transcript.title)}`);
	}

	const globalTags = parseTagList(options?.frontmatterTags);
	const mergeResult = mergeFrontmatter({
		globalTags,
		templateTags: template?.tags ?? [],
		declared: template?.frontmatter ?? [],
		extracted: extractedFrontmatter,
	});

	const merged = mergeResult.merged;

	if (Array.isArray(merged.tags) && merged.tags.length > 0) {
		lines.push('tags:');
		for (const tag of merged.tags as string[]) {
			lines.push(`  - ${tag}`);
		}
	}

	if (allowlist.has('source')) {
		lines.push('source: youtube');
	}

	if (transcript.author && allowlist.has('channel')) {
		lines.push(`channel: ${quoteYamlValue(transcript.author)}`);
	}

	if (transcript.channelUrl && allowlist.has('channelUrl')) {
		lines.push(`channelUrl: ${quoteYamlValue(transcript.channelUrl)}`);
	}

	if (transcript.channelId && allowlist.has('channelId')) {
		lines.push(`channelId: ${quoteYamlValue(transcript.channelId)}`);
	}

	if (allowlist.has('videoUrl')) {
		lines.push(`videoUrl: ${quoteYamlValue(url)}`);
	}

	if (allowlist.has('videoId')) {
		lines.push(`videoId: ${quoteYamlValue(transcript.videoId)}`);
	}

	if (transcript.thumbnailUrl && allowlist.has('thumbnailUrl')) {
		lines.push(`thumbnailUrl: ${quoteYamlValue(transcript.thumbnailUrl)}`);
	}

	if (transcript.description && allowlist.has('videoDescription')) {
		lines.push(`videoDescription: ${quoteYamlValue(transcript.description)}`);
	}

	if (transcript.uploadDate && allowlist.has('uploadDate')) {
		lines.push(`uploadDate: ${transcript.uploadDate}`);
	}

	if (transcript.videoCategory && allowlist.has('videoCategory')) {
		lines.push(`videoCategory: ${quoteYamlValue(transcript.videoCategory)}`);
	}

	if (typeof transcript.durationSeconds === 'number' && Number.isFinite(transcript.durationSeconds) && allowlist.has('durationSeconds')) {
		lines.push(`durationSeconds: ${transcript.durationSeconds}`);
	}

	if (Array.isArray(transcript.keywords) && transcript.keywords.length > 0 && allowlist.has('keywords')) {
		lines.push(formatYamlEntry('keywords', transcript.keywords));
	}

	if (allowlist.has('generated')) {
		lines.push(`generated: ${new Date().toISOString()}`);
	}

	for (const [key, value] of Object.entries(merged)) {
		if (key === 'tags') {
			continue;
		}
		lines.push(formatYamlEntry(key, value));
	}

	lines.push('---');
	return { content: lines.join('\n'), warnings: mergeResult.warnings };
}

export function buildPlaylistFrontmatter(
	playlist: PlaylistTranscriptResponse,
	options: GenerationOptions | undefined,
	template: Template | null,
	extractedFrontmatter: Record<string, unknown>,
): RenderedFrontmatter {
	if (!(options?.includeFrontmatter ?? true)) {
		return { content: null, warnings: [] };
	}

	const allowlist = parseAllowlist(options?.frontmatterPropertyAllowlist);
	const lines: string[] = ['---'];

	if (allowlist.has('title')) {
		lines.push(`title: ${quoteYamlValue(playlist.title)}`);
	}

	if (allowlist.has('aliases')) {
		lines.push('aliases:');
		lines.push(`  - ${quoteYamlValue(playlist.title)}`);
	}

	const globalTags = parseTagList(options?.frontmatterTags);
	const mergeResult = mergeFrontmatter({
		globalTags,
		templateTags: template?.tags ?? [],
		declared: template?.frontmatter ?? [],
		extracted: extractedFrontmatter,
	});

	const merged = mergeResult.merged;

	if (Array.isArray(merged.tags) && merged.tags.length > 0) {
		lines.push('tags:');
		for (const tag of merged.tags as string[]) {
			lines.push(`  - ${tag}`);
		}
	}

	if (allowlist.has('source')) {
		lines.push('source: youtube-playlist');
	}

	if (allowlist.has('videoCount')) {
		const videoCount = playlist.transcripts.length > 0 ? playlist.transcripts.length : playlist.entries.length;
		lines.push(`videoCount: ${videoCount}`);
	}

	if (allowlist.has('playlistUrl')) {
		lines.push(`playlistUrl: ${quoteYamlValue(playlist.url)}`);
	}

	if (allowlist.has('playlistId')) {
		lines.push(`playlistId: ${quoteYamlValue(playlist.playlistId)}`);
	}

	if (allowlist.has('generated')) {
		lines.push(`generated: ${new Date().toISOString()}`);
	}

	for (const [key, value] of Object.entries(merged)) {
		if (key === 'tags') {
			continue;
		}
		lines.push(formatYamlEntry(key, value));
	}

	lines.push('---');
	return { content: lines.join('\n'), warnings: mergeResult.warnings };
}

function escapeYamlString(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function quoteYamlValue(value: string): string {
	return `"${escapeYamlString(value)}"`;
}

function parseTagList(input: string | undefined): string[] {
	if (!input) {
		return [];
	}

	return input
		.split(/[\s,]+/)
		.map((tag) => tag.trim().replace(/^#+/, ''))
		.filter((tag) => tag.length > 0);
}

function parseAllowlist(input: string | undefined): Set<string> {
	if (input === undefined) {
		return new Set(DEFAULT_ALLOWLIST_KEYS);
	}
	const parts = input.split(/[\s,]+/).map((s) => s.trim()).filter((s) => s.length > 0);
	if (!parts.length) {
		return new Set<string>();
	}
	return new Set(parts.filter((s) => KNOWN_ALLOWLIST_KEYS.has(s)));
}

function formatYamlEntry(key: string, value: unknown): string {
	if (value === null) {
		return `${key}: null`;
	}
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return `${key}: []`;
		}
		const items = value.map((v) => `  - ${quoteYamlValue(formatYamlScalar(v))}`);
		return `${key}:\n${items.join('\n')}`;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return `${key}: ${value}`;
	}
	return `${key}: ${quoteYamlValue(formatYamlScalar(value))}`;
}

function formatYamlScalar(value: unknown): string {
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
		return `${value}`;
	}
	return JSON.stringify(value) ?? '';
}

function unionTags(global: string[], template: string[], extracted: unknown): string[] {
	const seen = new Set<string>();
	const out: string[] = [];

	const push = (value: unknown) => {
		if (typeof value !== 'string') {
			return;
		}
		const trimmed = value.trim().replace(/^#+/, '');
		if (!trimmed || seen.has(trimmed)) {
			return;
		}
		seen.add(trimmed);
		out.push(trimmed);
	};

	for (const t of global) push(t);
	for (const t of template) push(t);

	if (Array.isArray(extracted)) {
		for (const t of extracted) push(t);
	} else if (typeof extracted === 'string') {
		push(extracted);
	}

	return out;
}

interface ValidateOk {
	ok: true;
	value: unknown;
}

interface ValidateFail {
	ok: false;
	reason: string;
}

function validateValue(value: unknown, declaration: FrontmatterDeclaration): ValidateOk | ValidateFail {
	switch (declaration.type) {
		case 'string':
			if (typeof value === 'string') {
				return { ok: true, value };
			}
			return { ok: false, reason: `expected string, got ${typeOf(value)}` };
		case 'string[]':
			if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
				return { ok: true, value };
			}
			return { ok: false, reason: `expected string[], got ${typeOf(value)}` };
		case 'number':
			if (typeof value === 'number' && Number.isFinite(value)) {
				return { ok: true, value };
			}
			return { ok: false, reason: `expected number, got ${typeOf(value)}` };
		case 'enum':
			if (typeof value === 'string' && (declaration.enumValues ?? []).includes(value)) {
				return { ok: true, value };
			}
			return { ok: false, reason: `expected one of ${(declaration.enumValues ?? []).join('|')}, got ${typeOf(value)} (${truncate(safeStringify(value), 30)})` };
		case 'date':
			if (value === null) {
				return { ok: true, value: null };
			}
			if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
				return { ok: true, value };
			}
			return { ok: false, reason: `expected ISO date string or null, got ${typeOf(value)} (${truncate(safeStringify(value), 30)})` };
		default:
			return { ok: false, reason: `unsupported declared type ${(declaration as { type: FrontmatterFieldType }).type}` };
	}
}

function typeOf(value: unknown): string {
	if (Array.isArray(value)) {
		return 'array';
	}
	if (value === null) {
		return 'null';
	}
	return typeof value;
}

function truncate(value: string, max: number): string {
	if (value.length <= max) {
		return value;
	}
	return `${value.slice(0, max)}…`;
}

function safeStringify(value: unknown): string {
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
		return `${value}`;
	}
	return JSON.stringify(value) ?? '';
}
