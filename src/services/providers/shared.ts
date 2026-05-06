import { DEFAULT_REQUEST_TIMEOUT_MS } from '../../defaults';
import type { ReasoningSupport } from '../../types';

export function normalizeRequestTimeoutMs(timeoutMs: number): number {
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
		return DEFAULT_REQUEST_TIMEOUT_MS;
	}
	return Math.round(timeoutMs);
}

export function detectOpenAIReasoningSupport(modelId: string): ReasoningSupport {
	// o-series (o1, o3, o4-mini) and gpt-5 family support reasoning_effort.
	if (/^o\d/.test(modelId) || /^gpt-5/.test(modelId)) {
		return 'supported';
	}
	return 'unsupported';
}

export function detectAnthropicReasoningSupport(modelId: string): ReasoningSupport {
	// Claude 3.7, 4.x, and 5.x support extended thinking.
	if (/claude-(opus|sonnet|haiku)-(3-7|4-|5-)/.test(modelId)) {
		return 'supported';
	}
	return 'unsupported';
}

export function detectGeminiReasoningSupport(modelId: string): ReasoningSupport {
	// Gemini 2.5 (thinkingBudget) and 3.x (thinkingLevel) support thinking.
	if (/gemini-(2\.5|3)/.test(modelId)) {
		return 'supported';
	}
	return 'unsupported';
}
