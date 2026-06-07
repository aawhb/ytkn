import { describe, expect, it } from 'vitest';
import { buildGenerationFormState } from '../../../src/ui/generation/generationFormState';
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

describe('buildGenerationFormState', () => {
	it('uses the active note destination when an active note exists', () => {
		const state = buildGenerationFormState({
			initialUrl: 'https://youtu.be/abc12345678',
			availableModels: [model],
			initialOptions: {},
			hasActiveNote: true,
		});

		expect(state.url).toBe('https://youtu.be/abc12345678');
		expect(state.noteDestinationMode).toBe('current-note');
		expect(state.modelId).toBe('OpenAI:gpt-test');
	});

	it('forces folder destination when no active note exists', () => {
		const state = buildGenerationFormState({
			initialUrl: '',
			availableModels: [],
			initialOptions: { noteDestinationMode: 'current-note' },
			hasActiveNote: false,
		});

		expect(state.noteDestinationMode).toBe('folder');
		expect(state.modelId).toBe('');
	});

	it('fills missing template control defaults', () => {
		const state = buildGenerationFormState({
			initialUrl: '',
			availableModels: [],
			initialOptions: { instructionTemplate: 'full-extract' },
			hasActiveNote: true,
		});

		expect(state.controlValues.density).toBe('comprehensive');
	});
});
