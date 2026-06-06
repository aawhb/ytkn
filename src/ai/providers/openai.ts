import OpenAI from 'openai';
import { DEFAULT_OPENAI_COMPATIBLE_URL } from '../../defaults';
import { fetchFn, FetchLike } from '../../utils';
import { AbstractProvider } from './base';

const NO_FETCH_ERROR = 'No fetch implementation available to talk to the OpenAI-compatible endpoint.';

interface ChatCompletionMessage {
	role?: string;
	content?: string;
}

interface ChatCompletionChoice {
	message?: ChatCompletionMessage;
	finish_reason?: string;
}

interface ChatCompletionResponse {
	choices?: ChatCompletionChoice[];
}

interface ChatCompletionRequest {
	model: string;
	messages: Array<{ role: string; content: string }>;
	temperature?: number;
	stream?: boolean;
	[key: string]: unknown;
}

interface ChatClient {
	chat: {
		completions: {
			create: (
				options: ChatCompletionRequest,
				requestOptions?: { signal?: AbortSignal },
			) => Promise<ChatCompletionResponse>;
		};
	};
	models: {
		retrieve: (modelId: string) => Promise<unknown>;
	};
}

function withTimeout(
	fetchImpl: FetchLike,
	url: string,
	options: RequestInit,
	timeoutMs: number,
	signal?: AbortSignal,
): Promise<Response> {
	const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
	const timeoutId = controller
		? window.setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
		: undefined;
	const abortListener = controller && signal
		? () => controller.abort(signal.reason ?? new Error('Request aborted'))
		: undefined;

	if (abortListener && signal) {
		if (signal.aborted) {
			abortListener();
		} else {
			signal.addEventListener('abort', abortListener, { once: true });
		}
	}

	const requestOptions: RequestInit = controller
		? { ...options, signal: controller.signal }
		: signal
			? { ...options, signal }
			: options;

	return fetchImpl(url, requestOptions).finally(() => {
		if (timeoutId !== undefined) {
			window.clearTimeout(timeoutId);
		}

		if (signal && abortListener) {
			signal.removeEventListener('abort', abortListener);
		}
	});
}

export class OpenAIProvider extends AbstractProvider {
	protected readonly providerName = 'OpenAI-compatible';
	private client: ChatClient;

	constructor(
		private apiKey: string,
		model: string,
		temperature: number,
		requestTimeoutMs: number,
		baseUrl?: string,
	) {
		super(model, temperature, requestTimeoutMs);
		this.client = apiKey ? this.createOfficialClient(baseUrl) : this.createCompatibleClient(baseUrl);
	}

	protected async requestCompletion(prompt: string, signal?: AbortSignal): Promise<{ text: string; truncated: boolean }> {
		const request: ChatCompletionRequest = {
			model: this.model,
			messages: [{ role: 'user', content: prompt }],
			temperature: this.temperature,
			stream: false,
		};

		const completion = await this.client.chat.completions.create(request, signal ? { signal } : undefined);
		const choice = completion.choices?.[0];
		const text = choice?.message?.content ?? '';

		return { text, truncated: choice?.finish_reason === 'length' };
	}

	private createOfficialClient(baseUrl?: string): ChatClient {
		// dangerouslyAllowBrowser is required because Obsidian runs in an Electron
		// renderer; the official SDK refuses to instantiate otherwise.
		return new OpenAI({
			baseURL: baseUrl || undefined,
			dangerouslyAllowBrowser: true,
			apiKey: this.apiKey,
			timeout: this.requestTimeoutMs,
		}) as unknown as ChatClient;
	}

	private createCompatibleClient(baseUrl?: string): ChatClient {
		const fetchImpl = activeWindow.fetch?.bind(activeWindow) ?? fetchFn;
		if (!fetchImpl) {
			return {
				chat: {
					completions: {
						create: async () => {
							throw new Error(NO_FETCH_ERROR);
						},
					},
				},
				models: {
					retrieve: async () => {
						throw new Error(NO_FETCH_ERROR);
					},
				},
			};
		}

		const baseUrlClean = (baseUrl || DEFAULT_OPENAI_COMPATIBLE_URL).replace(/\/$/, '');

		const requestCompatibleCompletion = async (
			options: ChatCompletionRequest,
			signal?: AbortSignal,
		): Promise<ChatCompletionResponse> => {
			const response = await withTimeout(
				fetchImpl,
				`${baseUrlClean}/chat/completions`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ stream: false, ...options }),
				},
				this.requestTimeoutMs,
				signal,
			);

			if (!response.ok) {
				const responseText = await response.text();
				throw new Error(`Chat completion failed: ${response.status} ${responseText}`);
			}

			const payload = await response.json() as unknown;
			return (payload && typeof payload === 'object' ? payload : {});
		};

		return {
			models: {
				retrieve: async (modelId: string) => {
					const response = await fetchImpl(`${baseUrlClean}/models/${encodeURIComponent(modelId)}`, {
						method: 'GET',
					});

					if (!response.ok) {
						throw new Error(`Model retrieve failed: ${response.status}`);
					}

					const payload: unknown = await response.json();
					return payload;
				},
			},
			chat: {
				completions: {
					create: (options, requestOptions) => requestCompatibleCompletion(options, requestOptions?.signal),
				},
			},
		};
	}
}
