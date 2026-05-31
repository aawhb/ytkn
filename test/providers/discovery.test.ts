import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// fetchFn is captured as a module-level constant in utils.ts, so we must mock the module
// before discovery.ts imports it, to control which fetch implementation is used.
let mockFetch: ReturnType<typeof vi.fn>;

vi.mock('../../src/utils', async (importOriginal) => {
	const original = await importOriginal<typeof import('../../src/utils')>();
	return {
		...original,
		get fetchFn() {
			return mockFetch;
		},
	};
});

import { discoverProviderModels } from '../../src/services/providers/discovery';

afterEach(() => {
	vi.clearAllMocks();
});

describe('discoverProviderModels — openai-compatible with Ollama', () => {
	beforeEach(() => {
		mockFetch = vi.fn();
	});

	it('falls back to native fetch when requestUrl throws and returns sorted models', async () => {
		// requestUrl always throws (see test/mocks/obsidian.ts)
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ data: [{ id: 'mistral' }, { id: 'llama3' }] }),
		});

		const models = await discoverProviderModels({
			name: 'Local',
			type: 'openai-compatible',
			apiKey: '',
			url: 'http://localhost:11434/v1',
			models: [],
		});

		expect(models).toHaveLength(2);
		expect(models[0].name).toBe('llama3');
		expect(models[1].name).toBe('mistral');
		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:11434/v1/models');
	});

	it('returns standard discovered model fields only', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ data: [{ id: 'llama3' }] }),
		});

		const models = await discoverProviderModels({
			name: 'Local',
			type: 'openai-compatible',
			apiKey: '',
			url: 'http://localhost:11434/v1',
			models: [],
		});

		expect(models).toHaveLength(1);
		expect(models[0]).toEqual({
			name: 'llama3',
			displayName: 'llama3',
			contextWindow: undefined,
		});
	});
});

describe('discoverProviderModels — openai-compatible with non-Ollama URL', () => {
	beforeEach(() => {
		mockFetch = vi.fn();
	});

	it('returns models from the standard models endpoint', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ data: [{ id: 'model-a' }] }),
		});

		const models = await discoverProviderModels({
			name: 'Custom',
			type: 'openai-compatible',
			apiKey: '',
			url: 'https://api.example.com/openai',
			models: [],
		});

		expect(models).toHaveLength(1);
		expect(models[0]).toEqual({
			name: 'model-a',
			displayName: 'model-a',
			contextWindow: undefined,
		});
	});
});
