import type { GenerationOptions, TranscriptResponse } from '../types';
import type { Template } from '../types';
import { buildTldrCallout, shiftMarkdownHeadings } from './outputNormalizer';
import { assembleNote, selectAssembledBody } from './noteAssembler';
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

	const tldrAtTop = options?.tldrCalloutAtTop ?? true;
	const generateSummary = options?.generateAiSummary ?? true;

	const assembled = assembleNote(summaryText, template ?? null, {
		includeTldr: tldrAtTop,
		includeMindmap: options?.includeMindmap ?? false,
		includeMemorableQuotes: options?.includeMemorableQuotes ?? false,
	});
	warnings.push(...assembled.warnings);

	const selectedBody = selectAssembledBody(assembled, generateSummary);
	warnings.push(...selectedBody.warnings);
	let finalContent = selectedBody.content;
	if (mode === 'fragment') {
		finalContent = shiftMarkdownHeadings(finalContent, 1);
	}

	if (mode !== 'fragment') {
		const frontmatterResult = buildVideoFrontmatter(transcript, url, options, template ?? null, assembled.frontmatter);
		if (frontmatterResult.content) {
			parts.push(frontmatterResult.content);
		}
		warnings.push(...frontmatterResult.warnings);
	}

	parts.push(...buildVideoHeader(transcript, thumbnailUrl, url, options, mode === 'fragment' ? 2 : 1));

	if (assembled.tldr) {
		parts.push(buildTldrCallout(assembled.tldr));
	}

	const sourcePosition = options?.sourceSectionPosition ?? 'bottom';
	const sourceSection = buildVideoSourceSection(transcript, url);

	if (sourcePosition === 'top') {
		parts.push(sourceSection);
	}

	if (finalContent) {
		parts.push(finalContent);
	}

	if (sourcePosition === 'bottom') {
		parts.push(sourceSection);
	}

	if (options?.transcriptMode && options.transcriptMode !== 'none') {
		parts.push(buildTranscriptDetails(transcript, options.transcriptMode, options));
	}

	return { content: parts.filter(Boolean).join('\n\n'), warnings };
}
