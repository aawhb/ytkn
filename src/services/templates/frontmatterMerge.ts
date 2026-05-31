import type { FrontmatterDeclaration, FrontmatterFieldType } from '../../types';

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
