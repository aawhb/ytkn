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

export class OpenAIProvider extends AbstractProvider {
	protected readonly providerName: string;
	private readonly baseUrl: string;

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
		this.baseUrl = (
			providerType === 'openai'
				? 'https://api.openai.com/v1'
				: baseUrl || DEFAULT_OPENAI_COMPATIBLE_URL
		).replace(/\/+$/, '');
	}

	protected async requestCompletion(prompt: string, signal?: AbortSignal): Promise<{ text: string; truncated: boolean }> {
		const request: ChatCompletionRequest = {
			model: this.model,
			messages: [{ role: 'user', content: prompt }],
			temperature: this.temperature,
			stream: false,
		};

		const completion = await requestUrlJson<ChatCompletionResponse>(
			`${this.baseUrl}/chat/completions`,
			{
				method: 'POST',
				headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
				body: request,
				timeoutMs: this.requestTimeoutMs,
				signal,
			},
		);
		const choice = completion.choices?.[0];
		const text = choice?.message?.content ?? '';

		return { text, truncated: choice?.finish_reason === 'length' };
	}
}
