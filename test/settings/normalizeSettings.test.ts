import { describe, expect, it } from 'vitest';
import { normalizeOutputDefaults } from '../../src/settings/normalizeSettings';

describe('normalizeOutputDefaults', () => {
	it('defaults openCreatedNote to false', () => {
		expect(normalizeOutputDefaults(undefined).openCreatedNote).toBe(false);
		expect(normalizeOutputDefaults({}).openCreatedNote).toBe(false);
	});

	it('preserves a stored openCreatedNote value', () => {
		expect(normalizeOutputDefaults({ openCreatedNote: true }).openCreatedNote).toBe(true);
	});
});
