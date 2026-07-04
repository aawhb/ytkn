import { describe, expect, it } from 'vitest';
import { classifyAiError, describeAiErrorCause } from '../../src/generation/aiErrorClassifier';

describe('classifyAiError', () => {
	it('classifies rate limits from transport status strings and SDK status fields', () => {
		expect(classifyAiError(new Error('Request failed: 429 {"error":"rate_limit_exceeded"}'))).toBe('rate-limit');
		expect(classifyAiError(Object.assign(new Error('Too Many Requests'), { status: 429 }))).toBe('rate-limit');
	});

	it('classifies quota exhaustion separately from rate limits', () => {
		expect(classifyAiError(new Error('Request failed: 429 {"error":{"type":"insufficient_quota"}}'))).toBe('quota');
		expect(classifyAiError(Object.assign(new Error('You exceeded your current quota'), { status: 429 }))).toBe('quota');
	});

	it('classifies auth, server, and timeout failures', () => {
		expect(classifyAiError(Object.assign(new Error('Incorrect API key'), { status: 401 }))).toBe('auth');
		expect(classifyAiError(new Error('Request failed: 403 forbidden'))).toBe('auth');
		expect(classifyAiError(new Error('Request failed: 529 overloaded'))).toBe('server');
		expect(classifyAiError(Object.assign(new Error('Bad gateway'), { status: 502 }))).toBe('server');
		expect(classifyAiError(new Error('Request timed out after 300000ms'))).toBe('timeout');
	});

	it('falls back to unknown for unrecognized errors', () => {
		expect(classifyAiError(new Error('something odd'))).toBe('unknown');
		expect(classifyAiError('plain string')).toBe('unknown');
	});

	it('describes causes in user-facing words', () => {
		expect(describeAiErrorCause('rate-limit')).toBe('hit a rate limit');
		expect(describeAiErrorCause('quota')).toBe('ran out of quota');
		expect(describeAiErrorCause('auth')).toBe('failed to authenticate');
		expect(describeAiErrorCause('server')).toBe('returned a server error');
		expect(describeAiErrorCause('timeout')).toBe('timed out');
		expect(describeAiErrorCause('unknown')).toBe('failed');
	});
});
