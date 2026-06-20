import { describe, expect, it } from 'vitest';
import { buildModelId, parseModelId } from '../src/modelId';
import type { ModelConfig } from '../src/types';

const sample = (providerName: string, modelName: string): ModelConfig => ({
	name: modelName,
	provider: { name: providerName, type: 'openai', apiKey: '' },
});

describe('buildModelId', () => {
	it('joins the provider and model with a colon, in that order', () => {
		expect(buildModelId(sample('OpenAI', 'gpt-4'))).toBe('OpenAI:gpt-4');
	});

	it('preserves embedded colons inside the model name (so it can round-trip uniquely)', () => {
		expect(buildModelId(sample('Ollama', 'qwen3:4b'))).toBe('Ollama:qwen3:4b');
	});

	it('produces stable ids regardless of optional displayName/contextWindow', () => {
		const a = buildModelId({ ...sample('OpenAI', 'gpt-4'), displayName: 'GPT-4' });
		const b = buildModelId({ ...sample('OpenAI', 'gpt-4'), contextWindow: 64000 });
		expect(a).toBe(b);
	});
});

describe('parseModelId', () => {
	it('splits on the first colon so Ollama model tags round-trip', () => {
		expect(parseModelId('Ollama:qwen3:4b')).toEqual({
			providerName: 'Ollama',
			modelName: 'qwen3:4b',
		});
	});

	it.each(['gpt-4', ':gpt-4', 'OpenAI:'])('rejects invalid stored model ID %s', (modelId) => {
		expect(parseModelId(modelId)).toBeNull();
	});
});
