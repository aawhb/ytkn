import Anthropic from '@anthropic-ai/sdk';
import { requestUrl } from 'obsidian';
import { DEFAULT_OPENAI_COMPATIBLE_URL } from '../../defaults';
import { DiscoveredModel, ProviderConfig } from '../../types';
import { fetchFn, getErrorMessage } from '../../utils';

const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

type RequestMethod = 'GET' | 'POST';
type JsonHeaders = Record<string, string>;

function requireFetch(): typeof fetch {
	if (!fetchFn) {
		throw new Error('Fetch is unavailable in this environment.');
	}

	return fetchFn;
}

async function requestJson<T>(url: string, method: RequestMethod, headers?: JsonHeaders, body?: unknown): Promise<T> {
	try {
		const response = await requestUrl({
			url,
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
		});

		return JSON.parse(response.text) as T;
	} catch (requestError) {
		const fetchImpl = requireFetch();
		const response = await fetchImpl(url, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
		});

		if (!response.ok) {
			const responseText = await response.text();
			throw new Error(`Request failed: ${response.status} ${responseText || response.statusText}`);
		}

		try {
			return (await response.json()) as T;
		} catch (parseError) {
			throw new Error(`Failed to parse JSON response after requestUrl error (${getErrorMessage(requestError)}): ${getErrorMessage(parseError)}`);
		}
	}
}

function sortModels(models: DiscoveredModel[]): DiscoveredModel[] {
	return models.sort((left, right) => left.displayName.localeCompare(right.displayName));
}

async function fetchCloudOpenAIModels(provider: ProviderConfig): Promise<DiscoveredModel[]> {
	const payload = await requestJson<{ data?: Array<{ id: string }> }>(
		'https://api.openai.com/v1/models',
		'GET',
		provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : undefined,
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
	const payload = await requestJson<{ data?: Array<{ id: string }> }>(
		`${baseUrl}/models`,
		'GET',
		provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : undefined,
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
	const client = new Anthropic({
		apiKey: provider.apiKey,
		dangerouslyAllowBrowser: true,
		baseURL: provider.url,
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
		throw new Error('Gemini providers require an API key to fetch models.');
	}

	const payload = await requestJson<{
		models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>;
	}>(`${GEMINI_MODELS_URL}?key=${encodeURIComponent(provider.apiKey)}`, 'GET');

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

function assertNever(value: never): never {
	throw new Error(`Unsupported provider type: ${String(value)}`);
}
