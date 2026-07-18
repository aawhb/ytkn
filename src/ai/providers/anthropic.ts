import { DEFAULT_ANTHROPIC_MAX_TOKENS } from '../../defaults';
import { AbstractProvider } from './base';
import { requestUrlJson } from './requestUrlJson';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

interface AnthropicContentBlock {
	type?: string;
	text?: string;
}

interface AnthropicMessageResponse {
	content?: AnthropicContentBlock[];
	stop_reason?: string;
}

export class AnthropicProvider extends AbstractProvider {
	protected readonly providerName = 'Anthropic';

	constructor(
		private readonly apiKey: string,
		model: string,
		temperature: number,
		requestTimeoutMs: number,
	) {
		super(model, temperature, requestTimeoutMs);
	}

	protected async requestCompletion(prompt: string, signal?: AbortSignal): Promise<{ text: string; truncated: boolean }> {
		const response = await requestUrlJson<AnthropicMessageResponse>(ANTHROPIC_MESSAGES_URL, {
			method: 'POST',
			headers: {
				'x-api-key': this.apiKey,
				'anthropic-version': '2023-06-01',
			},
			body: {
				model: this.model,
				max_tokens: DEFAULT_ANTHROPIC_MAX_TOKENS,
				messages: [{ role: 'user', content: prompt }],
			},
			timeoutMs: this.requestTimeoutMs,
			signal,
		});
		const text = (response.content ?? [])
			.flatMap((block) => (block.type === 'text' && block.text ? [block.text] : []))
			.join('\n\n')
			.trim();

		if (!text) {
			throw new Error('Anthropic returned no final text content.');
		}

		return { text, truncated: response.stop_reason === 'max_tokens' };
	}
}
