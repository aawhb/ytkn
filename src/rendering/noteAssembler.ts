import type { Template } from '../types';
import {
	normalizeMemorableQuotesContent,
	normalizeMindmapContent,
	sanitizeModelOutput,
} from './outputNormalizer';
import { ADDON_SECTIONS, type AddonFlags } from './noteSections';
import { extractFrontmatterBlock, splitBodyByH2 } from './templateOutput';
import { scanMarkdownLines, type ScannedMarkdownLine } from './markdownScanner';

export interface AssembledNote {
	tldr: string | null;
	body: string;
	addonBlocks: string[];
	frontmatter: Record<string, unknown>;
	warnings: string[];
}

export interface AssembledBodySelection {
	content: string;
	warnings: string[];
}

/**
 * Splits model output into summary and addon sections while enforcing template order and
 * preserving unmatched sections. Manual mode keeps user-defined sections unchanged.
 */
export function assembleNote(rawSummary: string | null | undefined, template: Template | null, flags: AddonFlags): AssembledNote {
	const modelOutputProvided = rawSummary !== null && rawSummary !== undefined;
	const sanitized = sanitizeModelOutput(rawSummary);
	const { frontmatter, bodyWithoutBlock, warnings } = extractFrontmatterBlock(sanitized);
	const allWarnings = [...warnings];

	const hasDeclaredSections = Boolean(template?.sections?.length);
	const addonByHeading = new Map(ADDON_SECTIONS.map((addon) => [addon.heading.toLowerCase(), addon]));

	let tldr: string | null = null;
	const addonContent = new Map<string, string>();
	const seenAddonIds = new Set<string>();
	const bodyPieces: Array<{ heading: string; body: string }> = [];
	const splitBody = splitBodyByH2(bodyWithoutBlock);

	for (const piece of splitBody.sections) {
		const addon = addonByHeading.get(piece.heading.toLowerCase());
		if (!addon) {
			bodyPieces.push(piece);
			continue;
		}
		if (!addon.enabled(flags)) {
			bodyPieces.push(piece);
			continue;
		}
		const content = piece.body.trim();
		if (!content) {
			continue;
		}
		if (seenAddonIds.has(addon.id)) {
			bodyPieces.push(piece);
			allWarnings.push(`Preserved duplicate section "${addon.heading}" emitted by the model.`);
			continue;
		}
		seenAddonIds.add(addon.id);
		if (addon.placement === 'tldr-callout') {
			tldr = content || null;
		} else if (content) {
			addonContent.set(
				addon.id,
				addon.id === 'mindmap'
					? normalizeMindmapContent(content)
					: addon.id === 'memorable-quotes'
						? normalizeMemorableQuotesContent(content)
						: content,
			);
		}
	}

	const bodySections = hasDeclaredSections
		? [
			splitBody.preamble,
			...selectDeclaredSections(template!, bodyPieces, allWarnings),
		]
		: [
			splitBody.preamble,
			...bodyPieces.map((piece) => `## ${piece.heading}\n${piece.body.trim()}`),
		].filter((section) => section.trim());

	const addonBlocks = ADDON_SECTIONS
		.filter((addon) => addon.placement === 'section' && addon.enabled(flags) && addonContent.has(addon.id))
		.map((addon) => `## ${addon.heading}\n${addonContent.get(addon.id)!}`);

	let body = bodySections.filter(Boolean).join('\n\n');
	if (flags.includeTldr && !tldr) {
		const fallback = extractManualTldr(body, !hasDeclaredSections);
		tldr = fallback.tldr;
		body = fallback.body;
	}
	if (hasDeclaredSections && splitBodyByH2(body).preamble) {
		allWarnings.push('Preserved undeclared preamble emitted by the model.');
	}
	if (modelOutputProvided) {
		for (const addon of ADDON_SECTIONS.filter((candidate) => candidate.enabled(flags))) {
			const emitted = addon.placement === 'tldr-callout' ? Boolean(tldr) : addonContent.has(addon.id);
			if (!emitted) {
				allWarnings.push(`Requested section "${addon.heading}" was not emitted by the model.`);
			}
		}
	}

	return {
		tldr,
		body,
		addonBlocks,
		frontmatter: frontmatter ?? {},
		warnings: allWarnings,
	};
}

export function selectAssembledBody(assembled: AssembledNote, includeSummaryBody: boolean): AssembledBodySelection {
	const parts: string[] = [];
	if (includeSummaryBody && assembled.body) {
		parts.push(assembled.body);
	}
	parts.push(...assembled.addonBlocks);

	const preservedUnmatchedBody = !includeSummaryBody && Boolean(assembled.body);
	if (preservedUnmatchedBody) {
		parts.push(assembled.body);
	}

	return {
		content: parts.join('\n\n'),
		warnings: preservedUnmatchedBody
			? ['Model output outside the requested AI add-on sections was preserved.']
			: [],
	};
}

