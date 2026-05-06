import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from '../src/services/providers/gemini';
import { TRUNCATION_NOTICE } from '../src/defaults';

const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn();

vi.mock('@google/generative-ai', () => {
	return {
		GoogleGenerativeAI: vi.fn(function () {
			return { getGenerativeModel: mockGetGenerativeModel };
		}),
	};
});

function setupModel(text: string, finishReason?: string): void {
	const response: any = { text: () => text };
	if (finishReason !== undefined) {
		response.candidates = [{ finishReason }];
	}
	mockGenerateContent.mockResolvedValue({ response });
	mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
}

describe('GeminiProvider', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('passes thinkingConfig with budget 8192 when reasoningMode is on', async () => {
		setupModel('summary');

		const provider = new GeminiProvider('key', 'gemini-pro', 0.5, 'on', 300000);
		await provider.summarizeVideo('prompt');

		const [modelParams] = mockGetGenerativeModel.mock.calls[0];
		expect(modelParams.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 8192 });
	});

	it('does not pass thinkingConfig when reasoningMode is off', async () => {
		setupModel('summary');

		const provider = new GeminiProvider('key', 'gemini-pro', 0.5, 'off', 300000);
		await provider.summarizeVideo('prompt');

		const [modelParams] = mockGetGenerativeModel.mock.calls[0];
		expect(modelParams.generationConfig).not.toHaveProperty('thinkingConfig');
	});

	it('appends TRUNCATION_NOTICE when finishReason is MAX_TOKENS', async () => {
		setupModel('partial', 'MAX_TOKENS');

		const provider = new GeminiProvider('key', 'gemini-pro', 0.5, 'off', 300000);
		const summary = await provider.summarizeVideo('prompt');

		expect(summary).toBe('partial' + TRUNCATION_NOTICE);
	});

	it('calls console.error with provider name and reasoning mode context on failure', async () => {
		const err = new Error('api error');
		mockGetGenerativeModel.mockReturnValue({ generateContent: vi.fn().mockRejectedValue(err) });
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const provider = new GeminiProvider('key', 'gemini-pro', 0.5, 'on', 300000);
		await expect(provider.summarizeVideo('prompt')).rejects.toThrow('api error');

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('Error generating summary with Gemini:'),
			err,
			'reasoning mode: on',
		);
	});
});
