import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../../src/services/providers/openai';

describe('OpenAIProvider', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('constructs without apiKey for OpenAI-compatible endpoints', () => {
		expect(() => new OpenAIProvider('', 'test-model', 0.1, 300000, 'http://localhost:11434/v1')).not.toThrow();
	});

	it('forces non-streaming requests for OpenAI-compatible endpoints', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }),
		});

		vi.stubGlobal('fetch', fetchMock);

		const provider = new OpenAIProvider('', 'test-model', 0.1, 300000, 'http://localhost:11434/v1');
		const summary = await provider.summarizeVideo('prompt');

		expect(summary).toBe('ok');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [, request] = fetchMock.mock.calls[0];
		expect(JSON.parse(request.body)).toMatchObject({
			model: 'test-model',
			temperature: 0.1,
			stream: false,
		});
		expect(JSON.parse(request.body)).not.toHaveProperty('reasoning_effort');
		// No max_tokens in request body — model decides output length
		expect(JSON.parse(request.body)).not.toHaveProperty('max_tokens');
	});

	it('does not infer reasoning fields from model names like o3-mini', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }),
		});

		vi.stubGlobal('fetch', fetchMock);

		const provider = new OpenAIProvider('', 'o3-mini', 0.1, 300000, 'https://api.openai.com/v1');
		await provider.summarizeVideo('prompt');

		const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
		expect(body).not.toHaveProperty('reasoning_effort');
		expect(body.temperature).toBe(0.1);
	});

	it('posts to the standard OpenAI-compatible chat completions endpoint', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }),
		});

		vi.stubGlobal('fetch', fetchMock);

		const provider = new OpenAIProvider('', 'test-model', 0.1, 300000, 'https://example.com/openai');
		await provider.summarizeVideo('prompt');

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/openai/chat/completions');
	});

	it('uses standard OpenAI-compatible endpoint for Ollama URLs', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				choices: [{ message: { content: 'compatible summary' }, finish_reason: 'stop' }],
			}),
		});

		vi.stubGlobal('fetch', fetchMock);

		const provider = new OpenAIProvider('', 'qwen3.5:4b', 0.3, 300000, 'http://localhost:11434/v1');
		const summary = await provider.summarizeVideo('prompt');

		expect(summary).toBe('compatible summary');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/v1/chat/completions');
	});
});
