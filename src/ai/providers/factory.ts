import type { AIModelProvider, ModelConfig } from '../../types';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OpenAIProvider } from './openai';
import { assertNever } from './shared';

export function createProvider(
	config: ModelConfig,
	temperature: number,
	requestTimeoutMs: number,
): AIModelProvider {
	const {
		provider: { type, apiKey, url },
		name: model,
	} = config;

	switch (type) {
		case 'anthropic':
			return new AnthropicProvider(apiKey, model, temperature, requestTimeoutMs);
		case 'openai':
			return new OpenAIProvider(type, apiKey, model, temperature, requestTimeoutMs);
		case 'openai-compatible':
			return new OpenAIProvider(type, apiKey, model, temperature, requestTimeoutMs, url);
		case 'gemini':
			return new GeminiProvider(apiKey, model, temperature, requestTimeoutMs);
		default:
			return assertNever(type);
	}
}
