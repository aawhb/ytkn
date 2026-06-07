import type { GenerationOptions, PlaylistTranscriptResponse } from '../types';
import type { Template } from '../types';
import {
	buildTldrCallout,
	extractExplicitTldr,
	extractTldr,
	sanitizeModelOutput,
	shiftMarkdownHeadings,
} from './outputNormalizer';
import { buildBodyFromTemplate } from './templateOutput';
import { buildPlaylistFrontmatter } from './frontmatter';
import { buildPlaylistMediaEmbed } from './mediaSections';
import { buildPlaylistSourceSection } from './sourceSections';
import { buildPlaylistTranscriptDetails } from './transcripts';

interface RenderResult {
	content: string;
	warnings: string[];
}

export function renderPlaylistNote(
	playlist: PlaylistTranscriptResponse,
	thumbnailUrl: string | null,
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

	// Same as renderVideoNote: skip synthesized-from-paragraph fallback for
	// declared templates so a missing TL;DR remains visible as a warning.
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
		const frontmatterResult = buildPlaylistFrontmatter(playlist, options, template ?? null, extractedFrontmatter);
		if (frontmatterResult.content) {
			parts.push(frontmatterResult.content);
		}
		warnings.push(...frontmatterResult.warnings);
	}

	parts.push(`${mode === 'fragment' ? '##' : '#'} ${playlist.title}`);
	const mediaEmbed = buildPlaylistMediaEmbed(playlist, thumbnailUrl, options);
	if (mediaEmbed) {
		parts.push(mediaEmbed);
	}

	if (finalTldr) {
		parts.push(buildTldrCallout(finalTldr));
	}

	const sourcePosition = options?.sourceSectionPosition ?? 'bottom';
	const rawSourceSection = buildPlaylistSourceSection(playlist);
	const sourceSection = mode === 'fragment' ? shiftMarkdownHeadings(rawSourceSection, 1) : rawSourceSection;

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
		parts.push(buildPlaylistTranscriptDetails(playlist, options.transcriptMode, options));
	}

	return { content: parts.join('\n\n'), warnings };
}
