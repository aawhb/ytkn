import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { ReasoningMode } from '../../types';
import { DEFAULT_ANTHROPIC_MAX_TOKENS, DEFAULT_THINKING_BUDGET_TOKENS } from '../../defaults';
import { AbstractProvider } from './base';

export class AnthropicProvider extends AbstractProvider {
	protected readonly providerName = 'Anthropic';
	private client: Anthropic;

	constructor(
		apiKey: string,
		model: string,
		temperature: number,
		reasoningMode: ReasoningMode,
		requestTimeoutMs: number,
		baseUrl?: string,
	) {
		super(model, temperature, reasoningMode, requestTimeoutMs);
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
		const thinkingConfig = this.getThinkingConfig();

		const request: MessageCreateParamsNonStreaming = {
			model: this.model,
			max_tokens: DEFAULT_ANTHROPIC_MAX_TOKENS,
			messages: [{ role: 'user', content: prompt }],
		};

		if (thinkingConfig) {
			request.thinking = thinkingConfig;
		}

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

	private getThinkingConfig(): { type: 'enabled'; budget_tokens: number } | undefined {
		if (this.reasoningMode !== 'on') {
			return undefined;
		}

		return {
			type: 'enabled',
			budget_tokens: DEFAULT_THINKING_BUDGET_TOKENS,
		};
	}
}
