import type { FrontmatterPropertyPreference } from './types';

export interface FrontmatterPropertyDefinition {
	key: string;
	description: string;
	aliases?: string[];
}

export const BUILT_IN_FRONTMATTER_PROPERTIES: readonly FrontmatterPropertyDefinition[] = [
	{ key: 'title', description: 'The video, playlist, or channel title.' },
	{ key: 'aliases', description: 'Add the source title as an Obsidian alias.' },
	{ key: 'source', description: 'Identify the note source as YouTube, a playlist, or a channel.' },
	{ key: 'channel', description: 'The channel name.' },
	{ key: 'channelUrl', description: 'The channel URL.' },
	{ key: 'channelId', description: 'The YouTube channel ID.' },
	{ key: 'videoUrl', description: 'The source video URL.' },
	{ key: 'playlistUrl', description: 'The source playlist URL.' },
	{ key: 'videoId', description: 'The YouTube video ID.' },
	{ key: 'playlistId', description: 'The YouTube playlist ID.' },
	{ key: 'thumbnailUrl', description: 'The source thumbnail URL.' },
	{ key: 'videoDescription', description: 'The description supplied by the video author.' },
	{ key: 'uploadDate', description: 'The video upload date.' },
	{ key: 'videoCategory', description: 'The YouTube video category.' },
	{ key: 'durationSeconds', description: 'The video duration in seconds.' },
	{ key: 'keywords', description: 'Keywords supplied in the video metadata.' },
	{ key: 'generated', description: 'The date and time when YTKN generated the note.' },
	{ key: 'videoCount', description: 'The number of videos in a playlist or channel result.' },
];

const BUILT_IN_KEYS = new Set(BUILT_IN_FRONTMATTER_PROPERTIES.map((property) => property.key));
const RESERVED_CUSTOM_KEYS = new Set(['tags']);
const FRONTMATTER_PROPERTY_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

export function createDefaultFrontmatterPropertyPreferences(): FrontmatterPropertyPreference[] {
	return BUILT_IN_FRONTMATTER_PROPERTIES.map(({ key }) => ({ key, enabled: true }));
}

export function normalizeFrontmatterPropertyPreferences(
	value: unknown,
	legacyAllowlist?: string,
): FrontmatterPropertyPreference[] {
	if (!Array.isArray(value)) {
		const selected = legacyAllowlist === undefined
			? BUILT_IN_FRONTMATTER_PROPERTIES.map(({ key }) => key)
			: parseFrontmatterPropertyKeys(legacyAllowlist);
		const enabled = new Set(selected);
		return [
			...BUILT_IN_FRONTMATTER_PROPERTIES.map(({ key }) => ({ key, enabled: enabled.has(key) })),
			...selected
				.filter((key) => !BUILT_IN_KEYS.has(key))
				.map((key) => ({ key, enabled: true })),
		];
	}

	const preferences: FrontmatterPropertyPreference[] = [];
	const seen = new Set<string>();
	for (const entry of value as unknown[]) {
		if (!entry || typeof entry !== 'object') continue;
		const candidate = entry as Record<string, unknown>;
		const key = typeof candidate.key === 'string' ? candidate.key : '';
		if (!isValidFrontmatterPropertyKey(key) || seen.has(key)) continue;
		seen.add(key);
		preferences.push({ key, enabled: candidate.enabled === true });
	}

	for (const { key } of BUILT_IN_FRONTMATTER_PROPERTIES) {
		if (!seen.has(key)) preferences.push({ key, enabled: false });
	}
	return preferences;
}

export function serializeEnabledFrontmatterProperties(
	preferences: readonly FrontmatterPropertyPreference[],
): string {
	return preferences
		.filter((preference) => preference.enabled)
		.map((preference) => preference.key)
		.join(' ');
}

export function parseFrontmatterPropertyKeys(value: string | undefined): string[] {
	const input = value ?? serializeEnabledFrontmatterProperties(createDefaultFrontmatterPropertyPreferences());
	const seen = new Set<string>();
	const keys: string[] = [];
	for (const token of input.split(/[\s,]+/)) {
		const key = token.trim();
		if (!isValidFrontmatterPropertyKey(key) || seen.has(key)) continue;
		seen.add(key);
		keys.push(key);
	}
	return keys;
}

export function isBuiltInFrontmatterProperty(key: string): boolean {
	return BUILT_IN_KEYS.has(key);
}

export function validateCustomFrontmatterProperty(
	name: string,
	existing: readonly string[],
	originalName?: string,
): string | undefined {
	const trimmed = name.trim();
	if (!trimmed) return 'Enter a property name.';
	if (!FRONTMATTER_PROPERTY_NAME_PATTERN.test(trimmed)) {
		return 'Use letters, numbers, underscores, or hyphens, and start with a letter or underscore.';
	}
	if (BUILT_IN_KEYS.has(trimmed)) return `${trimmed} is already a built-in property.`;
	if (RESERVED_CUSTOM_KEYS.has(trimmed)) return `${trimmed} is managed by the frontmatter tags setting.`;
	if (trimmed !== originalName && existing.includes(trimmed)) return `${trimmed} already exists.`;
	return undefined;
}

function isValidFrontmatterPropertyKey(key: string): boolean {
	return BUILT_IN_KEYS.has(key)
		|| (FRONTMATTER_PROPERTY_NAME_PATTERN.test(key) && !RESERVED_CUSTOM_KEYS.has(key));
}
