import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TRUNCATION_NOTICE, DEFAULT_REQUEST_TIMEOUT_MS } from '../../src/defaults';
import { AbstractProvider } from '../../src/services/providers/base';
import { normalizeRequestTimeoutMs } from '../../src/services/providers/shared';

class TestProvider extends AbstractProvider {
    protected readonly providerName = 'TestProvider';
    public nextResult: { text: string; truncated: boolean } | null = null;
    public nextError: Error | null = null;
    public contexts: unknown[] = [];

    get normalizedTimeout(): number {
        return this.requestTimeoutMs;
    }

    protected getErrorContext(): unknown[] {
        return this.contexts;
    }

    protected async requestCompletion(): Promise<{ text: string; truncated: boolean }> {
        if (this.nextError) {
            throw this.nextError;
        }
        return this.nextResult ?? { text: 'ok', truncated: false };
    }
}

describe('provider shared helpers', () => {
    it('normalizes request timeouts to a positive rounded millisecond value', () => {
        expect(normalizeRequestTimeoutMs(1234.6)).toBe(1235);
        expect(normalizeRequestTimeoutMs(0)).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
        expect(normalizeRequestTimeoutMs(-1)).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
        expect(normalizeRequestTimeoutMs(Number.NaN)).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
        expect(new TestProvider('model', 0.3, 1000.4).normalizedTimeout).toBe(1000);
    });
});

describe('AbstractProvider', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('appends the truncation notice when providers report truncated output', async () => {
        const provider = new TestProvider('model', 0.3, 300000);
        provider.nextResult = { text: 'partial summary', truncated: true };

        await expect(provider.summarizeVideo('prompt')).resolves.toBe(`partial summary${TRUNCATION_NOTICE}`);
    });

    it('logs provider name and context before rethrowing request errors', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const provider = new TestProvider('model', 0.3, 300000);
        const error = new Error('network down');
        provider.nextError = error;
        provider.contexts = [{ model: 'model' }];

        await expect(provider.summarizeVideo('prompt')).rejects.toBe(error);
        expect(consoleSpy).toHaveBeenCalledWith(
            'Error generating summary with TestProvider:',
            error,
            { model: 'model' },
        );
    });
});
