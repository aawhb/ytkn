import { AIModelProvider, ModelConfig, ReasoningMode } from '../../types';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OpenAIProvider } from './openai';

export class ProvidersFactory {
	static createProvider(
		config: ModelConfig,
		temperature: number,
		reasoningMode: ReasoningMode,
		requestTimeoutMs: number,
	): AIModelProvider {
		const {
			provider: { type, apiKey, url },
			name: model,
		} = config;

		switch (type) {
			case 'anthropic':
				return new AnthropicProvider(apiKey, model, temperature, reasoningMode, requestTimeoutMs, url);
			case 'openai':
				// Cloud OpenAI — no base URL; SDK defaults to api.openai.com
				return new OpenAIProvider(apiKey, model, temperature, reasoningMode, requestTimeoutMs);
			case 'openai-compatible':
				return new OpenAIProvider(apiKey, model, temperature, reasoningMode, requestTimeoutMs, url);
			case 'gemini':
				return new GeminiProvider(apiKey, model, temperature, reasoningMode, requestTimeoutMs);
			default:
				return assertNever(type);
		}
	}
}

function assertNever(value: never): never {
	throw new Error(`Unsupported provider type: ${String(value)}`);
}
