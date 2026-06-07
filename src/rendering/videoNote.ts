import type { GenerationOptions, TranscriptResponse } from '../types';
import type { Template } from '../types';
import {
	buildTldrCallout,
	extractExplicitTldr,
	extractTldr,
	sanitizeModelOutput,
	shiftMarkdownHeadings,
} from './outputNormalizer';
import { buildBodyFromTemplate } from './templateOutput';
import { buildVideoFrontmatter } from './frontmatter';
import { buildVideoHeader } from './mediaSections';
import { buildVideoSourceSection } from './sourceSections';
import { buildTranscriptDetails } from './transcripts';

interface RenderResult {
	content: string;
	warnings: string[];
}

export function renderVideoNote(
	transcript: TranscriptResponse,
	thumbnailUrl: string,
	url: string,
	summaryText?: string | null,
	options?: GenerationOptions,
	template?: Template | null,
	mode: 'standalone' | 'fragment' = 'standalone',
): RenderResult {
	const parts: string[] = [];
	const warnings: string[] = [];

	const hasDeclaredSections = (template?.sections?.length ?? 0) > 0;

	let body: string;
	let tldrCandidate: string | null = null;
	let extractedFrontmatter: Record<string, unknown> = {};

	const tldrAtTop = options?.tldrCalloutAtTop ?? true;

	if (hasDeclaredSections && template) {
		const built = buildBodyFromTemplate(summaryText ?? '', template, tldrAtTop);
		body = built.body;
		tldrCandidate = built.tldr;
		extractedFrontmatter = built.extractedFrontmatter;
		warnings.push(...built.warnings);
	} else {
		body = sanitizeModelOutput(summaryText);
	}

	let finalBody = body;
	let finalTldr: string | null = tldrCandidate;

	// Fallback to extractTldr() ONLY for legacy/manual paths.
	// Declared templates rely solely on the declared `tldr` section: if missing,
	// the extraction warning is the signal rather than an arbitrary first paragraph.
	if (tldrAtTop && !finalTldr && !hasDeclaredSections) {
		const fallback = extractTldr(body);
		finalTldr = fallback.tldr;
		finalBody = fallback.body;
	} else if (!tldrAtTop) {
		if (!hasDeclaredSections) {
			finalBody = extractExplicitTldr(body).body;
		}
		finalTldr = null;
	}

	if (mode === 'fragment') {
		finalBody = shiftMarkdownHeadings(finalBody, 1);
	}

	if (mode !== 'fragment') {
		const frontmatterResult = buildVideoFrontmatter(transcript, url, options, template ?? null, extractedFrontmatter);
		if (frontmatterResult.content) {
			parts.push(frontmatterResult.content);
		}
		warnings.push(...frontmatterResult.warnings);
	}

	parts.push(...buildVideoHeader(transcript, thumbnailUrl, url, options, mode === 'fragment' ? 2 : 1));

	if (finalTldr) {
		parts.push(buildTldrCallout(finalTldr));
	}

	const sourcePosition = options?.sourceSectionPosition ?? 'bottom';
	const sourceSection = buildVideoSourceSection(transcript, url);

	if (sourcePosition === 'top') {
		parts.push(sourceSection);
	}

	if (finalBody) {
		parts.push(finalBody);
	}

	if (sourcePosition === 'bottom') {
		parts.push(sourceSection);
	}

	if (options?.transcriptMode && options.transcriptMode !== 'none') {
		parts.push(buildTranscriptDetails(transcript, options.transcriptMode, options));
	}

	return { content: parts.filter(Boolean).join('\n\n'), warnings };
}
