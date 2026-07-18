import { afterEach, describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import { discoverProviderModels } from '../../../src/ai/providers/discovery';

function jsonResponse(payload: unknown, status = 200): any {
	return {
		status,
		headers: { 'content-type': 'application/json' },
		arrayBuffer: new ArrayBuffer(0),
		json: payload,
		text: status >= 200 && status < 300 ? JSON.stringify(payload) : 'request denied',
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('discoverProviderModels', () => {
	it('uses the native transport and sorts OpenAI models', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(jsonResponse({
			data: [{ id: 'gpt-z' }, { id: 'gpt-a' }],
		}));

		const models = await discoverProviderModels({
			name: 'OpenAI', type: 'openai', apiKey: 'key', models: [],
		});

		expect(models.map((model) => model.name)).toEqual(['gpt-a', 'gpt-z']);
		expect(requestUrlSpy).toHaveBeenCalledWith(expect.objectContaining({
			url: 'https://api.openai.com/v1/models',
			headers: { Authorization: 'Bearer key' },
		}));
	});

	it('uses the standard compatible endpoint with optional authentication', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(jsonResponse({
			data: [{ id: 'mistral' }, { id: 'llama3' }],
		}));

		const models = await discoverProviderModels({
			name: 'Local',
			type: 'openai-compatible',
			apiKey: 'gateway-key',
			url: 'http://localhost:11434/v1///',
			models: [],
		});

		expect(models.map((model) => model.name)).toEqual(['llama3', 'mistral']);
		expect(requestUrlSpy).toHaveBeenCalledWith(expect.objectContaining({
			url: 'http://localhost:11434/v1/models',
			headers: { Authorization: 'Bearer gateway-key' },
		}));
	});

	it('preserves native HTTP errors', async () => {
		vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(jsonResponse({}, 401));

		await expect(discoverProviderModels({
			name: 'Custom',
			type: 'openai-compatible',
			apiKey: 'bad-key',
			url: 'https://api.example.com/openai',
			models: [],
		})).rejects.toMatchObject({ status: 401 });
	});

	it('follows Anthropic cursor pagination', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl')
			.mockResolvedValueOnce(jsonResponse({
				data: [{ id: 'claude-z', display_name: 'Zulu' }],
				has_more: true,
				last_id: 'cursor-1',
			}))
			.mockResolvedValueOnce(jsonResponse({
				data: [{ id: 'claude-a', display_name: 'Alpha' }],
				has_more: false,
			}));

		const models = await discoverProviderModels({
			name: 'Anthropic', type: 'anthropic', apiKey: 'key', models: [],
		});

		expect(models.map((model) => model.name)).toEqual(['claude-a', 'claude-z']);
		expect((requestUrlSpy.mock.calls[1][0] as any).url).toContain('after_id=cursor-1');
		expect((requestUrlSpy.mock.calls[0][0] as any).headers).toMatchObject({
			'x-api-key': 'key',
			'anthropic-version': '2023-06-01',
		});
	});

	it('follows Gemini pagination and filters unsupported models', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl')
			.mockResolvedValueOnce(jsonResponse({
				models: [
					{ name: 'models/embed', supportedGenerationMethods: ['embedContent'] },
					{ name: 'models/gemini-z', displayName: 'Zulu', supportedGenerationMethods: ['generateContent'] },
				],
				nextPageToken: 'page-2',
			}))
			.mockResolvedValueOnce(jsonResponse({
				models: [{ name: 'models/gemini-a', displayName: 'Alpha', supportedGenerationMethods: ['generateContent'] }],
			}));

		const models = await discoverProviderModels({
			name: 'Gemini', type: 'gemini', apiKey: 'key', models: [],
		});

		expect(models.map((model) => model.name)).toEqual(['gemini-a', 'gemini-z']);
		expect((requestUrlSpy.mock.calls[0][0] as any).url).not.toContain('key=');
		expect((requestUrlSpy.mock.calls[0][0] as any).headers).toEqual({ 'x-goog-api-key': 'key' });
		expect((requestUrlSpy.mock.calls[1][0] as any).url).toContain('pageToken=page-2');
	});
});
