import { describe, expect, it, vi } from 'vitest';

const providerFactoryMocks = vi.hoisted(() => ({
	createProvider: vi.fn(),
}));

vi.mock('obsidian', async () => {
	const mod = await import('../../mocks/obsidian');
	return mod;
});

vi.mock('../../../src/ai/providers/factory', () => ({
	createProvider: providerFactoryMocks.createProvider,
}));

import { generateAiContent, type AiContentContext, type AiModelChain } from '../../../src/generation/workflows/aiContent';
import type { PromptService } from '../../../src/ai/promptService';
import type { ModelConfig, TranscriptResponse } from '../../../src/types';

const modelA: ModelConfig = {
	name: 'model-a',
	displayName: 'Model A',
	provider: { name: 'Anthropic', type: 'anthropic', apiKey: 'key-a' },
};

const modelB: ModelConfig = {
	name: 'model-b',
	displayName: 'Model B',
	provider: { name: 'Local', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
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
		buildCollectionSynthesisPrompt: vi.fn(),
		buildCollectionAddonsSynthesisPrompt: vi.fn(),
		...overrides,
	} as unknown as PromptService;
}

function makeChain(candidates: ModelConfig[]): AiModelChain {
	return { candidates, index: 0, temperature: 0.2, requestTimeoutMs: 60000 };
}

function makeContext(candidates: ModelConfig[], promptService = createPromptService()): AiContentContext {
	return { chain: makeChain(candidates), promptService };
}

function makeInput(aiContext: AiContentContext, generateSummary = true) {
	return {
		aiContext,
		transcript,
		url: transcript.url,
		progress: { hasProgressContent: true, updateProgress: vi.fn(async () => undefined), updateStatus: vi.fn() },
		signal: new AbortController().signal,
		generateSummary,
	};
}