function extractManualTldr(body: string, allowFirstParagraph: boolean): { tldr: string | null; body: string } {
	const lines = scanMarkdownLines(body);
	let headingIndex = -1;
	let headingLevel = 0;
	for (const [index, line] of lines.entries()) {
		const match = !line.insideFence ? line.text.match(/^(#{2,6})[ \t]+TL;DR[ \t]*$/i) : null;
		if (match) {
			headingIndex = index;
			headingLevel = match[1].length;
			break;
		}
	}
	if (headingIndex !== -1) {
		const end = findNextHeading(lines, headingIndex + 1, headingLevel);
		const tldr = lines.slice(headingIndex + 1, end).map((line) => line.text).join('\n').trim();
		if (tldr) {
			return removeLineRange(lines, headingIndex, end, tldr);
		}
	}

	const labelIndex = lines.findIndex((line) => (
		!line.insideFence && /^\*\*TL;DR:?\*\*/i.test(line.text)
	));
	if (labelIndex !== -1) {
		const inline = lines[labelIndex].text.replace(/^\*\*TL;DR:?\*\*[ \t]*/i, '');
		let contentStart = labelIndex + 1;
		if (!inline.trim()) {
			while (contentStart < lines.length && !lines[contentStart].text.trim()) {
				contentStart += 1;
			}
		}
		let end = contentStart;
		while (end < lines.length && lines[end].text.trim() && headingLevelOf(lines[end]) === null) {
			end += 1;
		}
		const tldr = [inline, ...lines.slice(contentStart, end).map((line) => line.text)]
			.join('\n')
			.trim();
		if (tldr) {
			return removeLineRange(lines, labelIndex, end, tldr);
		}
	}

	if (allowFirstParagraph) {
		const start = lines.findIndex((line) => line.text.trim().length > 0);
		if (
			start !== -1
			&& !lines[start].insideFence
			&& !/^#/.test(lines[start].text)
			&& !/^\*\*TL;DR:?\*\*/i.test(lines[start].text)
		) {
			let end = start;
			while (end < lines.length && lines[end].text.trim() && !lines[end].insideFence && !/^#/.test(lines[end].text)) {
				end += 1;
			}
			const tldr = lines.slice(start, end).map((line) => line.text).join('\n').trim();
			if (tldr) {
				return removeLineRange(lines, start, end, tldr);
			}
		}
	}

	return { tldr: null, body };
}

function findNextHeading(lines: ScannedMarkdownLine[], start: number, maximumLevel: number): number {
	const offset = lines.slice(start).findIndex((line) => {
		const level = headingLevelOf(line);
		return level !== null && level <= maximumLevel;
	});
	return offset === -1 ? lines.length : start + offset;
}

function headingLevelOf(line: ScannedMarkdownLine): number | null {
	if (line.insideFence) {
		return null;
	}
	return line.text.match(/^(#{1,6})(?:[ \t]+|$)/)?.[1].length ?? null;
}

function removeLineRange(
	lines: ScannedMarkdownLine[],
	start: number,
	end: number,
	tldr: string,
): { tldr: string; body: string } {
	const before = lines.slice(0, start).map((line) => line.text).join('\n').trimEnd();
	const after = lines.slice(end).map((line) => line.text).join('\n').trimStart();
	return { tldr, body: [before, after].filter(Boolean).join('\n\n') };
}

function selectDeclaredSections(
	template: Template,
	bodyPieces: Array<{ heading: string; body: string }>,
	warnings: string[],
): string[] {
	const sections = template.sections ?? [];
	const declaredByLower = new Map(sections.map((section) => [section.heading.toLowerCase(), section]));
	const matched = new Map<string, string>();
	const extras: Array<{ heading: string; body: string; warning: string }> = [];
	for (const piece of bodyPieces) {
		const exact = sections.find((section) => section.heading === piece.heading);
		const declared = exact ?? declaredByLower.get(piece.heading.toLowerCase());
		if (declared) {
			if (!piece.body.trim()) {
				continue;
			}
			if (matched.has(declared.id)) {
				extras.push({
					...piece,
					warning: `Preserved duplicate section "${declared.heading}" emitted by the model.`,
				});
			} else {
				matched.set(declared.id, piece.body);
			}
		} else {
			extras.push({
				...piece,
				warning: `Preserved undeclared section "${piece.heading}" emitted by the model.`,
			});
		}
	}

	const out: string[] = [];
	for (const section of sections) {
		const content = matched.get(section.id);
		if (content && content.trim().length > 0) {
			out.push(`## ${section.heading}\n${content.trim()}`);
		} else if (section.required) {
			warnings.push(`Required section "${section.heading}" was not emitted by the model.`);
		}
	}
	for (const extra of extras) {
		out.push(`## ${extra.heading}\n${extra.body.trim()}`);
		warnings.push(extra.warning);
	}
	return out;
}
