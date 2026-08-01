import { describe, expect, it } from 'vitest';
import { PromptService } from '../../src/ai/promptService';
import type { TranscriptResponse } from '../../src/types';

const LINE_TEXT = 'word '.repeat(400).trim();
const FALLBACK_WINDOW_LINES = Array.from({ length: 60 }, (_, i) => ({ text: LINE_TEXT, offset: i }));
const EXPLICIT_WINDOW_LINES = Array.from({ length: 120 }, (_, i) => ({ text: LINE_TEXT, offset: i }));

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

describe('getContextWindowTokens: provider-type fallback paths', () => {
	it('openai-compatible + Ollama URL + no contextWindow → uses 64000 fallback, single chunk', () => {
		const chunks = service.splitTranscript(
			makeTranscript(FALLBACK_WINDOW_LINES),
			'https://youtube.com/watch?v=abc',
			{
				model: {
					name: 'llama3',
					displayName: 'Llama 3',
					contextWindow: undefined,
					provider: { name: 'Ollama', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
				},
			},
		);

		expect(chunks).toHaveLength(1);
	});

	it('openai-compatible + non-Ollama URL + no contextWindow → uses 64000 fallback, single chunk', () => {
		const chunks = service.splitTranscript(
			makeTranscript(FALLBACK_WINDOW_LINES),
			'https://youtube.com/watch?v=abc',
			{
				model: {
					name: 'model-x',
					displayName: 'Model X',
					contextWindow: undefined,
					provider: { name: 'Remote', type: 'openai-compatible', apiKey: '', url: 'https://api.example.com/openai' },
				},
			},
		);

		expect(chunks).toHaveLength(1);
	});

	it('openai provider + no contextWindow → uses openai fallback (64000), single chunk', () => {
		const chunks = service.splitTranscript(
			makeTranscript(FALLBACK_WINDOW_LINES),
			'https://youtube.com/watch?v=abc',
			{
				model: {
					name: 'gpt-4o',
					displayName: 'GPT-4o',
					contextWindow: undefined,
					provider: { name: 'OpenAI', type: 'openai', apiKey: '' },
				},
			},
		);

		expect(chunks).toHaveLength(1);
	});

	it('explicit contextWindow is honored for OpenAI-compatible endpoints', () => {
		const transcript = makeTranscript(EXPLICIT_WINDOW_LINES);
		const fallbackChunks = service.splitTranscript(
			transcript,
			'https://youtube.com/watch?v=abc',
			{
				model: {
					name: 'qwen3',
					displayName: 'Qwen 3',
					provider: { name: 'Ollama', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
				},
			},
		);
		const explicitWindowChunks = service.splitTranscript(
			transcript,
			'https://youtube.com/watch?v=abc',
			{
				model: {
					name: 'qwen3',
					displayName: 'Qwen 3',
					contextWindow: 262144,
					provider: { name: 'Ollama', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
				},
			},
		);

		expect(fallbackChunks.length).toBeGreaterThan(1);
		expect(explicitWindowChunks).toHaveLength(1);
	});
});
