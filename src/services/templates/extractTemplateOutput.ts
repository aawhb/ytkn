import type { ExtractedTemplateOutput, Template } from '../../types';

const FRONTMATTER_OPEN_MARKER = '<!-- ytkn:frontmatter';
const FRONTMATTER_CLOSE_MARKER = '-->';

export interface ExtractedFrontmatterBlock {
	frontmatter: Record<string, unknown> | null;
	bodyWithoutBlock: string;
	warnings: string[];
}

export function extractFrontmatterBlock(rawBody: string): ExtractedFrontmatterBlock {
	const openIndex = rawBody.indexOf(FRONTMATTER_OPEN_MARKER);
	if (openIndex === -1) {
		return { frontmatter: null, bodyWithoutBlock: rawBody, warnings: [] };
	}

	const afterOpen = openIndex + FRONTMATTER_OPEN_MARKER.length;
	const closeIndex = rawBody.indexOf(FRONTMATTER_CLOSE_MARKER, afterOpen);
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

export function extractTemplateOutput(rawBody: string, template: Template): ExtractedTemplateOutput {
	const blockResult = extractFrontmatterBlock(rawBody);
	const declaredSections = template.sections;

	if (!declaredSections || declaredSections.length === 0) {
		return {
			frontmatter: blockResult.frontmatter,
			sections: new Map(),
			extras: [],
			warnings: blockResult.warnings,
		};
	}

	const splitResult = splitBodyByH2(blockResult.bodyWithoutBlock);

	const matchedSections = new Map<string, string>();
	const matchedHeadings = new Set<string>();
	const extras: Array<{ heading: string; body: string }> = [];
	const warnings = [...blockResult.warnings];

	const declaredByLowerHeading = new Map<string, { id: string; heading: string }>();
	for (const section of declaredSections) {
		declaredByLowerHeading.set(section.heading.toLowerCase(), { id: section.id, heading: section.heading });
	}

	for (const piece of splitResult) {
		const exactMatch = declaredSections.find((s) => s.heading === piece.heading);
		const fallback = exactMatch ?? declaredByLowerHeading.get(piece.heading.toLowerCase());
		if (fallback) {
			matchedSections.set(fallback.id, piece.body);
			matchedHeadings.add(fallback.heading);
		} else {
			extras.push({ heading: piece.heading, body: piece.body });
		}
	}

	for (const section of declaredSections) {
		if (section.required && !matchedSections.has(section.id)) {
			warnings.push(`Required section "${section.heading}" was not emitted by the model.`);
		}
	}

	return {
		frontmatter: blockResult.frontmatter,
		sections: matchedSections,
		extras,
		warnings,
	};
}

interface SectionPiece {
	heading: string;
	body: string;
}

function splitBodyByH2(body: string): SectionPiece[] {
	const pieces: SectionPiece[] = [];
	const lines = body.split('\n');

	let currentHeading: string | null = null;
	let currentBody: string[] = [];

	const flush = () => {
		if (currentHeading !== null) {
			pieces.push({ heading: currentHeading, body: currentBody.join('\n').trim() });
		}
	};

	for (const line of lines) {
		const headingMatch = line.match(/^##[ \t]+(.+?)[ \t]*$/);
		if (headingMatch) {
			flush();
			currentHeading = headingMatch[1].trim();
			currentBody = [];
		} else if (currentHeading !== null) {
			currentBody.push(line);
		}
	}

	flush();
	return pieces;
}
