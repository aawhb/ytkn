import OpenAI from 'openai';
import { DEFAULT_OPENAI_COMPATIBLE_URL } from '../../defaults';
import { ReasoningMode } from '../../types';
import { fetchFn, FetchLike, getOllamaBaseUrl, isOllamaEndpoint } from '../../utils';
import { AbstractProvider } from './base';
import { detectOpenAIReasoningSupport } from './shared';

const NO_FETCH_ERROR = 'No fetch implementation available to talk to the OpenAI-compatible endpoint.';
// -1 tells Ollama to generate without a token limit (model decides when to stop).
const OLLAMA_NUM_PREDICT = -1;

interface ChatCompletionMessage {
	role?: string;
	content?: string;
	reasoning?: string;
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
	reasoning_effort?: 'none' | 'low' | 'medium' | 'high';
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
		? activeWindow.setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
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
			activeWindow.clearTimeout(timeoutId);
		}

		if (signal && abortListener) {
			signal.removeEventListener('abort', abortListener);
		}
	});
}

function getReasoningEffort(reasoningMode: ReasoningMode): 'none' | 'medium' | undefined {
	switch (reasoningMode) {
		case 'off':
			return 'none';
		case 'on':
			return 'medium';
		default:
			return undefined;
	}
}

function getOllamaThink(reasoningMode: ReasoningMode): boolean | undefined {
	switch (reasoningMode) {
		case 'off':
			return false;
		case 'on':
			return true;
		default:
			return undefined;
	}
}


export class OpenAIProvider extends AbstractProvider {
	protected readonly providerName = 'OpenAI-compatible';
	private client: ChatClient;

	constructor(
		private apiKey: string,
		model: string,
		temperature: number,
		reasoningMode: ReasoningMode,
		requestTimeoutMs: number,
		baseUrl?: string,
	) {
		super(model, temperature, reasoningMode, requestTimeoutMs);
		this.client = apiKey ? this.createOfficialClient(baseUrl) : this.createCompatibleClient(baseUrl);
	}

	protected async requestCompletion(prompt: string, signal?: AbortSignal): Promise<{ text: string; truncated: boolean }> {
		const isReasoningModel = detectOpenAIReasoningSupport(this.model) === 'supported';
		// OpenAI o-series and gpt-5 reject temperature when reasoning_effort is sent (HTTP 400).
		// Omit temperature for those models when reasoning is on.
		const omitTemperature = isReasoningModel && this.reasoningMode === 'on';

		const request: ChatCompletionRequest = {
			model: this.model,
			messages: [{ role: 'user', content: prompt }],
			...(omitTemperature ? {} : { temperature: this.temperature }),
			stream: false,
		};

		// Only send reasoning_effort for cloud OpenAI reasoning models.
		// Generic OpenAI-compat servers ignore or reject this param.
		const resolvedReasoningEffort = isReasoningModel ? getReasoningEffort(this.reasoningMode) : undefined;
		if (resolvedReasoningEffort) {
			request.reasoning_effort = resolvedReasoningEffort;
		}

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
		const ollamaCompatible = isOllamaEndpoint(baseUrlClean);

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

		const requestOllamaCompletion = async (
			options: ChatCompletionRequest,
			signal?: AbortSignal,
		): Promise<ChatCompletionResponse> => {
			const think = getOllamaThink(this.reasoningMode);
			const response = await withTimeout(
				fetchImpl,
				`${getOllamaBaseUrl(baseUrlClean)}/api/chat`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						model: options.model,
						messages: options.messages,
						stream: false,
						...(typeof think === 'boolean' ? { think } : {}),
						options: {
							temperature: options.temperature,
							num_predict: OLLAMA_NUM_PREDICT,
						},
					}),
				},
				this.requestTimeoutMs,
				signal,
			);

			if (!response.ok) {
				const responseText = await response.text();
				throw new Error(`Ollama fallback failed: ${response.status} ${responseText}`);
			}

			const payload = (await response.json()) as { message?: { content?: string }; done_reason?: string };
			return {
				choices: [
					{
						message: { content: payload?.message?.content || '' },
						finish_reason: payload?.done_reason === 'length' ? 'length' : 'stop',
					},
				],
			};
		};

		let warnedFallback = false;
		const warnFallbackOnce = (): void => {
			if (!warnedFallback) {
				warnedFallback = true;
				console.warn('OpenAI-compatible endpoint returned no content; falling back to Ollama /api/chat.');
			}
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
					create: async (options, requestOptions) => {
						const signal = requestOptions?.signal;
						// When reasoning is ON and endpoint is Ollama, go directly to
						// native /api/chat which handles think:true reliably.
						// The /v1/chat/completions path often returns empty content
						// or times out when reasoning is enabled on Ollama.
						if (ollamaCompatible && this.reasoningMode === 'on') {
							try {
								return await requestOllamaCompletion(options, signal);
							} catch {
								return requestCompatibleCompletion(options, signal);
							}
						}

						try {
							const completion = await requestCompatibleCompletion(options, signal);
							const content = completion?.choices?.[0]?.message?.content;
							const reasoning = completion?.choices?.[0]?.message?.reasoning;

							if ((typeof content === 'string' && content.trim()) || !ollamaCompatible || !reasoning) {
								return completion;
							}

							warnFallbackOnce();
							return requestOllamaCompletion(options, signal);
						} catch (error) {
							if (!ollamaCompatible) {
								throw error;
							}

							warnFallbackOnce();
							return requestOllamaCompletion(options, signal);
						}
					},
				},
			},
		};
	}
}
