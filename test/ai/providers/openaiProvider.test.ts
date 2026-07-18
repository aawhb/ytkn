import { afterEach, describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import { OpenAIProvider } from '../../../src/ai/providers/openai';

function completionResponse(content = 'ok', finishReason = 'stop'): any {
	const payload = { choices: [{ message: { content }, finish_reason: finishReason }] };
	return {
		status: 200,
		headers: { 'content-type': 'application/json' },
		arrayBuffer: new ArrayBuffer(0),
		json: payload,
		text: JSON.stringify(payload),
	};
}

describe('OpenAIProvider', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('constructs without apiKey for OpenAI-compatible endpoints', () => {
		expect(() => new OpenAIProvider(
			'openai-compatible', '', 'test-model', 0.1, 300000, 'http://localhost:11434/v1',
		)).not.toThrow();
	});

	it('uses the CORS-free Obsidian transport for authenticated compatible endpoints', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(completionResponse('gateway summary'));

		const provider = new OpenAIProvider(
			'openai-compatible', 'gateway-key', 'test-model', 0.1, 300000, 'https://gateway.example/v1',
		);

		await expect(provider.summarizeVideo('prompt')).resolves.toBe('gateway summary');
		expect(requestUrlSpy).toHaveBeenCalledWith(expect.objectContaining({
			url: 'https://gateway.example/v1/chat/completions',
			method: 'POST',
			headers: expect.objectContaining({ Authorization: 'Bearer gateway-key' }),
			throw: false,
		}));
	});

	it('forces non-streaming requests for OpenAI-compatible endpoints', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(completionResponse());
		const provider = new OpenAIProvider(
			'openai-compatible', '', 'test-model', 0.1, 300000, 'http://localhost:11434/v1',
		);

		const summary = await provider.summarizeVideo('prompt');

		expect(summary).toBe('ok');
		expect(requestUrlSpy).toHaveBeenCalledTimes(1);
		const request = requestUrlSpy.mock.calls[0][0] as any;
		const body = JSON.parse(request.body);
		expect(body).toMatchObject({
			model: 'test-model',
			temperature: 0.1,
			stream: false,
		});
		expect(body).not.toHaveProperty('reasoning_effort');
		expect(body).not.toHaveProperty('max_tokens');
		expect(request.headers).not.toHaveProperty('Authorization');
	});

	it('posts to the standard OpenAI-compatible chat completions endpoint', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(completionResponse());
		const provider = new OpenAIProvider(
			'openai-compatible', '', 'test-model', 0.1, 300000, 'https://example.com/openai/',
		);

		await provider.summarizeVideo('prompt');

		expect((requestUrlSpy.mock.calls[0][0] as any).url).toBe('https://example.com/openai/chat/completions');
	});

	it('uses the standard compatible endpoint for Ollama URLs', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(completionResponse('compatible summary'));
		const provider = new OpenAIProvider(
			'openai-compatible', '', 'qwen3.5:4b', 0.3, 300000, 'http://localhost:11434/v1',
		);

		await expect(provider.summarizeVideo('prompt')).resolves.toBe('compatible summary');
		expect((requestUrlSpy.mock.calls[0][0] as any).url).toBe('http://localhost:11434/v1/chat/completions');
	});

	it('rejects promptly when a compatible request is canceled', async () => {
		let resolveNativeRequest!: (response: any) => void;
		vi.spyOn(obsidian, 'requestUrl').mockReturnValue(new Promise((resolve) => {
			resolveNativeRequest = resolve;
		}) as any);
		const controller = new AbortController();
		const provider = new OpenAIProvider(
			'openai-compatible', '', 'test-model', 0.1, 300000, 'https://gateway.example/v1',
		);
		const request = provider.summarizeVideo('prompt', controller.signal);

		controller.abort(new Error('Generation canceled by user.'));

		await expect(request).rejects.toThrow('Generation canceled by user.');
		resolveNativeRequest(completionResponse('late result'));
		await Promise.resolve();
	});

	it('does not start a compatible request when already canceled', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl');
		const controller = new AbortController();
		controller.abort(new Error('Generation canceled by user.'));
		const provider = new OpenAIProvider(
			'openai-compatible', '', 'test-model', 0.1, 300000, 'https://gateway.example/v1',
		);

		await expect(provider.summarizeVideo('prompt', controller.signal)).rejects.toThrow('Generation canceled by user.');
		expect(requestUrlSpy).not.toHaveBeenCalled();
	});

	it('rejects promptly when a compatible request times out', async () => {
		vi.useFakeTimers();
		vi.spyOn(obsidian, 'requestUrl').mockReturnValue(new Promise(() => undefined) as any);
		const provider = new OpenAIProvider(
			'openai-compatible', '', 'test-model', 0.1, 50, 'https://gateway.example/v1',
		);
		const request = provider.summarizeVideo('prompt');
		const expectation = expect(request).rejects.toThrow('Request timed out after 50ms');

		await vi.advanceTimersByTimeAsync(50);

		await expectation;
	});

	it('reports compatible HTTP and JSON failures clearly', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl');
		const provider = new OpenAIProvider(
			'openai-compatible', '', 'test-model', 0.1, 300000, 'https://gateway.example/v1',
		);

		requestUrlSpy.mockResolvedValueOnce({ ...completionResponse(), status: 401, text: 'unauthorized' });
		await expect(provider.summarizeVideo('prompt')).rejects.toThrow('Request failed: 401 unauthorized');

		requestUrlSpy.mockResolvedValueOnce({ ...completionResponse(), text: 'not json' });
		await expect(provider.summarizeVideo('prompt')).rejects.toThrow('Failed to parse JSON response');
	});

	it('uses the Obsidian transport for official OpenAI requests', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(completionResponse('official summary'));
		const provider = new OpenAIProvider('openai', 'openai-key', 'gpt-test', 0.1, 300000);

		await expect(provider.summarizeVideo('prompt')).resolves.toBe('official summary');
		expect(requestUrlSpy).toHaveBeenCalledWith(expect.objectContaining({
			url: 'https://api.openai.com/v1/chat/completions',
			headers: expect.objectContaining({
				Authorization: 'Bearer openai-key',
				'Content-Type': 'application/json',
			}),
		}));
	});
});
