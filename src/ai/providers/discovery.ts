import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_OPENAI_COMPATIBLE_URL } from '../../defaults';
import type { DiscoveredModel, ProviderConfig } from '../../types';
import { assertNever } from './shared';
import { requestUrlJson } from './requestUrlJson';

const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function sortModels(models: DiscoveredModel[]): DiscoveredModel[] {
	return models.sort((left, right) => left.displayName.localeCompare(right.displayName));
}

async function fetchCloudOpenAIModels(provider: ProviderConfig): Promise<DiscoveredModel[]> {
	if (!provider.apiKey) {
		throw new Error('OpenAI providers require an API key secret to fetch models.');
	}

	const payload = await requestUrlJson<{ data?: Array<{ id: string }> }>(
		'https://api.openai.com/v1/models',
		{
			headers: { Authorization: `Bearer ${provider.apiKey}` },
			fallbackToFetch: true,
		},
	);
	const modelIds = (payload.data ?? []).map((model) => model.id);
	return sortModels(
		modelIds.map((modelId) => ({
			name: modelId,
			displayName: modelId,
			contextWindow: undefined,
		})),
	);
}

async function fetchOpenAICompatibleModels(provider: ProviderConfig): Promise<DiscoveredModel[]> {
	const baseUrl = (provider.url || DEFAULT_OPENAI_COMPATIBLE_URL).replace(/\/$/, '');
	const payload = await requestUrlJson<{ data?: Array<{ id: string }> }>(
		`${baseUrl}/models`,
		{
			headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : undefined,
			fallbackToFetch: true,
		},
	);
	const modelIds = (payload.data ?? []).map((model) => model.id);

	return sortModels(
		modelIds.map((modelId) => ({
			name: modelId,
			displayName: modelId,
			contextWindow: undefined,
		})),
	);
}

async function fetchAnthropicModels(provider: ProviderConfig): Promise<DiscoveredModel[]> {
	if (!provider.apiKey) {
		throw new Error('Anthropic providers require an API key secret to fetch models.');
	}

	const client = new Anthropic({
		apiKey: provider.apiKey,
		dangerouslyAllowBrowser: true,
	});

	const models: DiscoveredModel[] = [];
	for await (const model of client.beta.models.list()) {
		models.push({
			name: model.id,
			displayName: model.display_name || model.id,
			contextWindow: undefined,
		});
	}

	return sortModels(models);
}

async function fetchGeminiModels(provider: ProviderConfig): Promise<DiscoveredModel[]> {
	if (!provider.apiKey) {
		throw new Error('Gemini providers require an API key secret to fetch models.');
	}

	const payload = await requestUrlJson<{
		models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>;
	}>(`${GEMINI_MODELS_URL}?key=${encodeURIComponent(provider.apiKey)}`, { fallbackToFetch: true });

	return sortModels(
		(payload.models ?? [])
			.filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
			.map((model) => ({
				name: model.name.replace(/^models\//, ''),
				displayName: model.displayName || model.name.replace(/^models\//, ''),
				contextWindow: undefined,
			})),
	);
}

export async function discoverProviderModels(provider: ProviderConfig): Promise<DiscoveredModel[]> {
	switch (provider.type) {
		case 'openai':
			return fetchCloudOpenAIModels(provider);
		case 'openai-compatible':
			return fetchOpenAICompatibleModels(provider);
		case 'anthropic':
			return fetchAnthropicModels(provider);
		case 'gemini':
			return fetchGeminiModels(provider);
		default:
			return assertNever(provider.type);
	}
}
