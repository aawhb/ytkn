import { afterEach, describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import { GeminiProvider } from '../../../src/ai/providers/gemini';
import { TRUNCATION_NOTICE } from '../../../src/defaults';

function generateResponse(payload: Record<string, unknown>): any {
	return {
		status: 200,
		headers: { 'content-type': 'application/json' },
		arrayBuffer: new ArrayBuffer(0),
		json: payload,
		text: JSON.stringify(payload),
	};
}

describe('GeminiProvider', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('uses the native transport with normalized model paths', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(generateResponse({
			candidates: [{ content: { parts: [{ text: 'summary' }] }, finishReason: 'STOP' }],
		}));
		const provider = new GeminiProvider('key', 'gemini-pro', 0.5, 300000);

		await expect(provider.summarizeVideo('prompt')).resolves.toBe('summary');

		const request = requestUrlSpy.mock.calls[0][0] as any;
		expect(request).toMatchObject({
			url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-goog-api-key': 'key',
			},
		});
		expect(JSON.parse(request.body)).toEqual({
			contents: [{ role: 'user', parts: [{ text: 'prompt' }] }],
			generationConfig: { temperature: 0.5 },
		});
	});

	it('preserves resource prefixes and joins text parts', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(generateResponse({
			candidates: [{ content: { parts: [{ text: 'first' }, { text: ' second' }] } }],
		}));
		const provider = new GeminiProvider('key', 'tunedModels/my model', 0.5, 300000);

		await expect(provider.summarizeVideo('prompt')).resolves.toBe('first second');
		expect((requestUrlSpy.mock.calls[0][0] as any).url)
			.toContain('/tunedModels/my%20model:generateContent');
	});

	it('marks max-token responses as truncated', async () => {
		vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(generateResponse({
			candidates: [{ content: { parts: [{ text: 'partial' }] }, finishReason: 'MAX_TOKENS' }],
		}));
		const provider = new GeminiProvider('key', 'gemini-pro', 0.5, 300000);

		await expect(provider.summarizeVideo('prompt')).resolves.toBe(`partial${TRUNCATION_NOTICE}`);
	});

	it('rejects blocked prompts and candidates', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl');
		const provider = new GeminiProvider('key', 'gemini-pro', 0.5, 300000);
		requestUrlSpy.mockResolvedValueOnce(generateResponse({
			promptFeedback: { blockReason: 'SAFETY' },
		}));

		await expect(provider.summarizeVideo('prompt')).rejects.toThrow('Gemini blocked the prompt: SAFETY');

		requestUrlSpy.mockResolvedValueOnce(generateResponse({
			candidates: [{ finishReason: 'RECITATION', finishMessage: 'Citation match' }],
		}));
		await expect(provider.summarizeVideo('prompt')).rejects.toThrow('Gemini blocked the response: Citation match');
	});

	it('passes cancellation through the shared transport', async () => {
		vi.spyOn(obsidian, 'requestUrl').mockReturnValue(new Promise(() => undefined) as any);
		const controller = new AbortController();
		const provider = new GeminiProvider('key', 'gemini-pro', 0.5, 300000);
		const request = provider.summarizeVideo('prompt', controller.signal);

		controller.abort(new Error('Canceled'));

		await expect(request).rejects.toThrow('Canceled');
	});
});
