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
		expect(state.modelIds).toEqual(['OpenAI:gpt-test']);
	});

	it('seeds the model chain from saved options, falling back to the legacy single model', () => {
		const fromChain = buildGenerationFormState({
			initialUrl: '',
			availableModels: [model],
			initialOptions: { modelIds: ['A:one', 'B:two'] },
			hasActiveNote: true,
		});
		const fromLegacy = buildGenerationFormState({
			initialUrl: '',
			availableModels: [model],
			initialOptions: { modelId: 'C:three' },
			hasActiveNote: true,
		});

		expect(fromChain.modelIds).toEqual(['A:one', 'B:two']);
		expect(fromLegacy.modelIds).toEqual(['C:three']);
	});

	it('defaults openCreatedNote off and honors saved defaults', () => {
		const defaultState = buildGenerationFormState({
			initialUrl: '',
			availableModels: [],
			initialOptions: {},
			hasActiveNote: true,
		});
		const savedOnState = buildGenerationFormState({
			initialUrl: '',
			availableModels: [],
			initialOptions: { openCreatedNote: true },
			hasActiveNote: true,
		});

		expect(defaultState.openCreatedNote).toBe(false);
		expect(savedOnState.openCreatedNote).toBe(true);
	});

	it('forces folder destination when no active note exists', () => {
		const state = buildGenerationFormState({
			initialUrl: '',
			availableModels: [],
			initialOptions: { noteDestinationMode: 'current-note' },
			hasActiveNote: false,
		});

		expect(state.noteDestinationMode).toBe('folder');
		expect(state.modelIds).toEqual([]);
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
