import { describe, expect, it, vi } from 'vitest';
import { generateAiContent } from '../../../src/generation/workflows/aiContent';
import type { PromptService } from '../../../src/ai/promptService';
import type { ModelConfig, TranscriptResponse } from '../../../src/types';

const model: ModelConfig = {
	name: 'test-model',
	provider: {
		name: 'Provider',
		type: 'openai',
		apiKey: 'secret',
	},
};

const transcript: TranscriptResponse = {
	url: 'https://youtu.be/abc12345678',
	videoId: 'abc12345678',
	title: 'Video',
	author: 'Author',
	channelUrl: 'https://youtube.com/@author',
	lines: [{ text: 'Line one.', offset: 0 }],
};

function createPromptService(overrides: Partial<PromptService> = {}): PromptService {
	return {
		splitTranscript: vi.fn(() => ['Line one.']),
		splitTranscriptForAddons: vi.fn(() => ['Line one.']),
		buildPrompt: vi.fn(() => 'full prompt'),
		buildAddonsPrompt: vi.fn(() => 'addons prompt'),
		buildChunkPrompt: vi.fn((_transcript, _url, chunk) => `chunk ${chunk}`),
		buildAddonsChunkPrompt: vi.fn((_transcript, _url, chunk) => `addons chunk ${chunk}`),
		buildSynthesisPrompt: vi.fn((_transcript, _url, summaries) => `synthesis ${summaries.join(',')}`),
		buildAddonsSynthesisPrompt: vi.fn((_transcript, _url, summaries) => `addons synthesis ${summaries.join(',')}`),
		buildPlaylistSynthesisPrompt: vi.fn(),
		buildPlaylistAddonsSynthesisPrompt: vi.fn(),
		...overrides,
	} as unknown as PromptService;
}

describe('generateAiContent', () => {
	it('builds a direct summary prompt for one transcript chunk', async () => {
		const provider = { summarizeVideo: vi.fn(async () => 'summary') };
		const updateProgress = vi.fn(async () => undefined);
		const updateStatus = vi.fn();
		const promptService = createPromptService();

		const result = await generateAiContent({
			aiContext: { selectedModel: model, provider, promptService },
			transcript,
			url: transcript.url,
			progress: { hasProgressContent: true, updateProgress, updateStatus },
			signal: new AbortController().signal,
			generateSummary: true,
		});

		expect(result).toBe('summary');
		expect(provider.summarizeVideo).toHaveBeenCalledWith('full prompt', expect.any(AbortSignal));
		expect(updateProgress).toHaveBeenCalledWith('Generating summary...');
		expect(updateStatus).toHaveBeenCalledWith('Generating summary...');
	});

	it('chunks and synthesizes add-on content', async () => {
		const provider = {
			summarizeVideo: vi.fn()
				.mockResolvedValueOnce('chunk one')
				.mockResolvedValueOnce('chunk two')
				.mockResolvedValueOnce('final addons'),
		};
		const promptService = createPromptService({
			splitTranscriptForAddons: vi.fn(() => ['a', 'b']),
		});

		const result = await generateAiContent({
			aiContext: { selectedModel: model, provider, promptService },
			transcript,
			url: transcript.url,
			progress: { hasProgressContent: false, updateProgress: vi.fn(), updateStatus: vi.fn() },
			signal: new AbortController().signal,
			generateSummary: false,
		});

		expect(result).toBe('final addons');
		expect(provider.summarizeVideo).toHaveBeenNthCalledWith(1, 'addons chunk a', expect.any(AbortSignal));
		expect(provider.summarizeVideo).toHaveBeenNthCalledWith(2, 'addons chunk b', expect.any(AbortSignal));
		expect(provider.summarizeVideo).toHaveBeenNthCalledWith(3, 'addons synthesis chunk one,chunk two', expect.any(AbortSignal));
	});
});
