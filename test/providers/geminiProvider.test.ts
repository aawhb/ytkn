import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from '../../src/services/providers/gemini';
import { TRUNCATION_NOTICE } from '../../src/defaults';

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

	it('passes only temperature in generation config', async () => {
		setupModel('summary');

		const provider = new GeminiProvider('key', 'gemini-pro', 0.5, 300000);
		await provider.summarizeVideo('prompt');

		const [modelParams] = mockGetGenerativeModel.mock.calls[0];
		expect(modelParams.generationConfig.temperature).toBe(0.5);
		expect(modelParams.generationConfig).not.toHaveProperty('thinkingConfig');
	});

	it('appends TRUNCATION_NOTICE when finishReason is MAX_TOKENS', async () => {
		setupModel('partial', 'MAX_TOKENS');

		const provider = new GeminiProvider('key', 'gemini-pro', 0.5, 300000);
		const summary = await provider.summarizeVideo('prompt');

		expect(summary).toBe('partial' + TRUNCATION_NOTICE);
	});

	it('calls console.error with provider name on failure', async () => {
		const err = new Error('api error');
		mockGetGenerativeModel.mockReturnValue({ generateContent: vi.fn().mockRejectedValue(err) });
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

		const provider = new GeminiProvider('key', 'gemini-pro', 0.5, 300000);
		await expect(provider.summarizeVideo('prompt')).rejects.toThrow('api error');

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('Error generating summary with Gemini:'),
			err,
		);
	});
});
