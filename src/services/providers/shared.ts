import { DEFAULT_REQUEST_TIMEOUT_MS } from '../../defaults';

export function normalizeRequestTimeoutMs(timeoutMs: number): number {
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
		return DEFAULT_REQUEST_TIMEOUT_MS;
	}
	return Math.round(timeoutMs);
}
