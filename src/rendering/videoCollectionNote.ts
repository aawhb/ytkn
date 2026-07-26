import type { GenerationOptions, VideoCollectionTranscriptResponse } from '../types';
import type { Template } from '../types';
import { buildTldrCallout, shiftMarkdownHeadings } from './outputNormalizer';
import { assembleNote, selectAssembledBody } from './noteAssembler';
import { buildCollectionFrontmatter } from './frontmatter';
import { buildCollectionMediaEmbed } from './mediaSections';
import { buildCollectionSourceSection } from './sourceSections';
import { buildCollectionTranscriptDetails } from './transcripts';

interface RenderResult {
	content: string;
	warnings: string[];
}

export function renderVideoCollectionNote(
	collection: VideoCollectionTranscriptResponse,
	thumbnailUrl: string | null,
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
		const frontmatterResult = buildCollectionFrontmatter(collection, options, template ?? null, assembled.frontmatter);
		if (frontmatterResult.content) {
			parts.push(frontmatterResult.content);
		}
		warnings.push(...frontmatterResult.warnings);
	}

	parts.push(`${mode === 'fragment' ? '##' : '#'} ${collection.title}`);
	const mediaEmbed = buildCollectionMediaEmbed(collection, thumbnailUrl, options);
	if (mediaEmbed) {
		parts.push(mediaEmbed);
	}

	if (assembled.tldr) {
		parts.push(buildTldrCallout(assembled.tldr));
	}

	const sourcePosition = options?.sourceSectionPosition ?? 'bottom';
	const rawSourceSection = buildCollectionSourceSection(collection);
	const sourceSection = mode === 'fragment' ? shiftMarkdownHeadings(rawSourceSection, 1) : rawSourceSection;

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
		parts.push(buildCollectionTranscriptDetails(collection, options.transcriptMode, options));
	}

	return { content: parts.join('\n\n'), warnings };
}
