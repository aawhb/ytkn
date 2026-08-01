export interface ProgressMarkers {
	startMarker: string;
	endMarker: string;
}

interface MarkerRange {
	start: number;
	end: number;
}

interface ProgressBlockOptions {
	url: string;
	status: string;
	kind?: 'info' | 'failure';
	errorMessage?: string;
}

export function buildProgressMarkers(jobId: string): ProgressMarkers {
	return {
		startMarker: `<!-- ytkn:${jobId}:start -->`,
		endMarker: `<!-- ytkn:${jobId}:end -->`,
	};
}

export function buildProgressContent({ startMarker, endMarker }: ProgressMarkers, options: ProgressBlockOptions): string {
	const lines = [
		startMarker,
		`> [!${options.kind ?? 'info'}] YouTube Knowledge Note`,
		`> Status: ${options.status}`,
		`> Video: ${options.url}`,
	];

	if (options.errorMessage) {
		const errorMessage = options.errorMessage
			.replace(/\s+/g, ' ')
			.slice(0, 500)
			.replace(/[\\`*_{}[\]<>()#+.!|]/g, '\\$&');
		lines.splice(3, 0, `> Error: ${errorMessage}`);
	}

	lines.push(endMarker);
	return lines.join('\n');
}

function findProgressRange(markers: ProgressMarkers, data: string): MarkerRange | null {
	const start = data.indexOf(markers.startMarker);
	if (start === -1) {
		return null;
	}

	const endStart = data.indexOf(markers.endMarker, start + markers.startMarker.length);
	if (endStart === -1) {
		return null;
	}

	return {
		start,
		end: endStart + markers.endMarker.length,
	};
}

function replaceRange(data: string, range: { start: number; end: number }, content: string): string {
	const start = Math.min(range.start, data.length);
	const end = Math.min(range.end, data.length);
	return `${data.slice(0, start)}${content}${data.slice(end)}`;
}

export function replaceMarkedContent(
	markers: ProgressMarkers,
	data: string,
	content: string,
	initialRange: { start: number; end: number },
): string {
	const range = findProgressRange(markers, data);
	if (range) {
		return replaceRange(data, range, content);
	}

	return replaceRange(data, initialRange, content);
}

export function isAbortError(error: unknown, signal?: AbortSignal): boolean {
	if (signal?.aborted) {
		return true;
	}

	if (error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError') {
		return true;
	}

	if (error instanceof Error && error.message.toLowerCase().includes('aborted')) {
		return true;
	}

	return false;
}
