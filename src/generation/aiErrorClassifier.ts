type AiErrorCause = 'rate-limit' | 'quota' | 'auth' | 'server' | 'timeout' | 'unknown';

const CAUSE_DESCRIPTIONS: Record<AiErrorCause, string> = {
	'rate-limit': 'hit a rate limit',
	quota: 'ran out of quota',
	auth: 'failed to authenticate',
	server: 'returned a server error',
	timeout: 'timed out',
	unknown: 'failed',
};

export function describeAiErrorCause(cause: AiErrorCause): string {
	return CAUSE_DESCRIPTIONS[cause];
}

export function classifyAiError(error: unknown): AiErrorCause {
	const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
	const status = resolveStatus(error, message);

	if (/quota/i.test(message)) {
		return 'quota';
	}
	if (status === 429 || /rate.?limit/i.test(message)) {
		return 'rate-limit';
	}
	if (status === 401 || status === 403) {
		return 'auth';
	}
	if (status !== null && status >= 500) {
		return 'server';
	}
	if (/timed? ?out|timeout/i.test(message)) {
		return 'timeout';
	}
	return 'unknown';
}

function resolveStatus(error: unknown, message: string): number | null {
	const statusField = (error as { status?: unknown } | null | undefined)?.status;
	if (typeof statusField === 'number') {
		return statusField;
	}

	const match = message.match(/^Request failed: (\d{3})\b/);
	return match ? Number(match[1]) : null;
}
