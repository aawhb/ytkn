import { TRUNCATION_NOTICE } from '../../defaults';
import type { AIModelProvider, ReasoningMode } from '../../types';
import { normalizeRequestTimeoutMs } from './shared';

export abstract class AbstractProvider implements AIModelProvider {
	protected readonly model: string;
	protected readonly temperature: number;
	protected readonly reasoningMode: ReasoningMode;
	protected readonly requestTimeoutMs: number;

	protected abstract readonly providerName: string;

	constructor(
		model: string,
		temperature: number,
		reasoningMode: ReasoningMode,
		requestTimeoutMs: number,
	) {
		this.model = model;
		this.temperature = temperature;
		this.reasoningMode = reasoningMode;
		this.requestTimeoutMs = normalizeRequestTimeoutMs(requestTimeoutMs);
	}

	protected getErrorContext(): unknown[] {
		return [];
	}

	protected abstract requestCompletion(prompt: string, signal?: AbortSignal): Promise<{ text: string; truncated: boolean }>;

	async summarizeVideo(prompt: string, signal?: AbortSignal): Promise<string> {
		try {
			const { text, truncated } = await this.requestCompletion(prompt, signal);
			return truncated ? text + TRUNCATION_NOTICE : text;
		} catch (error) {
			console.error(`Error generating summary with ${this.providerName}:`, error, ...this.getErrorContext());
			throw error;
		}
	}
}
