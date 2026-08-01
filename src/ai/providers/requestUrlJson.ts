import { requestUrl, type RequestUrlResponse } from 'obsidian';
import { getErrorMessage } from '../../utils';

const MAX_ERROR_BODY_LENGTH = 1000;

interface RequestUrlJsonOptions {
	method?: 'GET' | 'POST';
	headers?: Record<string, string>;
	body?: unknown;
	signal?: AbortSignal;
	timeoutMs?: number;
}

class RequestUrlHttpError extends Error {
	constructor(message: string, readonly status: number) {
		super(message);
		this.name = 'RequestUrlHttpError';
	}
}

export async function requestUrlJson<T>(url: string, options: RequestUrlJsonOptions = {}): Promise<T> {
	if (options.signal?.aborted) {
		throw abortReason(options.signal);
	}

	const method = options.method ?? 'GET';
	const body = options.body === undefined ? undefined : JSON.stringify(options.body);
	const headers = body === undefined
		? options.headers
		: { 'Content-Type': 'application/json', ...options.headers };
	const response = await waitForResponse(
		requestUrl({ url, method, headers, body, throw: false }),
		options.signal,
		options.timeoutMs,
	);

	if (response.status < 200 || response.status >= 300) {
		const responseBody = boundedResponseBody(response.text);
		throw new RequestUrlHttpError(
			`Request failed: ${response.status}${responseBody ? ` ${responseBody}` : ''}`,
			response.status,
		);
	}

	try {
		return JSON.parse(response.text) as T;
	} catch (error) {
		throw new Error(`Failed to parse JSON response: ${getErrorMessage(error)}`);
	}
}

function waitForResponse(
	request: Promise<RequestUrlResponse>,
	signal?: AbortSignal,
	timeoutMs?: number,
): Promise<RequestUrlResponse> {
	/* requestUrl cannot abort, so cancellation ignores a request that may finish remotely. */
	return new Promise((resolve, reject) => {
		let settled = false;
		let timeoutId: number | undefined;

		const cleanup = (): void => {
			if (timeoutId !== undefined) {
				window.clearTimeout(timeoutId);
			}
			signal?.removeEventListener('abort', handleAbort);
		};
		const settle = (callback: () => void): void => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			callback();
		};
		const handleAbort = (): void => settle(() => reject(abortReason(signal!)));

		if (signal) {
			signal.addEventListener('abort', handleAbort, { once: true });
			if (signal.aborted) {
				handleAbort();
				return;
			}
		}
		if (timeoutMs !== undefined && Number.isFinite(timeoutMs) && timeoutMs > 0) {
			timeoutId = window.setTimeout(
				() => settle(() => reject(new Error(`Request timed out after ${timeoutMs}ms`))),
				timeoutMs,
			);
		}

		request.then(
			(response) => settle(() => resolve(response)),
			(error: unknown) => settle(() => reject(asError(error))),
		);
	});
}

function abortReason(signal: AbortSignal): Error {
	if (signal.reason !== undefined) {
		return asError(signal.reason);
	}

	const error = new Error('Request aborted');
	error.name = 'AbortError';
	return error;
}

function asError(value: unknown): Error {
	return value instanceof Error ? value : new Error(getErrorMessage(value));
}

function boundedResponseBody(text: string): string {
	const trimmed = text.trim();
	return trimmed.length > MAX_ERROR_BODY_LENGTH
		? `${trimmed.slice(0, MAX_ERROR_BODY_LENGTH)}…`
		: trimmed;
}
