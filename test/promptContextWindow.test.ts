import { describe, expect, it } from 'vitest';
import { PromptService } from '../src/services/prompt';
import { TranscriptResponse } from '../src/types';

// Budget calculation for the ollama fallback (32768 token window, reasoningMode='off'):
//   safetyMargin = round(32768 * 0.1) = 3277
//   reservedOutput = round(32768 * 0.2) = 6554
//   budget ≈ 32768 - 3277 - 6554 - ~500(prompt overhead) ≈ 22437 tokens
//
// Budget for openai-compatible fallback (64000 token window, reasoningMode='off'):
//   safetyMargin = round(64000 * 0.1) = 6400
//   reservedOutput = round(64000 * 0.2) = 12800
//   budget ≈ 64000 - 6400 - 12800 - ~500 ≈ 44300 tokens
//
// We generate ~30000 tokens of transcript text (30000 * 4 = 120000 chars),
// spread across many lines so chunkTranscriptLines can split at line boundaries.
// 30000 > 22437 → chunking required under ollama cap
// 30000 < 44300 → no chunking needed under openai-compatible fallback

const LINE_TEXT = 'word '.repeat(400).trim(); // 2000 chars ≈ 500 tokens per line
// 60 lines × 500 tokens = 30000 tokens total
const MANY_LINES = Array.from({ length: 60 }, (_, i) => ({ text: LINE_TEXT, offset: i }));

function makeTranscript(lines: TranscriptResponse['lines']): TranscriptResponse {
	return {
		url: 'https://youtube.com/watch?v=abc',
		videoId: 'abc',
		title: 'Test',
		author: 'Author',
		channelUrl: 'https://youtube.com/channel/x',
		lines,
	};
}

const service = new PromptService({
	mode: 'template',
	template: 'general',
	manualInstructions: '',
	includeMindmap: false,
	includeMemorableQuotes: false,
});

describe('getContextWindowTokens — provider-type fallback paths (regression lock)', () => {
	it('openai-compatible + Ollama URL + no contextWindow → uses ollama cap (32768), forcing chunking', () => {
		const chunks = service.splitTranscript(
			makeTranscript(MANY_LINES),
			'https://youtube.com/watch?v=abc',
			{
				model: {
					name: 'llama3',
					displayName: 'Llama 3',
					reasoningSupport: 'unsupported',
					contextWindow: undefined,
					provider: { name: 'Ollama', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
				},
				reasoningMode: 'off',
			},
		);

		expect(chunks.length).toBeGreaterThan(1);
	});

	it('openai-compatible + non-Ollama URL + no contextWindow → uses 64000 fallback, single chunk', () => {
		const chunks = service.splitTranscript(
			makeTranscript(MANY_LINES),
			'https://youtube.com/watch?v=abc',
			{
				model: {
					name: 'model-x',
					displayName: 'Model X',
					reasoningSupport: 'unsupported',
					contextWindow: undefined,
					provider: { name: 'Remote', type: 'openai-compatible', apiKey: '', url: 'https://api.example.com/openai' },
				},
				reasoningMode: 'off',
			},
		);

		expect(chunks).toHaveLength(1);
	});

	it('openai provider + no contextWindow → uses openai fallback (64000), single chunk', () => {
		const chunks = service.splitTranscript(
			makeTranscript(MANY_LINES),
			'https://youtube.com/watch?v=abc',
			{
				model: {
					name: 'gpt-4o',
					displayName: 'GPT-4o',
					reasoningSupport: 'unsupported',
					contextWindow: undefined,
					provider: { name: 'OpenAI', type: 'openai', apiKey: '' },
				},
				reasoningMode: 'off',
			},
		);

		expect(chunks).toHaveLength(1);
	});

	it('Ollama endpoint caps large model contextWindow to 32768, forcing chunking', () => {
		// Model reports 262144 but the Ollama cap (32768) must override it
		const chunks = service.splitTranscript(
			makeTranscript(MANY_LINES),
			'https://youtube.com/watch?v=abc',
			{
				model: {
					name: 'qwen3',
					displayName: 'Qwen 3',
					reasoningSupport: 'supported',
					contextWindow: 262144,
					provider: { name: 'Ollama', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
				},
				reasoningMode: 'off',
			},
		);

		expect(chunks.length).toBeGreaterThan(1);
	});
});
