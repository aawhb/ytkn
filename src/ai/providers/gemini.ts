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

	// The Gemini SDK does not accept AbortSignal for generateContent; cancellation
	// is best-effort and in-flight requests run to completion.
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
