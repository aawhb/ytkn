import { describe, expect, it } from 'vitest';
import {
	buildProgressContent,
	buildProgressMarkers,
	isAbortError,
	replaceMarkedContent,
} from '../../src/queue/progress';

describe('progress markers', () => {
	it('builds unique markers per job id', () => {
		const a = buildProgressMarkers('job-a');
		const b = buildProgressMarkers('job-b');
		expect(a.startMarker).toContain('job-a');
		expect(a.endMarker).toContain('job-a');
		expect(b.startMarker).not.toBe(a.startMarker);
	});

	it('builds an info callout block by default', () => {
		const markers = buildProgressMarkers('job-1');
		const content = buildProgressContent(markers, { url: 'https://yt/1', status: 'Fetching transcript...' });

		expect(content).toContain('<!-- ytkn:job-1:start -->');
		expect(content).toContain('> [!info] YouTube Knowledge Note');
		expect(content).toContain('> Status: Fetching transcript...');
		expect(content).toContain('> Video: https://yt/1');
		expect(content).toContain('<!-- ytkn:job-1:end -->');
	});

	it('inserts the error line above the URL on failure blocks', () => {
		const markers = buildProgressMarkers('job-2');
		const content = buildProgressContent(markers, {
			url: 'https://yt/2',
			status: 'Failed',
			kind: 'failure',
			errorMessage: 'No captions available',
		});

		expect(content).toContain('> [!failure] YouTube Knowledge Note');
		const lines = content.split('\n');
		const errorLineIndex = lines.findIndex((line) => line.includes('Error: No captions available'));
		const videoLineIndex = lines.findIndex((line) => line.includes('Video: https://yt/2'));
		expect(errorLineIndex).toBeGreaterThan(-1);
		expect(errorLineIndex).toBeLessThan(videoLineIndex);
	});

	it('renders remote error text as a bounded single Markdown line', () => {
		const markers = buildProgressMarkers('job-safe');
		const content = buildProgressContent(markers, {
			url: 'https://yt/safe',
			status: 'Failed',
			kind: 'failure',
			errorMessage: 'Bad response\n> [!danger] injected `code`',
		});

		expect(content).toContain('Error: Bad response \\> \\[\\!danger\\] injected \\`code\\`');
		expect(content).not.toContain('\n> [!danger]');
	});
});

describe('replaceMarkedContent', () => {
	it('falls back to the initial range when no marker is found yet', () => {
		const markers = buildProgressMarkers('first');
		const result = replaceMarkedContent(markers, 'hello world', '[block]', { start: 6, end: 11 });

		expect(result).toBe('hello [block]');
	});

	it('replaces only the marker range when a marker exists', () => {
		const markers = buildProgressMarkers('rerun');
		const block = buildProgressContent(markers, { url: 'https://yt/r', status: 'a' });
		const data = `before\n${block}\nafter`;

		const newBlock = buildProgressContent(markers, { url: 'https://yt/r', status: 'b' });
		const updated = replaceMarkedContent(markers, data, newBlock, { start: 0, end: data.length });

		expect(updated).toContain('Status: b');
		expect(updated).not.toContain('Status: a');
		expect(updated.startsWith('before\n')).toBe(true);
		expect(updated.endsWith('\nafter')).toBe(true);
	});

	it('does not replace a partial marker block', () => {
		const markers = buildProgressMarkers('partial');
		const data = `before\n${markers.startMarker}\nunfinished`;

		expect(replaceMarkedContent(markers, data, '[block]', { start: data.length, end: data.length }))
			.toBe(`${data}[block]`);
	});
});

describe('isAbortError', () => {
	it('treats AbortError instances as cancellations', () => {
		const err = new Error('aborted');
		err.name = 'AbortError';
		expect(isAbortError(err)).toBe(true);
	});

	it('treats an aborted signal as a cancellation regardless of error shape', () => {
		const controller = new AbortController();
		controller.abort();
		expect(isAbortError(new Error('Request failed'), controller.signal)).toBe(true);
	});

	it('treats aborted error messages as cancellations', () => {
		expect(isAbortError(new Error('The request was aborted by the user.'))).toBe(true);
	});

	it('returns false for normal errors with an inactive signal', () => {
		const controller = new AbortController();
		expect(isAbortError(new Error('Bad request'), controller.signal)).toBe(false);
		expect(isAbortError('not aborted')).toBe(false);
	});
});
