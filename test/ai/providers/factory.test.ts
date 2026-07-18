import { describe, expect, it } from 'vitest';
import { createProvider } from '../../../src/ai/providers/factory';
import { AnthropicProvider } from '../../../src/ai/providers/anthropic';
import { GeminiProvider } from '../../../src/ai/providers/gemini';
import { OpenAIProvider } from '../../../src/ai/providers/openai';
import type { ModelConfig } from '../../../src/types';

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

describe('createProvider', () => {
	it('creates AnthropicProvider for type anthropic', () => {
		const provider = createProvider(makeConfig('anthropic'), 0.3, 300000);
		expect(provider).toBeInstanceOf(AnthropicProvider);
	});

	it('creates OpenAIProvider for type openai', () => {
		const provider = createProvider(makeConfig('openai'), 0.3, 300000);
		expect(provider).toBeInstanceOf(OpenAIProvider);
	});

	it('creates OpenAIProvider for type openai-compatible', () => {
		const provider = createProvider(
			makeConfig('openai-compatible', 'http://localhost:11434/v1'),
			0.3,
			300000,
		);
		expect(provider).toBeInstanceOf(OpenAIProvider);
	});

	it('creates GeminiProvider for type gemini', () => {
		const provider = createProvider(makeConfig('gemini'), 0.3, 300000);
		expect(provider).toBeInstanceOf(GeminiProvider);
	});

	it('throws for unknown provider type', () => {
		expect(() =>
			createProvider(makeConfig('unknown-provider'), 0.3, 300000),
		).toThrow('Unsupported provider type: unknown-provider');
	});
});
