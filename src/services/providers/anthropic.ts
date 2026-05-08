import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { DEFAULT_ANTHROPIC_MAX_TOKENS } from '../../defaults';
import { AbstractProvider } from './base';

export class AnthropicProvider extends AbstractProvider {
	protected readonly providerName = 'Anthropic';
	private client: Anthropic;

	constructor(
		apiKey: string,
		model: string,
		temperature: number,
		requestTimeoutMs: number,
		baseUrl?: string,
	) {
		super(model, temperature, requestTimeoutMs);
		// dangerouslyAllowBrowser is required because Obsidian runs in an Electron
		// renderer; the SDK refuses to instantiate otherwise.
		this.client = new Anthropic({
			apiKey,
			dangerouslyAllowBrowser: true,
			baseURL: baseUrl,
			timeout: this.requestTimeoutMs,
		});
	}

	protected async requestCompletion(prompt: string, signal?: AbortSignal): Promise<{ text: string; truncated: boolean }> {
		const request: MessageCreateParamsNonStreaming = {
			model: this.model,
			max_tokens: DEFAULT_ANTHROPIC_MAX_TOKENS,
			messages: [{ role: 'user', content: prompt }],
		};

		const response = await this.client.messages.create(request, signal ? { signal } : undefined);
		const text = response.content
			.flatMap((block) => (block.type === 'text' ? [block.text] : []))
			.join('\n\n')
			.trim();

		if (!text) {
			throw new Error('Anthropic returned no final text content.');
		}

		return { text, truncated: response.stop_reason === 'max_tokens' };
	}
}
