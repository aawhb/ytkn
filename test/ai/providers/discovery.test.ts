import { afterEach, describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';

let mockFetch: ReturnType<typeof vi.fn>;

vi.mock('../../../src/utils', async (importOriginal) => {
	const original = await importOriginal<Record<string, unknown>>();
	return {
		...original,
		get fetchFn() {
			return mockFetch;
		},
	};
});

import { discoverProviderModels } from '../../../src/ai/providers/discovery';
import { requestUrlJson } from '../../../src/ai/providers/requestUrlJson';

function modelResponse(modelIds: string[], status = 200): any {
	const payload = { data: modelIds.map((id) => ({ id })) };
	return {
		status,
		headers: { 'content-type': 'application/json' },
		arrayBuffer: new ArrayBuffer(0),
		json: payload,
		text: status >= 200 && status < 300 ? JSON.stringify(payload) : 'request denied',
	};
}

afterEach(() => {
	vi.restoreAllMocks();
	mockFetch = vi.fn();
	vi.useRealTimers();
});

describe('requestUrlJson browser fallback boundary', () => {
	it('does not fall back after a logical cancellation', async () => {
		vi.spyOn(obsidian, 'requestUrl').mockReturnValue(new Promise(() => undefined) as any);
		mockFetch = vi.fn().mockResolvedValue({ status: 200, text: async () => '{"ok":true}' });
		const controller = new AbortController();
		const options = {
			fallbackToFetch: true,
			signal: controller.signal,
		} as unknown as NonNullable<Parameters<typeof requestUrlJson>[1]>;
		const request = requestUrlJson('https://api.example.com/models', options);

		controller.abort(new Error('Canceled'));

		await expect(request).rejects.toThrow('Canceled');
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('does not fall back after a logical timeout', async () => {
		vi.useFakeTimers();
		vi.spyOn(obsidian, 'requestUrl').mockReturnValue(new Promise(() => undefined) as any);
		mockFetch = vi.fn().mockResolvedValue({ status: 200, text: async () => '{"ok":true}' });
		const options = {
			fallbackToFetch: true,
			timeoutMs: 50,
		} as unknown as NonNullable<Parameters<typeof requestUrlJson>[1]>;
		const request = requestUrlJson('https://api.example.com/models', options);
		const expectation = expect(request).rejects.toThrow('Request timed out after 50ms');

		await vi.advanceTimersByTimeAsync(50);

		await expectation;
		expect(mockFetch).not.toHaveBeenCalled();
	});
});

describe('discoverProviderModels — openai-compatible with Ollama', () => {
	it('retains the browser fallback when the Obsidian transport itself fails', async () => {
		vi.spyOn(obsidian, 'requestUrl').mockRejectedValue(new Error('native transport unavailable'));
		mockFetch = vi.fn().mockResolvedValue({
			status: 200,
			text: async () => JSON.stringify({ data: [{ id: 'llama3' }] }),
		});

		const models = await discoverProviderModels({
			name: 'Local',
			type: 'openai-compatible',
			apiKey: '',
			url: 'http://localhost:11434/v1',
			models: [],
		});

		expect(models[0].name).toBe('llama3');
		expect(mockFetch).toHaveBeenCalledWith(
			'http://localhost:11434/v1/models',
			expect.objectContaining({ method: 'GET' }),
		);
	});

	it('uses the CORS-free Obsidian transport and returns sorted models', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(modelResponse(['mistral', 'llama3']));

		const models = await discoverProviderModels({
			name: 'Local',
			type: 'openai-compatible',
			apiKey: '',
			url: 'http://localhost:11434/v1',
			models: [],
		});

		expect(models.map((model) => model.name)).toEqual(['llama3', 'mistral']);
		expect(requestUrlSpy).toHaveBeenCalledWith(expect.objectContaining({
			url: 'http://localhost:11434/v1/models',
			method: 'GET',
			throw: false,
		}));
	});

	it('returns standard discovered model fields only', async () => {
		vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(modelResponse(['llama3']));

		const models = await discoverProviderModels({
			name: 'Local',
			type: 'openai-compatible',
			apiKey: '',
			url: 'http://localhost:11434/v1',
			models: [],
		});

		expect(models).toEqual([{
			name: 'llama3',
			displayName: 'llama3',
			contextWindow: undefined,
		}]);
	});
});

describe('discoverProviderModels — openai-compatible with non-Ollama URL', () => {
	it('uses the standard models endpoint and bearer authentication', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(modelResponse(['model-a']));

		const models = await discoverProviderModels({
			name: 'Custom',
			type: 'openai-compatible',
			apiKey: 'gateway-key',
			url: 'https://api.example.com/openai',
			models: [],
		});

		expect(models[0]).toEqual({
			name: 'model-a',
			displayName: 'model-a',
			contextWindow: undefined,
		});
		expect(requestUrlSpy).toHaveBeenCalledWith(expect.objectContaining({
			url: 'https://api.example.com/openai/models',
			headers: { Authorization: 'Bearer gateway-key' },
		}));
	});

	it('preserves the native HTTP error instead of falling back to browser fetch', async () => {
		vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(modelResponse([], 401));
		mockFetch = vi.fn();

		await expect(discoverProviderModels({
			name: 'Custom',
			type: 'openai-compatible',
			apiKey: 'bad-key',
			url: 'https://api.example.com/openai',
			models: [],
		})).rejects.toThrow('Request failed: 401 request denied');
		expect(mockFetch).not.toHaveBeenCalled();
	});
});
