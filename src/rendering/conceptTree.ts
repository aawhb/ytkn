import { decodeHtmlEntitiesDeep, normalizeWhitespace } from '../utils';
import { latexToReadable } from './latexUnicode';

export interface ConceptNode {
	label: string;
	children: ConceptNode[];
}

interface IndentedLabel {
	indent: number;
	label: string;
}

const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
const VALID_MERMAID_LINE = /^(?: {2})*(?:root\(\("[^"]*"\)\)|node\d+\["[^"]*"\])$/;

function computeIndentWidth(line: string): number {
	let width = 0;
	for (const ch of line) {
		if (ch === '\t') {
			width += 2;
		} else if (ch === ' ') {
			width += 1;
		} else {
			break;
		}
	}
	return width;
}

function normalizeLabel(raw: string): string {
	return normalizeWhitespace(decodeHtmlEntitiesDeep(raw));
}

function buildTree(items: IndentedLabel[]): ConceptNode | null {
	if (items.length === 0) {
		return null;
	}

	const root: ConceptNode = { label: items[0].label, children: [] };
	const stack: Array<{ node: ConceptNode; indent: number }> = [{ node: root, indent: items[0].indent }];

	for (let i = 1; i < items.length; i += 1) {
		const { indent, label } = items[i];
		const node: ConceptNode = { label, children: [] };
		while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
			stack.pop();
		}
		stack[stack.length - 1].node.children.push(node);
		stack.push({ node, indent });
	}

	return root;
}

export function parseConceptOutline(body: string): ConceptNode | null {
	const items: IndentedLabel[] = [];
	for (const rawLine of body.split(/\r?\n/)) {
		// Only list items are nodes. Non-list lines (a prose preface like "Here is the
		// mindmap:", or trailing commentary) are skipped, so they never become a root.
		const match = rawLine.match(LIST_ITEM);
		if (!match) {
			continue;
		}
		const label = normalizeLabel(match[1]);
		if (!label || label.startsWith('%%')) {
			continue;
		}
		items.push({ indent: computeIndentWidth(rawLine), label });
	}
	return buildTree(items);
}

function escapeMermaidLabel(label: string): string {
	const withoutMarker = label.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '');
	const escaped = latexToReadable(withoutMarker)
		.replace(/<=|=</g, '≤')
		.replace(/>=/g, '≥')
		.replace(/!=|<>/g, '≠')
		.replace(/\s*(?:-+>|=+>|→)\s*/g, ' to ')
		.replace(/</g, '＜')
		.replace(/>/g, '＞')
		.replace(/\s+&\s+/g, ' and ')
		.replace(/"/g, "'")
		.replace(/[`[\]]/g, '');
	return normalizeWhitespace(escaped) || 'Node';
}

export function renderMindmapMermaid(root: ConceptNode): string {
	const lines = ['mindmap'];
	let counter = 0;

	const walk = (node: ConceptNode, depth: number, isRoot: boolean): void => {
		const indent = '  '.repeat(depth + 1);
		const label = escapeMermaidLabel(node.label);
		if (isRoot) {
			lines.push(`${indent}root(("${label}"))`);
		} else {
			counter += 1;
			lines.push(`${indent}node${counter}["${label}"]`);
		}
		for (const child of node.children) {
			walk(child, depth + 1, false);
		}
	};

	walk(root, 0, true);
	return lines.join('\n');
}

export function renderMindmapList(root: ConceptNode): string {
	const lines: string[] = [];
	const walk = (node: ConceptNode, depth: number): void => {
		lines.push(`${'  '.repeat(depth)}- ${node.label}`);
		for (const child of node.children) {
			walk(child, depth + 1);
		}
	};
	walk(root, 0);
	return lines.join('\n');
}

export function assertValidMindmapMermaid(text: string): boolean {
	const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
	if (lines.length === 0 || lines[0].trim().toLowerCase() !== 'mindmap') {
		return false;
	}
	return lines.slice(1).every((line) => VALID_MERMAID_LINE.test(line));
}
