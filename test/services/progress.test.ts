import { describe, expect, it } from 'vitest';
import {
	buildProgressContent,
	buildProgressMarkers,
	findProgressRange,
	isAbortError,
	replaceMarkedContent,
	replaceRange,
} from '../../src/services/progress';

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
});

describe('findProgressRange', () => {
	const markers = buildProgressMarkers('job-x');
	const block = buildProgressContent(markers, { url: 'https://yt/x', status: 'Working' });

	it('finds the marker range when present', () => {
		const data = `prefix\n${block}\nsuffix`;
		const range = findProgressRange(markers, data);

		expect(range).not.toBeNull();
		expect(data.slice(range!.start, range!.end)).toBe(block);
	});

	it('returns null when the start marker is missing', () => {
		expect(findProgressRange(markers, 'no markers here')).toBeNull();
	});

	it('returns null when the end marker is missing', () => {
		const partial = `prefix\n${markers.startMarker}\nbody without end`;
		expect(findProgressRange(markers, partial)).toBeNull();
	});

	it('handles multiple jobs in the same document', () => {
		const otherMarkers = buildProgressMarkers('job-y');
		const otherBlock = buildProgressContent(otherMarkers, { url: 'https://yt/y', status: 'Other' });
		const data = `${block}\n\n${otherBlock}`;

		const xRange = findProgressRange(markers, data);
		const yRange = findProgressRange(otherMarkers, data);

		expect(xRange).not.toBeNull();
		expect(yRange).not.toBeNull();
		expect(data.slice(xRange!.start, xRange!.end)).toBe(block);
		expect(data.slice(yRange!.start, yRange!.end)).toBe(otherBlock);
	});
});

describe('replaceRange and replaceMarkedContent', () => {
	it('clamps replacement offsets that exceed the document length', () => {
		expect(replaceRange('abc', { start: 10, end: 20 }, 'X')).toBe('abcX');
	});

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
