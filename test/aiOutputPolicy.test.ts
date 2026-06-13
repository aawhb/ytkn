import { describe, expect, it } from 'vitest';
import { resolveLegacyUseAi, shouldGenerateAiSummary, shouldUseAi } from '../src/aiOutputPolicy';

describe('AI output policy', () => {
	it('derives AI execution from the requested output flags', () => {
		const addOnOnly = {
			useAi: true,
			generateAiSummary: false,
			tldrCalloutAtTop: false,
			includeMindmap: true,
			includeMemorableQuotes: false,
		};

		expect(shouldUseAi(addOnOnly)).toBe(true);
		expect(shouldGenerateAiSummary(addOnOnly)).toBe(false);
		expect(shouldUseAi({ ...addOnOnly, useAi: false })).toBe(false);
		expect(shouldGenerateAiSummary({ ...addOnOnly, generateAiSummary: true })).toBe(true);
	});

	it.each([
		{ options: { useAi: true }, fallback: false, expected: true },
		{ options: { useAi: false }, fallback: true, expected: false },
		{ options: {}, fallback: true, expected: true },
	])('resolves the current AI setting with its default: $options', ({ options, fallback, expected }) => {
		expect(resolveLegacyUseAi(options, fallback)).toBe(expected);
	});
});
