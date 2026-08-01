import { scanMarkdownLines, unwrapWholeMarkdownFence } from './markdownScanner';

const FRONTMATTER_OPEN_MARKER = '<!-- ytkn:frontmatter';
const FRONTMATTER_CLOSE_MARKER = '-->';

interface ExtractedFrontmatterBlock {
	frontmatter: Record<string, unknown> | null;
	bodyWithoutBlock: string;
	warnings: string[];
}

export function extractFrontmatterBlock(rawBody: string): ExtractedFrontmatterBlock {
	const openIndex = findOutsideFenceMarker(rawBody, FRONTMATTER_OPEN_MARKER);
	if (openIndex === -1) {
		return { frontmatter: null, bodyWithoutBlock: rawBody, warnings: [] };
	}

	const afterOpen = openIndex + FRONTMATTER_OPEN_MARKER.length;
	const closeIndex = findOutsideFenceMarker(rawBody, FRONTMATTER_CLOSE_MARKER, afterOpen);
	if (closeIndex === -1) {
		return {
			frontmatter: null,
			bodyWithoutBlock: rawBody,
			warnings: ['Frontmatter block opened but no closing `-->` marker found; ignoring.'],
		};
	}

	const yamlText = rawBody.slice(afterOpen, closeIndex).trim();
	const parsed = parseSimpleYaml(yamlText);

	const before = rawBody.slice(0, openIndex);
	const after = rawBody.slice(closeIndex + FRONTMATTER_CLOSE_MARKER.length);
	const stripped = (before + after).replace(/\n{3,}/g, '\n\n').trim();

	return {
		frontmatter: parsed.values,
		bodyWithoutBlock: stripped,
		warnings: parsed.warnings,
	};
}

function findOutsideFenceMarker(markdown: string, marker: string, minimumOffset = 0): number {
	const lines = scanMarkdownLines(markdown);
	let lineStart = 0;
	for (const line of lines) {
		if (!line.insideFence) {
			const searchFrom = Math.max(0, minimumOffset - lineStart);
			const markerIndex = line.text.indexOf(marker, searchFrom);
			if (markerIndex !== -1) {
				return lineStart + markerIndex;
			}
		}

		const newlineIndex = markdown.indexOf('\n', lineStart);
		lineStart = newlineIndex === -1 ? markdown.length : newlineIndex + 1;
	}
	return -1;
}

interface ParseResult {
	values: Record<string, unknown>;
	warnings: string[];
}

function parseSimpleYaml(text: string): ParseResult {
	const values: Record<string, unknown> = {};
	const warnings: string[] = [];
	const lines = text.split('\n');

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) {
			continue;
		}

		const colonIndex = line.indexOf(':');
		if (colonIndex === -1 || colonIndex === 0) {
			warnings.push(`Skipped malformed line in frontmatter block: ${rawLine.slice(0, 60)}`);
			continue;
		}

		const key = line.slice(0, colonIndex).trim();
		const valuePart = line.slice(colonIndex + 1).trim();

		if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(key)) {
			warnings.push(`Skipped invalid key in frontmatter block: ${key}`);
			continue;
		}

		values[key] = parseScalarOrArray(valuePart);
	}

	return { values, warnings };
}

function parseScalarOrArray(value: string): unknown {
	if (value === '') {
		return '';
	}

	if (value === 'null' || value === '~') {
		return null;
	}

	if (value === 'true') {
		return true;
	}

	if (value === 'false') {
		return false;
	}

	if (value.startsWith('[') && value.endsWith(']')) {
		const inner = value.slice(1, -1).trim();
		if (!inner) {
			return [];
		}
		return inner.split(',').map((item) => parseScalarOrArray(item.trim()));
	}

	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}

	const numericValue = Number(value);
	if (!Number.isNaN(numericValue) && /^-?\d+(\.\d+)?$/.test(value)) {
		return numericValue;
	}

	return value;
}

interface SectionPiece {
	heading: string;
	body: string;
}

interface SplitBodyByH2Result {
	preamble: string;
	sections: SectionPiece[];
}

export function splitBodyByH2(body: string): SplitBodyByH2Result {
	const pieces: SectionPiece[] = [];
	const lines = scanMarkdownLines(unwrapWholeMarkdownFence(body));

	let currentHeading: string | null = null;
	let currentBody: string[] = [];
	const preamble: string[] = [];

	const flush = () => {
		if (currentHeading !== null) {
			pieces.push({ heading: currentHeading, body: currentBody.join('\n').trim() });
		}
	};

	for (const line of lines) {
		const headingMatch = !line.insideFence
			? line.text.match(/^##[ \t]+(.+?)[ \t]*$/)
			: null;
		if (headingMatch) {
			flush();
			currentHeading = headingMatch[1].trim();
			currentBody = [];
		} else if (currentHeading === null) {
			preamble.push(line.text);
		} else {
			currentBody.push(line.text);
		}
	}

	flush();
	return {
		preamble: preamble.join('\n').trim(),
		sections: pieces,
	};
}
