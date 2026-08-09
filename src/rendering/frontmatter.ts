import type { FrontmatterDeclaration, FrontmatterFieldType, GenerationOptions, TranscriptResponse, VideoCollectionTranscriptResponse } from '../types';
import type { Template } from '../types';
import { BUILT_IN_FRONTMATTER_PROPERTIES, parseFrontmatterPropertyKeys } from '../frontmatterProperties';

const SACRED_FRONTMATTER_KEYS = BUILT_IN_FRONTMATTER_PROPERTIES.map((property) => property.key);

interface MergeFrontmatterInput {
	globalTags: string[];
	templateTags: string[];
	declared: FrontmatterDeclaration[];
	extracted: Record<string, unknown>;
}

interface MergeFrontmatterResult {
	merged: Record<string, unknown>;
	warnings: string[];
}

export interface RenderedFrontmatter {
	content: string | null;
	warnings: string[];
}

type FrontmatterEntries = Map<string, string[]>;

function mergeFrontmatter(input: MergeFrontmatterInput): MergeFrontmatterResult {
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
		warnings.push(`Frontmatter key "${key}" is not declared by this template; dropping. (value: ${truncate(formatYamlScalar(value), 60)})`);
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
	return buildFrontmatter(transcript.title, options, template, extractedFrontmatter, () => {
		const entries: FrontmatterEntries = new Map([
			['source', ['source: youtube']],
			['videoUrl', [`videoUrl: ${quoteYamlValue(url)}`]],
			['videoId', [`videoId: ${quoteYamlValue(transcript.videoId)}`]],
		]);
		if (transcript.author) entries.set('channel', [`channel: ${quoteYamlValue(transcript.author)}`]);
		if (transcript.channelUrl) entries.set('channelUrl', [`channelUrl: ${quoteYamlValue(transcript.channelUrl)}`]);
		if (transcript.channelId) entries.set('channelId', [`channelId: ${quoteYamlValue(transcript.channelId)}`]);
		if (transcript.thumbnailUrl) entries.set('thumbnailUrl', [`thumbnailUrl: ${quoteYamlValue(transcript.thumbnailUrl)}`]);
		if (transcript.description) entries.set('videoDescription', [`videoDescription: ${quoteYamlValue(transcript.description)}`]);
		if (transcript.uploadDate) entries.set('uploadDate', [`uploadDate: ${transcript.uploadDate}`]);
		if (transcript.videoCategory) entries.set('videoCategory', [`videoCategory: ${quoteYamlValue(transcript.videoCategory)}`]);
		if (typeof transcript.durationSeconds === 'number' && Number.isFinite(transcript.durationSeconds)) {
			entries.set('durationSeconds', [`durationSeconds: ${transcript.durationSeconds}`]);
		}
		if (Array.isArray(transcript.keywords) && transcript.keywords.length > 0) {
			entries.set('keywords', [formatYamlEntry('keywords', transcript.keywords)]);
		}
		return entries;
	});
}

export function buildCollectionFrontmatter(
	collection: VideoCollectionTranscriptResponse,
	options: GenerationOptions | undefined,
	template: Template | null,
	extractedFrontmatter: Record<string, unknown>,
): RenderedFrontmatter {
	return buildFrontmatter(collection.title, options, template, extractedFrontmatter, () => {
		const videoCount = collection.transcripts.length > 0 ? collection.transcripts.length : collection.entries.length;
		if ('channelId' in collection) {
			return new Map([
				['source', ['source: youtube-channel']],
				['channel', [`channel: ${quoteYamlValue(collection.title)}`]],
				['channelUrl', [`channelUrl: ${quoteYamlValue(collection.url)}`]],
				['channelId', [`channelId: ${quoteYamlValue(collection.channelId)}`]],
				['videoCount', [`videoCount: ${videoCount}`]],
			]);
		}
		return new Map([
			['source', ['source: youtube-playlist']],
			['videoCount', [`videoCount: ${videoCount}`]],
			['playlistUrl', [`playlistUrl: ${quoteYamlValue(collection.url)}`]],
			['playlistId', [`playlistId: ${quoteYamlValue(collection.playlistId)}`]],
		]);
	});
}

function buildFrontmatter(
	title: string,
	options: GenerationOptions | undefined,
	template: Template | null,
	extractedFrontmatter: Record<string, unknown>,
	buildMetadata: () => FrontmatterEntries,
): RenderedFrontmatter {
	if (!(options?.includeFrontmatter ?? true)) {
		return { content: null, warnings: [] };
	}

	const propertyKeys = parseFrontmatterPropertyKeys(options?.frontmatterPropertyAllowlist);
	const lines: string[] = ['---'];

	const globalTags = parseTagList(options?.frontmatterTags);
	const mergeResult = mergeFrontmatter({
		globalTags,
		templateTags: template?.tags ?? [],
		declared: template?.frontmatter ?? [],
		extracted: extractedFrontmatter,
	});

	const merged = mergeResult.merged;

	const entries = buildMetadata();
	entries.set('title', [`title: ${quoteYamlValue(title)}`]);
	entries.set('aliases', ['aliases:', `  - ${quoteYamlValue(title)}`]);
	entries.set('generated', [`generated: ${new Date().toISOString()}`]);
	const tagLines = formatTagLines(merged.tags);
	const tagAnchor = Math.max(propertyKeys.indexOf('title'), propertyKeys.indexOf('aliases'));
	if (tagAnchor < 0) lines.push(...tagLines);

	propertyKeys.forEach((key, index) => {
		lines.push(...(entries.get(key) ?? []));
		if (index === tagAnchor) lines.push(...tagLines);
	});

	for (const [key, value] of Object.entries(merged)) {
		if (key === 'tags') {
			continue;
		}
		lines.push(formatYamlEntry(key, value));
	}

	lines.push('---');
	return { content: lines.join('\n'), warnings: mergeResult.warnings };
}

function formatTagLines(tags: unknown): string[] {
	if (!Array.isArray(tags) || tags.length === 0) return [];
	return ['tags:', ...tags.map((tag) => `  - ${tag}`)];
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
			return { ok: false, reason: `expected one of ${(declaration.enumValues ?? []).join('|')}, got ${typeOf(value)} (${truncate(formatYamlScalar(value), 30)})` };
		case 'date':
			if (value === null) {
				return { ok: true, value: null };
			}
			if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
				return { ok: true, value };
			}
			return { ok: false, reason: `expected ISO date string or null, got ${typeOf(value)} (${truncate(formatYamlScalar(value), 30)})` };
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
