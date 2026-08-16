import { describe, expect, it } from 'vitest';
import {
	BUILT_IN_FRONTMATTER_PROPERTIES,
	createDefaultFrontmatterPropertyPreferences,
	normalizeFrontmatterPropertyPreferences,
	parseFrontmatterPropertyKeys,
	serializeEnabledFrontmatterProperties,
	validateCustomFrontmatterProperty,
} from '../src/frontmatterProperties';

describe('frontmatter property preferences', () => {
	it('creates enabled built-in defaults in canonical order', () => {
		expect(createDefaultFrontmatterPropertyPreferences()).toEqual(
			BUILT_IN_FRONTMATTER_PROPERTIES.map(({ key }) => ({ key, enabled: true })),
		);
	});

	it('migrates built-in and custom keys from a legacy allowlist', () => {
		const preferences = normalizeFrontmatterPropertyPreferences(undefined, 'videoId title topic bad:key');

		expect(preferences.filter((preference) => preference.enabled).map((preference) => preference.key))
			.toEqual(['title', 'videoId', 'topic']);
		expect(preferences).toHaveLength(BUILT_IN_FRONTMATTER_PROPERTIES.length + 1);
	});

	it('normalizes saved order, duplicates, and missing built-ins', () => {
		const preferences = normalizeFrontmatterPropertyPreferences([
			{ key: 'videoId', enabled: true },
			{ key: 'title', enabled: false },
			{ key: 'videoId', enabled: false },
			{ key: 'topic', enabled: true },
		]);

		expect(preferences.slice(0, 3)).toEqual([
			{ key: 'videoId', enabled: true },
			{ key: 'title', enabled: false },
			{ key: 'topic', enabled: true },
		]);
		expect(preferences).toHaveLength(BUILT_IN_FRONTMATTER_PROPERTIES.length + 1);
	});

	it('serializes and parses enabled built-ins without losing order', () => {
		const serialized = serializeEnabledFrontmatterProperties([
			{ key: 'videoId', enabled: true },
			{ key: 'title', enabled: false },
			{ key: 'channel', enabled: true },
		]);

		expect(serialized).toBe('videoId channel');
		expect(parseFrontmatterPropertyKeys('videoId topic bad:key channel topic')).toEqual([
			'videoId',
			'topic',
			'channel',
		]);
	});

	it('validates custom property names and reserved keys', () => {
		expect(validateCustomFrontmatterProperty('review_status', ['topic'])).toBeUndefined();
		expect(validateCustomFrontmatterProperty('title', [])).toContain('built-in');
		expect(validateCustomFrontmatterProperty('tags', [])).toContain('frontmatter tags');
		expect(validateCustomFrontmatterProperty('topic', ['topic'])).toContain('already exists');
	});
});
