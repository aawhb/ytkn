import { decodeHtmlEntitiesDeep } from '../utils';
import {
	assertValidMindmapMermaid,
	parseConceptOutline,
	renderMindmapList,
	renderMindmapMermaid,
	type ConceptNode,
} from './conceptTree';
import { scanMarkdownLines, unwrapWholeMarkdownFence } from './markdownScanner';

const MERMAID_FENCE = /```mermaid\s*\n([\s\S]*?)```/i;

function normalizeMermaidBlocks(summaryText: string): string {
	let decodingMermaid = false;
	return scanMarkdownLines(summaryText).map((line) => {
		if (
			line.fenceBoundary === 'open'
			&& /^ {0,3}`{3,}mermaid[ \t]*$/i.test(line.text)
		) {
			decodingMermaid = true;
			return line.text;
		}
		if (decodingMermaid && line.fenceBoundary === 'close') {
			decodingMermaid = false;
			return line.text;
		}
		return decodingMermaid ? decodeHtmlEntitiesDeep(line.text) : line.text;
	}).join('\n');
}

export function normalizeMindmapContent(body: string): string {
	if (MERMAID_FENCE.test(body)) {
		return body;
	}

	const tree: ConceptNode | null = parseConceptOutline(body);
	if (!tree) {
		return body;
	}

	const mermaid = renderMindmapMermaid(tree);
	if (!assertValidMindmapMermaid(mermaid)) {
		return renderMindmapList(tree);
	}
	return ['```mermaid', mermaid, '```'].join('\n');
}

export function normalizeMemorableQuotesContent(content: string): string {
	const normalizedContent: string[] = [];
	let previousWasQuote = false;
	for (const line of scanMarkdownLines(content)) {
		const quoteMatch = !line.insideFence
			? line.text.match(/^\s*>?\s*\[!quote\]\s*(.+?)\s*$/i)
			: null;
		if (!quoteMatch) {
			normalizedContent.push(line.text);
			previousWasQuote = false;
			continue;
		}
		if (previousWasQuote) {
			normalizedContent.push('');
		}
		normalizedContent.push(`> [!quote] ${quoteMatch[1].trim()}`);
		previousWasQuote = true;
	}
	return normalizedContent.join('\n');
}

function removeModelOwnedSections(text: string): string {
	const lines = scanMarkdownLines(text);
	const kept: string[] = [];
	let removing = false;
	for (const line of lines) {
		if (!line.insideFence && /^##[ \t]+(?:Source|(?:Full[ \t]+)?Transcript)[ \t]*$/i.test(line.text)) {
			removing = true;
			continue;
		}
		if (!line.insideFence && /^##[ \t]/.test(line.text)) {
			removing = false;
		}
		if (!removing) {
			kept.push(line.text);
		}
	}
	return kept.join('\n').trim();
}

function removeModelOwnedDetails(text: string): string {
	const lines = scanMarkdownLines(text);
	const kept: string[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const openingCandidate = lines
			.slice(index, index + 3)
			.map((candidate) => candidate.text)
			.join('\n');
		const isModelOwnedDetails = !line.insideFence
			&& /^\s*<details>\s*<summary>\s*(?:Transcript|Playlist transcripts)\s*<\/summary>/i.test(openingCandidate);
		if (!isModelOwnedDetails) {
			kept.push(line.text);
			continue;
		}

		const closingOffset = lines.slice(index).findIndex((candidate) => (
			!candidate.insideFence && /<\/details>/i.test(candidate.text)
		));
		if (closingOffset === -1) {
			kept.push(line.text);
			continue;
		}
		index += closingOffset;
	}
	return kept.join('\n');
}

export function sanitizeModelOutput(summaryText?: string | null): string {
	const unwrapped = unwrapWholeMarkdownFence(summaryText ?? '');
	return removeModelOwnedDetails(removeModelOwnedSections(normalizeMermaidBlocks(unwrapped))).trim();
}

export function buildTldrCallout(tldr: string): string {
	const lines = tldr.split('\n').map((line) => `> ${line}`.trimEnd());
	return ['> [!summary] TL;DR', ...lines].join('\n');
}

export function shiftMarkdownHeadings(text: string, levels: number): string {
	const extra = '#'.repeat(levels);
	return scanMarkdownLines(text).map((line) => {
		if (!line.insideFence && /^#{1,6} /.test(line.text)) {
			return extra + line.text;
		}
		return line.text;
	}).join('\n');
}
