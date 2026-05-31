import { describe, expect, it, vi } from 'vitest';
import { ProvidersFactory } from '../../src/services/providers/factory';
import { AnthropicProvider } from '../../src/services/providers/anthropic';
import { GeminiProvider } from '../../src/services/providers/gemini';
import { OpenAIProvider } from '../../src/services/providers/openai';
import type { ModelConfig } from '../../src/types';

vi.mock('@anthropic-ai/sdk');
vi.mock('@google/generative-ai');
vi.mock('openai');

function makeConfig(type: string, url?: string): ModelConfig {
	return {
		name: 'test-model',
		provider: {
			name: 'test-provider',
			type: type as any,
			apiKey: 'test-key',
			url,
		},
	};
}

describe('ProvidersFactory', () => {
	it('creates AnthropicProvider for type anthropic', () => {
		const provider = ProvidersFactory.createProvider(makeConfig('anthropic'), 0.3, 300000);
		expect(provider).toBeInstanceOf(AnthropicProvider);
	});

	it('creates OpenAIProvider for type openai', () => {
		const provider = ProvidersFactory.createProvider(makeConfig('openai'), 0.3, 300000);
		expect(provider).toBeInstanceOf(OpenAIProvider);
	});

	it('creates OpenAIProvider for type openai-compatible', () => {
		const provider = ProvidersFactory.createProvider(
			makeConfig('openai-compatible', 'http://localhost:11434/v1'),
			0.3,
			300000,
		);
		expect(provider).toBeInstanceOf(OpenAIProvider);
	});

	it('creates GeminiProvider for type gemini', () => {
		const provider = ProvidersFactory.createProvider(makeConfig('gemini'), 0.3, 300000);
		expect(provider).toBeInstanceOf(GeminiProvider);
	});

	it('throws for unknown provider type', () => {
		expect(() =>
			ProvidersFactory.createProvider(makeConfig('unknown-provider'), 0.3, 300000),
		).toThrow('Unsupported provider type: unknown-provider');
	});
});