describe('generateAiContent', () => {
	it('builds a direct summary prompt for one transcript chunk', async () => {
		const summarize = vi.fn(async () => 'summary');
		providerFactoryMocks.createProvider.mockReset().mockReturnValue({ summarizeVideo: summarize });
		const input = makeInput(makeContext([modelA]));

		const result = await generateAiContent(input);

		expect(result).toEqual({ text: 'summary', warnings: [] });
		expect(providerFactoryMocks.createProvider).toHaveBeenCalledWith(modelA, 0.2, 60000);
		expect(summarize).toHaveBeenCalledWith('full prompt', expect.any(AbortSignal));
	});

	it('chunks and synthesizes add-on content', async () => {
		const summarize = vi.fn()
			.mockResolvedValueOnce('chunk one')
			.mockResolvedValueOnce('chunk two')
			.mockResolvedValueOnce('final addons');
		providerFactoryMocks.createProvider.mockReset().mockReturnValue({ summarizeVideo: summarize });
		const promptService = createPromptService({
			splitTranscriptForAddons: vi.fn(() => ['a', 'b']),
		});
		const input = {
			...makeInput(makeContext([modelA], promptService), false),
			progress: { hasProgressContent: false, updateProgress: vi.fn(async () => undefined), updateStatus: vi.fn() },
		};

		const result = await generateAiContent(input);

		expect(result.text).toBe('final addons');
		expect(summarize).toHaveBeenNthCalledWith(1, 'addons chunk a', expect.any(AbortSignal));
		expect(summarize).toHaveBeenNthCalledWith(2, 'addons chunk b', expect.any(AbortSignal));
		expect(summarize).toHaveBeenNthCalledWith(3, 'addons synthesis chunk one,chunk two', expect.any(AbortSignal));
	});

	it('falls back to the next model on rate limits and reports the hop', async () => {
		const failing = vi.fn(async () => { throw new Error('Request failed: 429 rate limited'); });
		const succeeding = vi.fn(async () => 'fallback summary');
		providerFactoryMocks.createProvider.mockReset()
			.mockReturnValueOnce({ summarizeVideo: failing })
			.mockReturnValueOnce({ summarizeVideo: succeeding });
		const context = makeContext([modelA, modelB]);

		const result = await generateAiContent(makeInput(context));

		expect(result.text).toBe('fallback summary');
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('Model A');
		expect(result.warnings[0]).toContain('hit a rate limit');
		expect(result.warnings[0]).toContain('Model B');
		expect(context.chain.index).toBe(1);
	});

	it('stays sticky on the fallback model for later calls on the same context', async () => {
		const succeeding = vi.fn(async () => 'second entry summary');
		providerFactoryMocks.createProvider.mockReset().mockReturnValue({ summarizeVideo: succeeding });
		const context = makeContext([modelA, modelB]);
		context.chain.index = 1;

		const result = await generateAiContent(makeInput(context));

		expect(result).toEqual({ text: 'second entry summary', warnings: [] });
		expect(providerFactoryMocks.createProvider).toHaveBeenCalledTimes(1);
		expect(providerFactoryMocks.createProvider).toHaveBeenCalledWith(modelB, 0.2, 60000);
	});

	it('rethrows cancellation without advancing the chain', async () => {
		const abortError = Object.assign(new Error('Request aborted'), { name: 'AbortError' });
		providerFactoryMocks.createProvider.mockReset().mockReturnValue({
			summarizeVideo: vi.fn(async () => { throw abortError; }),
		});
		const context = makeContext([modelA, modelB]);

		await expect(generateAiContent(makeInput(context))).rejects.toThrow('Request aborted');
		expect(context.chain.index).toBe(0);
	});

	it('propagates the final error when every model fails', async () => {
		providerFactoryMocks.createProvider.mockReset()
			.mockReturnValueOnce({ summarizeVideo: vi.fn(async () => { throw new Error('Request failed: 429 limited'); }) })
			.mockReturnValueOnce({ summarizeVideo: vi.fn(async () => { throw new Error('Request failed: 503 down'); }) });
		const context = makeContext([modelA, modelB]);

		await expect(generateAiContent(makeInput(context))).rejects.toThrow('Request failed: 503 down');
	});

	it('falls back for server errors', async () => {
		const succeeding = vi.fn(async () => 'fallback summary');
		providerFactoryMocks.createProvider.mockReset()
			.mockReturnValueOnce({ summarizeVideo: vi.fn(async () => { throw new Error('Request failed: 503 down'); }) })
			.mockReturnValueOnce({ summarizeVideo: succeeding });
		const context = makeContext([modelA, modelB]);

		await expect(generateAiContent(makeInput(context))).resolves.toEqual({
			text: 'fallback summary',
			warnings: [expect.stringContaining('returned a server error')],
		});
		expect(context.chain.index).toBe(1);
	});

	it('treats a missing API key as a fallback-worthy failure', async () => {
		const keyless: ModelConfig = { name: 'no-key', displayName: 'No Key', provider: { name: 'OpenAI', type: 'openai', apiKey: '' } };
		const succeeding = vi.fn(async () => 'summary');
		providerFactoryMocks.createProvider.mockReset().mockReturnValue({ summarizeVideo: succeeding });
		const context = makeContext([keyless, modelB]);

		const result = await generateAiContent(makeInput(context));

		expect(result.text).toBe('summary');
		expect(result.warnings[0]).toContain('No Key');
		expect(providerFactoryMocks.createProvider).toHaveBeenCalledTimes(1);
		expect(providerFactoryMocks.createProvider).toHaveBeenCalledWith(modelB, 0.2, 60000);
	});

	it('rebuilds transcript chunks for the model actually attempting', async () => {
		const promptService = createPromptService();
		providerFactoryMocks.createProvider.mockReset()
			.mockReturnValueOnce({ summarizeVideo: vi.fn(async () => { throw new Error('Request failed: 429 limited'); }) })
			.mockReturnValueOnce({ summarizeVideo: vi.fn(async () => 'ok') });
		const context = makeContext([modelA, modelB], promptService);

		await generateAiContent(makeInput(context));

		expect(promptService.splitTranscript).toHaveBeenNthCalledWith(1, transcript, transcript.url, { model: modelA });
		expect(promptService.splitTranscript).toHaveBeenNthCalledWith(2, transcript, transcript.url, { model: modelB });
	});
});
