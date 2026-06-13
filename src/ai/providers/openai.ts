import OpenAI from 'openai';
import { DEFAULT_OPENAI_COMPATIBLE_URL } from '../../defaults';
import { AbstractProvider } from './base';
import { requestUrlJson } from './requestUrlJson';

type OpenAIProviderType = 'openai' | 'openai-compatible';

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
}

export class OpenAIProvider extends AbstractProvider {
	protected readonly providerName: string;
	private client: ChatClient;

	constructor(
		providerType: OpenAIProviderType,
		private apiKey: string,
		model: string,
		temperature: number,
		requestTimeoutMs: number,
		baseUrl?: string,
	) {
		super(model, temperature, requestTimeoutMs);
		this.providerName = providerType === 'openai' ? 'OpenAI' : 'OpenAI-compatible';
		this.client = providerType === 'openai'
			? this.createOfficialClient()
			: this.createCompatibleClient(baseUrl);
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

	private createOfficialClient(): ChatClient {
		// dangerouslyAllowBrowser is required because Obsidian runs in an Electron
		// renderer; the official SDK refuses to instantiate otherwise.
		return new OpenAI({
			dangerouslyAllowBrowser: true,
			apiKey: this.apiKey,
			timeout: this.requestTimeoutMs,
		}) as unknown as ChatClient;
	}

	private createCompatibleClient(baseUrl?: string): ChatClient {
		const baseUrlClean = (baseUrl || DEFAULT_OPENAI_COMPATIBLE_URL).replace(/\/$/, '');

		const requestCompatibleCompletion = async (
			options: ChatCompletionRequest,
			signal?: AbortSignal,
		): Promise<ChatCompletionResponse> => {
			const payload = await requestUrlJson<unknown>(
				`${baseUrlClean}/chat/completions`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
					},
					body: { stream: false, ...options },
					timeoutMs: this.requestTimeoutMs,
					signal,
				},
			);
			return payload && typeof payload === 'object' ? payload : {};
		};

		return {
			chat: {
				completions: {
					create: (options, requestOptions) => requestCompatibleCompletion(options, requestOptions?.signal),
				},
			},
		};
	}
}
