import { describe, expect, it } from 'vitest';
import { mergeFrontmatter, SACRED_FRONTMATTER_KEYS } from '../../src/services/templates/frontmatter-merge';
import type { FrontmatterDeclaration } from '../../src/types';

const declared: FrontmatterDeclaration[] = [
	{ key: 'topics', type: 'string[]', description: '' },
	{ key: 'key_takeaway', type: 'string', description: '' },
	{ key: 'confidence', type: 'enum', enumValues: ['high', 'medium', 'low'], description: '' },
	{ key: 'claims_count', type: 'number', description: '' },
	{ key: 'last_reviewed', type: 'date', description: '', default: null },
];

describe('mergeFrontmatter', () => {
	it('drops AI-emitted sacred fields with a warning', () => {
		const result = mergeFrontmatter({
			globalTags: [],
			templateTags: [],
			declared,
			extracted: { videoId: 'evil', confidence: 'high' },
		});
		expect(result.merged.videoId).toBeUndefined();
		expect(result.merged.confidence).toBe('high');
		expect(result.warnings.some((w) => w.includes('videoId'))).toBe(true);
	});

	it('unions and deduplicates tags from global + template + extracted', () => {
		const result = mergeFrontmatter({
			globalTags: ['vault/inbox', 'youtube'],
			templateTags: ['ytkn/general'],
			declared,
			extracted: { tags: ['custom-tag', 'youtube'] },
		});
		expect(result.merged.tags).toEqual(['vault/inbox', 'youtube', 'ytkn/general', 'custom-tag']);
	});

	it('uses AI value when it passes type validation', () => {
		const result = mergeFrontmatter({
			globalTags: [],
			templateTags: [],
			declared,
			extracted: { topics: ['a', 'b'], confidence: 'medium', claims_count: 7 },
		});
		expect(result.merged.topics).toEqual(['a', 'b']);
		expect(result.merged.confidence).toBe('medium');
		expect(result.merged.claims_count).toBe(7);
	});

	it('falls back to default when AI value fails type validation', () => {
		const result = mergeFrontmatter({
			globalTags: [],
			templateTags: [],
			declared,
			extracted: { last_reviewed: 'not-a-date' },
		});
		expect(result.merged.last_reviewed).toBeNull();
		expect(result.warnings.some((w) => w.includes('last_reviewed'))).toBe(true);
	});

	it('omits declared key when no value and no default', () => {
		const result = mergeFrontmatter({
			globalTags: [],
			templateTags: [],
			declared,
			extracted: {},
		});
		expect('topics' in result.merged).toBe(false);
		expect('confidence' in result.merged).toBe(false);
	});

	it('drops unknown AI keys with warnings', () => {
		const result = mergeFrontmatter({
			globalTags: [],
			templateTags: [],
			declared,
			extracted: { invented_key: 'value' },
		});
		expect('invented_key' in result.merged).toBe(false);
		expect(result.warnings.some((w) => w.includes('invented_key'))).toBe(true);
	});

	it('rejects enum values outside declared enumValues', () => {
		const result = mergeFrontmatter({
			globalTags: [],
			templateTags: [],
			declared,
			extracted: { confidence: 'sometimes' },
		});
		expect('confidence' in result.merged).toBe(false);
		expect(result.warnings.some((w) => w.includes('confidence'))).toBe(true);
	});

	it('coerces array of length 1 to a single-element array, not a scalar', () => {
		const result = mergeFrontmatter({
			globalTags: [],
			templateTags: [],
			declared,
			extracted: { topics: ['single'] },
		});
		expect(result.merged.topics).toEqual(['single']);
	});

	it('rejects scalar where array is declared, with warning', () => {
		const result = mergeFrontmatter({
			globalTags: [],
			templateTags: [],
			declared,
			extracted: { topics: 'should-be-array' },
		});
		expect('topics' in result.merged).toBe(false);
		expect(result.warnings.some((w) => w.includes('topics'))).toBe(true);
	});

	it('covers all expected sacred keys including videoCount', () => {
		expect(SACRED_FRONTMATTER_KEYS).toContain('videoCount');
		expect(SACRED_FRONTMATTER_KEYS).toContain('videoId');
		expect(SACRED_FRONTMATTER_KEYS).toContain('playlistId');
		const result = mergeFrontmatter({
			globalTags: [],
			templateTags: [],
			declared,
			extracted: { videoCount: 99, topics: ['a'] },
		});
		expect(result.merged.videoCount).toBeUndefined();
		expect(result.merged.topics).toEqual(['a']);
		expect(result.warnings.some((w) => w.includes('videoCount'))).toBe(true);
	});
});
