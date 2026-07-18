import { DEFAULT_OPENAI_COMPATIBLE_URL } from '../../defaults';
import type { DiscoveredModel, ProviderConfig } from '../../types';
import { assertNever } from './shared';
import { requestUrlJson } from './requestUrlJson';

const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models';

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
	const baseUrl = (provider.url || DEFAULT_OPENAI_COMPATIBLE_URL).replace(/\/+$/, '');
	const payload = await requestUrlJson<{ data?: Array<{ id: string }> }>(
		`${baseUrl}/models`,
		{
			headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : undefined,
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

	const models: DiscoveredModel[] = [];
	let afterId: string | undefined;
	const seenCursors = new Set<string>();
	do {
		const query = new URLSearchParams({ limit: '1000' });
		if (afterId) {
			query.set('after_id', afterId);
		}
		const payload = await requestUrlJson<{
			data?: Array<{ id: string; display_name?: string }>;
			has_more?: boolean;
			last_id?: string;
		}>(`${ANTHROPIC_MODELS_URL}?${query}`, {
			headers: {
				'x-api-key': provider.apiKey,
				'anthropic-version': '2023-06-01',
			},
		});
		for (const model of payload.data ?? []) {
			models.push({
				name: model.id,
				displayName: model.display_name || model.id,
				contextWindow: undefined,
			});
		}
		const nextCursor = payload.has_more ? payload.last_id : undefined;
		if (payload.has_more && !nextCursor) {
			throw new Error('Anthropic model discovery did not return a page cursor.');
		}
		if (nextCursor && seenCursors.has(nextCursor)) {
			throw new Error('Anthropic model discovery returned a repeated page cursor.');
		}
		if (nextCursor) {
			seenCursors.add(nextCursor);
		}
		afterId = nextCursor;
	} while (afterId);

	return sortModels(models);
}

async function fetchGeminiModels(provider: ProviderConfig): Promise<DiscoveredModel[]> {
	if (!provider.apiKey) {
		throw new Error('Gemini providers require an API key secret to fetch models.');
	}

	const models: DiscoveredModel[] = [];
	let pageToken: string | undefined;
	const seenPageTokens = new Set<string>();
	do {
		const query = new URLSearchParams({ pageSize: '1000' });
		if (pageToken) {
			query.set('pageToken', pageToken);
		}
		const payload = await requestUrlJson<{
			models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>;
			nextPageToken?: string;
		}>(`${GEMINI_MODELS_URL}?${query}`, {
			headers: { 'x-goog-api-key': provider.apiKey },
		});
		models.push(...(payload.models ?? [])
			.filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
			.map((model) => ({
				name: model.name.replace(/^models\//, ''),
				displayName: model.displayName || model.name.replace(/^models\//, ''),
				contextWindow: undefined,
			})));
		const nextPageToken = payload.nextPageToken;
		if (nextPageToken && seenPageTokens.has(nextPageToken)) {
			throw new Error('Gemini model discovery returned a repeated page token.');
		}
		if (nextPageToken) {
			seenPageTokens.add(nextPageToken);
		}
		pageToken = nextPageToken;
	} while (pageToken);

	return sortModels(models);
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
