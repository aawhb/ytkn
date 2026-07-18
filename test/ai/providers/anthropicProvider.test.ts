import { afterEach, describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import { AnthropicProvider } from '../../../src/ai/providers/anthropic';
import { DEFAULT_ANTHROPIC_MAX_TOKENS, TRUNCATION_NOTICE } from '../../../src/defaults';

function messageResponse(
	content: Array<{ type: string; text?: string }>,
	stopReason = 'end_turn',
): any {
	const payload = { content, stop_reason: stopReason };
	return {
		status: 200,
		headers: { 'content-type': 'application/json' },
		arrayBuffer: new ArrayBuffer(0),
		json: payload,
		text: JSON.stringify(payload),
	};
}

describe('AnthropicProvider', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('uses the official endpoint and minimal request shape', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl')
			.mockResolvedValue(messageResponse([{ type: 'text', text: 'summary' }]));
		const provider = new AnthropicProvider('key', 'claude-3', 0.5, 300000);

		await expect(provider.summarizeVideo('prompt')).resolves.toBe('summary');

		const request = requestUrlSpy.mock.calls[0][0] as any;
		expect(request).toMatchObject({
			url: 'https://api.anthropic.com/v1/messages',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': 'key',
				'anthropic-version': '2023-06-01',
			},
			throw: false,
		});
		expect(JSON.parse(request.body)).toEqual({
			model: 'claude-3',
			max_tokens: DEFAULT_ANTHROPIC_MAX_TOKENS,
			messages: [{ role: 'user', content: 'prompt' }],
		});
	});

	it('joins text blocks and marks truncated responses', async () => {
		vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(messageResponse([
			{ type: 'text', text: 'first' },
			{ type: 'tool_use' },
			{ type: 'text', text: 'second' },
		], 'max_tokens'));
		const provider = new AnthropicProvider('key', 'claude-3', 0.5, 300000);

		await expect(provider.summarizeVideo('prompt'))
			.resolves.toBe(`first\n\nsecond${TRUNCATION_NOTICE}`);
	});

	it('throws when the response has no text blocks', async () => {
		vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(messageResponse([{ type: 'tool_use' }]));
		const provider = new AnthropicProvider('key', 'claude-3', 0.5, 300000);

		await expect(provider.summarizeVideo('prompt'))
			.rejects.toThrow('Anthropic returned no final text content.');
	});

	it('passes cancellation through the shared transport', async () => {
		vi.spyOn(obsidian, 'requestUrl').mockReturnValue(new Promise(() => undefined) as any);
		const controller = new AbortController();
		const provider = new AnthropicProvider('key', 'claude-3', 0.5, 300000);
		const request = provider.summarizeVideo('prompt', controller.signal);

		controller.abort(new Error('Canceled'));

		await expect(request).rejects.toThrow('Canceled');
	});

	it('reports transport failures with the provider name', async () => {
		const error = new Error('network error');
		vi.spyOn(obsidian, 'requestUrl').mockRejectedValue(error);
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const provider = new AnthropicProvider('key', 'claude-3', 0.5, 300000);

		await expect(provider.summarizeVideo('prompt')).rejects.toThrow('network error');
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('Error generating summary with Anthropic:'),
			error,
		);
	});
});
