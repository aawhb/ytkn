import { describe, expect, it } from 'vitest';
import {
	BUILT_IN_FRONTMATTER_PROPERTIES,
	createDefaultFrontmatterPropertyPreferences,
	normalizeFrontmatterPropertyPreferences,
	parseFrontmatterPropertyKeys,
	serializeEnabledFrontmatterProperties,
} from '../src/frontmatterProperties';

describe('frontmatter property preferences', () => {
	it('creates enabled built-in defaults in canonical order', () => {
		expect(createDefaultFrontmatterPropertyPreferences()).toEqual(
			BUILT_IN_FRONTMATTER_PROPERTIES.map(({ key }) => ({ key, enabled: true })),
		);
	});

	it('migrates a legacy allowlist and appends missing built-ins disabled', () => {
		const preferences = normalizeFrontmatterPropertyPreferences(undefined, 'videoId title bad:key');

		expect(preferences.filter((preference) => preference.enabled).map((preference) => preference.key))
			.toEqual(['title', 'videoId']);
		expect(preferences).toHaveLength(BUILT_IN_FRONTMATTER_PROPERTIES.length);
	});

	it('normalizes saved order, duplicates, and missing built-ins', () => {
		const preferences = normalizeFrontmatterPropertyPreferences([
			{ key: 'videoId', enabled: true },
			{ key: 'title', enabled: false },
			{ key: 'videoId', enabled: false },
			{ key: 'topic', enabled: true },
		]);

		expect(preferences.slice(0, 2)).toEqual([
			{ key: 'videoId', enabled: true },
			{ key: 'title', enabled: false },
		]);
		expect(preferences).toHaveLength(BUILT_IN_FRONTMATTER_PROPERTIES.length);
	});

	it('serializes and parses enabled built-ins without losing order', () => {
		const serialized = serializeEnabledFrontmatterProperties([
			{ key: 'videoId', enabled: true },
			{ key: 'title', enabled: false },
			{ key: 'channel', enabled: true },
		]);

		expect(serialized).toBe('videoId channel');
		expect(parseFrontmatterPropertyKeys('videoId bad:key channel videoId')).toEqual(['videoId', 'channel']);
	});
});
