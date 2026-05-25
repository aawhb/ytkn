import { GoogleGenerativeAI } from '@google/generative-ai';
import { AbstractProvider } from './base';

export class GeminiProvider extends AbstractProvider {
	protected readonly providerName = 'Gemini';
	private client: GoogleGenerativeAI;

	constructor(
		apiKey: string,
		model: string,
		temperature: number,
		requestTimeoutMs: number,
	) {
		super(model, temperature, requestTimeoutMs);
		this.client = new GoogleGenerativeAI(apiKey);
	}

	// NOTE: the official @google/generative-ai SDK does not accept an AbortSignal
	// for generateContent, so cancellation is best-effort: a request that has
	// already started will run to completion. The `signal` parameter is accepted
	// to satisfy the interface and for future SDK changes.
	protected async requestCompletion(prompt: string, _signal?: AbortSignal): Promise<{ text: string; truncated: boolean }> {
		const model = this.client.getGenerativeModel(
			{
				model: this.model,
				generationConfig: {
					temperature: this.temperature,
				},
			},
			{ timeout: this.requestTimeoutMs },
		);

		const result = await model.generateContent(prompt);
		const response = result.response;
		const text = response.text();

		return { text, truncated: String(response.candidates?.[0]?.finishReason) === 'MAX_TOKENS' };
	}
}
