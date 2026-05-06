import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../src/services/providers/openai';

describe('OpenAIProvider', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('constructs without apiKey for OpenAI-compatible endpoints', () => {
		expect(() => new OpenAIProvider('', 'test-model', 0.1, 'provider-default', 300000, 'http://localhost:11434/v1')).not.toThrow();
	});

	it('forces non-streaming requests and disables reasoning when mode is off', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }),
		});

		vi.stubGlobal('fetch', fetchMock);

		const provider = new OpenAIProvider('', 'test-model', 0.1, 'off', 300000, 'http://localhost:11434/v1');
		const summary = await provider.summarizeVideo('prompt');

		expect(summary).toBe('ok');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [, request] = fetchMock.mock.calls[0];
		expect(JSON.parse(request.body)).toMatchObject({
			model: 'test-model',
			stream: false,
		});
		// Non-reasoning models don't get reasoning_effort
		expect(JSON.parse(request.body)).not.toHaveProperty('reasoning_effort');
		// No max_tokens in request body — model decides output length
		expect(JSON.parse(request.body)).not.toHaveProperty('max_tokens');
	});

	it('sends reasoning_effort medium for OpenAI reasoning models when reasoning is on', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }),
		});

		vi.stubGlobal('fetch', fetchMock);

		// o3-mini is an OpenAI reasoning model; empty apiKey forces fetch-based client (mockable)
		const provider = new OpenAIProvider('', 'o3-mini', 0.1, 'on', 300000, 'https://api.openai.com');
		await provider.summarizeVideo('prompt');

		const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
		expect(body.reasoning_effort).toBe('medium');
		// Temperature is omitted for reasoning models
		expect(body).not.toHaveProperty('temperature');
	});

	it('does not send reasoning_effort for generic OpenAI-compat models', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }),
		});

		vi.stubGlobal('fetch', fetchMock);

		const provider = new OpenAIProvider('', 'test-model', 0.1, 'on', 300000, 'https://example.com/openai');
		await provider.summarizeVideo('prompt');

		const [, request] = fetchMock.mock.calls[0];
		const body = JSON.parse(request.body);
		expect(body).not.toHaveProperty('reasoning_effort');
		// Temperature still sent for non-reasoning models
		expect(body.temperature).toBe(0.1);
	});

	it('goes directly to native Ollama chat when reasoning is on', async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				message: { content: 'native summary' },
				done_reason: 'stop',
			}),
		});

		vi.stubGlobal('fetch', fetchMock);

		const provider = new OpenAIProvider('', 'qwen3.5:4b', 0.3, 'on', 300000, 'http://localhost:11434/v1');
		const summary = await provider.summarizeVideo('prompt');

		expect(summary).toBe('native summary');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/api/chat');
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
			stream: false,
			think: true,
			options: {
				num_predict: -1,
				temperature: 0.3,
			},
		});
	});

	it('falls back to compatible endpoint when native Ollama fails with reasoning on', async () => {
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new Error('native failed'))
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [{ message: { content: 'compatible summary' }, finish_reason: 'stop' }],
				}),
			});

		vi.stubGlobal('fetch', fetchMock);

		const provider = new OpenAIProvider('', 'qwen3.5:4b', 0.3, 'on', 300000, 'http://localhost:11434/v1');
		const summary = await provider.summarizeVideo('prompt');

		expect(summary).toBe('compatible summary');
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/api/chat');
		expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:11434/v1/chat/completions');
	});
});
