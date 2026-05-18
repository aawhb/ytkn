import { AIModelProvider, ModelConfig } from '../../types';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OpenAIProvider } from './openai';

export class ProvidersFactory {
	static createProvider(
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
				return new AnthropicProvider(apiKey, model, temperature, requestTimeoutMs, url);
			case 'openai':
				// Cloud OpenAI — no base URL; SDK defaults to api.openai.com
				return new OpenAIProvider(apiKey, model, temperature, requestTimeoutMs);
			case 'openai-compatible':
				return new OpenAIProvider(apiKey, model, temperature, requestTimeoutMs, url);
			case 'gemini':
				return new GeminiProvider(apiKey, model, temperature, requestTimeoutMs);
			default:
				return assertNever(type);
		}
	}
}

function assertNever(value: never): never {
	throw new Error(`Unsupported provider type: ${String(value)}`);
}
