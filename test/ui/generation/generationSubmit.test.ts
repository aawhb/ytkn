import { describe, expect, it } from 'vitest';
import { buildGenerationFormState } from '../../../src/ui/generation/generationFormState';
import { buildGenerationSubmit } from '../../../src/ui/generation/generationSubmit';
import type { ModelConfig } from '../../../src/types';

const model: ModelConfig = {
	name: 'gpt-test',
	displayName: 'GPT Test',
	provider: {
		name: 'OpenAI',
		type: 'openai',
		apiKey: 'secret',
	},
};

function baseState() {
	return buildGenerationFormState({
		initialUrl: 'https://youtu.be/abc12345678',
		availableModels: [model],
		initialOptions: {},
		hasActiveNote: true,
	});
}

describe('buildGenerationSubmit', () => {
	it('dedupes URLs and builds the submit payload', () => {
		const state = {
			...baseState(),
			url: 'https://youtu.be/abc12345678 https://youtu.be/abc12345678 https://youtu.be/def12345678',
			temperature: '0.7',
			requestTimeoutSeconds: '30',
			manualInstructions: '  manual text  ',
			includeMindmap: true,
		};

		const result = buildGenerationSubmit(state);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(result.message);
		expect(result.urls).toEqual(['https://youtu.be/abc12345678', 'https://youtu.be/def12345678']);
		expect(result.duplicateCount).toBe(1);
		expect(result.options.temperature).toBe(0.7);
		expect(result.options.requestTimeoutMs).toBe(30000);
		expect(result.options.manualInstructions).toBe('manual text');
		expect(result.options.includeMindmap).toBe(true);
	});

	it('rejects invalid temperature', () => {
		const result = buildGenerationSubmit({ ...baseState(), temperature: '3' });

		expect(result).toEqual({
			ok: false,
			message: 'Temperature must be between 0 and 2.',
			duplicateCount: 0,
		});
	});

	it('requires a destination folder for folder output', () => {
		const result = buildGenerationSubmit({
			...baseState(),
			noteDestinationMode: 'folder',
			noteDestinationFolder: '   ',
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		expect(result.message).toBe('Enter a destination folder, or switch to "current note".');
	});

	it('requires template controls only when summary generation uses templates', () => {
		const result = buildGenerationSubmit({
			...baseState(),
			instructionTemplate: 'research',
			controlValues: {},
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		expect(result.message).toBe('"Research inquiry" is required for this template. Please fill it in.');
	});

	it('allows add-on-only AI without template control values', () => {
		const result = buildGenerationSubmit({
			...baseState(),
			generateAiSummary: false,
			includeMindmap: true,
			instructionTemplate: 'research',
			controlValues: {},
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(result.message);
		expect(result.options.generateAiSummary).toBe(false);
		expect(result.options.includeMindmap).toBe(true);
		expect(result.options.controlValues).toBeUndefined();
	});
});
