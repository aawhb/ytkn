import { AbstractProvider } from './base';
import { requestUrlJson } from './requestUrlJson';

const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiPart {
	text?: string;
}

interface GeminiCandidate {
	content?: { parts?: GeminiPart[] };
	finishReason?: string;
	finishMessage?: string;
}

interface GeminiResponse {
	candidates?: GeminiCandidate[];
	promptFeedback?: { blockReason?: string; blockReasonMessage?: string };
}

const BLOCKED_FINISH_REASONS = new Set([
	'SAFETY',
	'RECITATION',
	'BLOCKLIST',
	'PROHIBITED_CONTENT',
	'SPII',
]);

export class GeminiProvider extends AbstractProvider {
	protected readonly providerName = 'Gemini';

	constructor(
		private readonly apiKey: string,
		model: string,
		temperature: number,
		requestTimeoutMs: number,
	) {
		super(model, temperature, requestTimeoutMs);
	}

	protected async requestCompletion(prompt: string, signal?: AbortSignal): Promise<{ text: string; truncated: boolean }> {
		const modelPath = normalizeModelPath(this.model);
		const response = await requestUrlJson<GeminiResponse>(
			`${GEMINI_API_ROOT}/${modelPath}:generateContent`,
			{
				method: 'POST',
				headers: { 'x-goog-api-key': this.apiKey },
				body: {
					contents: [{ role: 'user', parts: [{ text: prompt }] }],
					generationConfig: { temperature: this.temperature },
				},
				timeoutMs: this.requestTimeoutMs,
				signal,
			},
		);

		if (response.promptFeedback?.blockReason) {
			throw new Error(
				`Gemini blocked the prompt: ${response.promptFeedback.blockReasonMessage ?? response.promptFeedback.blockReason}`,
			);
		}

		const candidate = response.candidates?.[0];
		if (candidate?.finishReason && BLOCKED_FINISH_REASONS.has(candidate.finishReason)) {
			throw new Error(
				`Gemini blocked the response: ${candidate.finishMessage ?? candidate.finishReason}`,
			);
		}

		const text = (candidate?.content?.parts ?? [])
			.flatMap((part) => part.text ? [part.text] : [])
			.join('');
		return { text, truncated: candidate?.finishReason === 'MAX_TOKENS' };
	}
}

function normalizeModelPath(model: string): string {
	const path = model.includes('/') ? model : `models/${model}`;
	return path.split('/').map(encodeURIComponent).join('/');
}
