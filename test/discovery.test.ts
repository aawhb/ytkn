import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	detectAnthropicReasoningSupport,
	detectGeminiReasoningSupport,
	detectOpenAIReasoningSupport,
} from '../src/services/providers/shared';

// fetchFn is captured as a module-level constant in utils.ts, so we must mock the module
// before discovery.ts imports it, to control which fetch implementation is used.
let mockFetch: ReturnType<typeof vi.fn>;

vi.mock('../src/utils', async (importOriginal) => {
	const original = await importOriginal<typeof import('../src/utils')>();
	return {
		...original,
		get fetchFn() {
			return mockFetch;
		},
	};
});

import { discoverProviderModels } from '../src/services/providers/discovery';

afterEach(() => {
	vi.clearAllMocks();
});

describe('detectOpenAIReasoningSupport', () => {
	it('returns supported for o-series models', () => {
		expect(detectOpenAIReasoningSupport('o1')).toBe('supported');
		expect(detectOpenAIReasoningSupport('o3')).toBe('supported');
		expect(detectOpenAIReasoningSupport('o4-mini')).toBe('supported');
	});

	it('returns supported for gpt-5 family', () => {
		expect(detectOpenAIReasoningSupport('gpt-5')).toBe('supported');
		expect(detectOpenAIReasoningSupport('gpt-5-turbo')).toBe('supported');
	});

	it('returns unsupported for non-reasoning models', () => {
		expect(detectOpenAIReasoningSupport('gpt-4o')).toBe('unsupported');
		expect(detectOpenAIReasoningSupport('gpt-4')).toBe('unsupported');
		expect(detectOpenAIReasoningSupport('test-model')).toBe('unsupported');
	});
});

describe('detectAnthropicReasoningSupport', () => {
	it('returns supported for claude 4.x models', () => {
		expect(detectAnthropicReasoningSupport('claude-opus-4-7')).toBe('supported');
		expect(detectAnthropicReasoningSupport('claude-opus-4-20251101')).toBe('supported');
		expect(detectAnthropicReasoningSupport('claude-sonnet-4-6')).toBe('supported');
		expect(detectAnthropicReasoningSupport('claude-haiku-4-5-20251001')).toBe('supported');
	});

	it('returns supported for claude 3.7 models', () => {
		expect(detectAnthropicReasoningSupport('claude-sonnet-3-7-20250219')).toBe('supported');
	});

	it('returns unsupported for older claude models', () => {
		expect(detectAnthropicReasoningSupport('claude-3-5-sonnet')).toBe('unsupported');
		expect(detectAnthropicReasoningSupport('claude-3-opus-20240229')).toBe('unsupported');
	});
});

describe('detectGeminiReasoningSupport', () => {
	it('returns supported for gemini 2.5 models', () => {
		expect(detectGeminiReasoningSupport('gemini-2.5-pro')).toBe('supported');
		expect(detectGeminiReasoningSupport('gemini-2.5-flash')).toBe('supported');
	});

	it('returns supported for gemini 3.x models', () => {
		expect(detectGeminiReasoningSupport('gemini-3-pro')).toBe('supported');
	});

	it('returns unsupported for older gemini models', () => {
		expect(detectGeminiReasoningSupport('gemini-2.0-flash')).toBe('unsupported');
		expect(detectGeminiReasoningSupport('gemini-1.5-pro')).toBe('unsupported');
	});
});

describe('discoverProviderModels — openai-compatible with Ollama', () => {
	beforeEach(() => {
		mockFetch = vi.fn();
	});

	it('falls back to native fetch when requestUrl throws and returns sorted models', async () => {
		// requestUrl always throws (see test/mocks/obsidian.ts)
		// First fetch call: model list; second + third: ollama metadata per model
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [{ id: 'mistral' }, { id: 'llama3' }] }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ capabilities: [], model_info: {} }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ capabilities: [], model_info: {} }),
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
	});

	it('extracts context window and thinking capability from ollama metadata', async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [{ id: 'llama3' }] }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					capabilities: ['thinking'],
					model_info: { 'llama3.context_length': 32768 },
				}),
			});

		const models = await discoverProviderModels({
			name: 'Local',
			type: 'openai-compatible',
			apiKey: '',
			url: 'http://localhost:11434/v1',
			models: [],
		});

		expect(models).toHaveLength(1);
		expect(models[0].name).toBe('llama3');
		expect(models[0].reasoningSupport).toBe('supported');
		expect(models[0].contextWindow).toBe(32768);
	});
});

describe('discoverProviderModels — openai-compatible with non-Ollama URL', () => {
	beforeEach(() => {
		mockFetch = vi.fn();
	});

	it('returns models with unsupported reasoning for non-Ollama endpoint', async () => {
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
		expect(models[0].name).toBe('model-a');
		expect(models[0].reasoningSupport).toBe('unsupported');
	});
});
