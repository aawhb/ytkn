export interface ScannedMarkdownLine {
	text: string;
	insideFence: boolean;
	fenceBoundary: 'open' | 'close' | null;
}

interface Fence {
	marker: '`' | '~';
	length: number;
}

export function scanMarkdownLines(markdown: string): ScannedMarkdownLine[] {
	let fence: Fence | null = null;

	return markdown.split(/\r?\n/).map((text) => {
		if (fence === null) {
			const opening = text.match(/^ {0,3}(`{3,}|~{3,})/);
			if (!opening) {
				return { text, insideFence: false, fenceBoundary: null };
			}
			fence = { marker: opening[1][0] as Fence['marker'], length: opening[1].length };
			return { text, insideFence: true, fenceBoundary: 'open' };
		}

		const closing = text.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
		if (closing && closing[1][0] === fence.marker && closing[1].length >= fence.length) {
			fence = null;
			return { text, insideFence: true, fenceBoundary: 'close' };
		}

		return { text, insideFence: true, fenceBoundary: null };
	});
}

export function unwrapWholeMarkdownFence(markdown: string): string {
	const lines = scanMarkdownLines(markdown);
	const first = lines.findIndex((line) => line.text.trim().length > 0);
	const last = lines.findLastIndex((line) => line.text.trim().length > 0);
	if (first === -1 || last <= first) {
		return markdown;
	}

	const opening = lines[first];
	const closing = lines[last];
	const isMarkdownFence = /^ {0,3}(`{3}|~{3})(?:markdown|md)[ \t]*$/i.test(opening.text);
	const hasSingleOuterFence = lines
		.slice(first + 1, last)
		.every((line) => line.insideFence && line.fenceBoundary === null);
	if (
		opening.fenceBoundary !== 'open'
		|| closing.fenceBoundary !== 'close'
		|| !isMarkdownFence
		|| !hasSingleOuterFence
	) {
		return markdown;
	}

	return lines.slice(first + 1, last).map((line) => line.text).join('\n');
}
