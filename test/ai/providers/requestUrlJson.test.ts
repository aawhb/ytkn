import { afterEach, describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import { RequestUrlHttpError, requestUrlJson } from '../../../src/ai/providers/requestUrlJson';

function response(text: string, status = 200): any {
	return {
		status,
		headers: { 'content-type': 'application/json' },
		arrayBuffer: new ArrayBuffer(0),
		json: undefined,
		text,
	};
}

describe('requestUrlJson', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('serializes request bodies and adds the JSON content type', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(response('{"ok":true}'));

		await expect(requestUrlJson<{ ok: boolean }>('https://api.example.com', {
			method: 'POST',
			headers: { Authorization: 'Bearer key' },
			body: { prompt: 'hello' },
		})).resolves.toEqual({ ok: true });
		expect(requestUrlSpy).toHaveBeenCalledWith({
			url: 'https://api.example.com',
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: 'Bearer key' },
			body: '{"prompt":"hello"}',
			throw: false,
		});
	});

	it('preserves transport rejections', async () => {
		vi.spyOn(obsidian, 'requestUrl').mockRejectedValue(new Error('native failure'));
		await expect(requestUrlJson('https://api.example.com')).rejects.toThrow('native failure');
	});

	it('reports HTTP status and bounds response bodies', async () => {
		vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(response('x'.repeat(1200), 429));

		const error = await requestUrlJson('https://api.example.com').catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(RequestUrlHttpError);
		expect(error).toMatchObject({ status: 429 });
		expect((error as Error).message.length).toBeLessThan(1100);
	});

	it('reports invalid JSON', async () => {
		vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(response('not json'));
		await expect(requestUrlJson('https://api.example.com'))
			.rejects.toThrow('Failed to parse JSON response');
	});

	it('does not start an already canceled request', async () => {
		const requestUrlSpy = vi.spyOn(obsidian, 'requestUrl');
		const controller = new AbortController();
		controller.abort(new Error('Canceled'));

		await expect(requestUrlJson('https://api.example.com', { signal: controller.signal }))
			.rejects.toThrow('Canceled');
		expect(requestUrlSpy).not.toHaveBeenCalled();
	});

	it('returns control on cancellation while consuming a late native response', async () => {
		let resolveRequest!: (value: any) => void;
		vi.spyOn(obsidian, 'requestUrl').mockReturnValue(new Promise((resolve) => {
			resolveRequest = resolve;
		}) as any);
		const controller = new AbortController();
		const request = requestUrlJson('https://api.example.com', { signal: controller.signal });

		controller.abort(new Error('Canceled'));
		await expect(request).rejects.toThrow('Canceled');
		resolveRequest(response('{"late":true}'));
		await Promise.resolve();
	});

	it('returns control when the logical timeout expires', async () => {
		vi.useFakeTimers();
		vi.spyOn(obsidian, 'requestUrl').mockReturnValue(new Promise(() => undefined) as any);
		const request = requestUrlJson('https://api.example.com', { timeoutMs: 50 });
		const expectation = expect(request).rejects.toThrow('Request timed out after 50ms');

		await vi.advanceTimersByTimeAsync(50);

		await expectation;
	});
});
