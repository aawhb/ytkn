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

	it('normalizes channel content defaults and preserves an unlimited selection', () => {
		const defaults = normalizeOutputDefaults(undefined);
		expect(defaults.channelContentTypes).toEqual(['videos', 'shorts', 'streams']);
		expect(defaults.channelVideoLimit).toBe(10);

		const customized = normalizeOutputDefaults({
			channelContentTypes: ['shorts', 'shorts', 'unsupported'],
			channelVideoLimit: null,
		} as never);
		expect(customized.channelContentTypes).toEqual(['shorts']);
		expect(customized.channelVideoLimit).toBeNull();
	});
});
