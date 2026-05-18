import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnthropicProvider } from '../src/services/providers/anthropic';
import { TRUNCATION_NOTICE } from '../src/defaults';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
	return {
		default: vi.fn(function () {
			return { messages: { create: mockCreate } };
		}),
	};
});

function makeResponse(text: string, stop_reason: string = 'end_turn'): any {
	return {
		content: [{ type: 'text', text }],
		stop_reason,
	};
}

describe('AnthropicProvider', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('sends standard message requests without deprecated sampling or thinking fields', async () => {
		mockCreate.mockResolvedValue(makeResponse('summary'));

		const provider = new AnthropicProvider('key', 'claude-3', 0.5, 300000);
		await provider.summarizeVideo('prompt');

		const [request] = mockCreate.mock.calls[0];
		expect(request).not.toHaveProperty('temperature');
		expect(request).not.toHaveProperty('thinking');
	});

	it('appends TRUNCATION_NOTICE when stop_reason is max_tokens', async () => {
		mockCreate.mockResolvedValue(makeResponse('partial text', 'max_tokens'));

		const provider = new AnthropicProvider('key', 'claude-3', 0.5, 300000);
		const summary = await provider.summarizeVideo('prompt');

		expect(summary).toBe('partial text' + TRUNCATION_NOTICE);
	});

	it('throws when response has no text blocks', async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: 'tool_use', id: 'toolu_1', name: 'noop', input: {} }],
			stop_reason: 'end_turn',
		});

		const provider = new AnthropicProvider('key', 'claude-3', 0.5, 300000);
		await expect(provider.summarizeVideo('prompt')).rejects.toThrow('Anthropic returned no final text content.');
	});

	it('calls console.error with provider name and rethrows on failure', async () => {
		const err = new Error('network error');
		mockCreate.mockRejectedValue(err);
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

		const provider = new AnthropicProvider('key', 'claude-3', 0.5, 300000);
		await expect(provider.summarizeVideo('prompt')).rejects.toThrow('network error');

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('Error generating summary with Anthropic:'),
			err,
		);
	});
});
