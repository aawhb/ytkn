import { GenerationOptions, PlaylistTranscriptResponse, QueueBatchReport, TranscriptLine, TranscriptResponse } from '../types';
import type { Template } from '../types';
import {
	buildTldrCallout,
	extractTldr,
	sanitizeModelOutput,
	shiftMarkdownHeadings,
} from './output-normalizer';
import { extractTemplateOutput } from './templates/extract-template-output';
import { mergeFrontmatter } from './templates/frontmatter-merge';

interface RenderResult {
	content: string;
	warnings: string[];
}

function formatTimestamp(seconds: number): string {
	const totalSeconds = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const remainingSeconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
	}

	return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function escapeYamlString(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function quoteYamlValue(value: string): string {
	return `"${escapeYamlString(value)}"`;
}

function parseTagList(input: string | undefined): string[] {
	if (!input) {
		return [];
	}

	return input
		.split(/[\s,]+/)
		.map((tag) => tag.trim().replace(/^#+/, ''))
		.filter((tag) => tag.length > 0);
}

const KNOWN_ALLOWLIST_KEYS: ReadonlySet<string> = new Set([
	'title', 'aliases', 'source', 'channel', 'channelUrl',
	'videoUrl', 'playlistUrl', 'videoId', 'playlistId', 'generated', 'videoCount',
]);

function parseAllowlist(input: string | undefined): Set<string> {
	if (input === undefined) {
		return new Set(KNOWN_ALLOWLIST_KEYS);
	}
	const parts = input.split(/[\s,]+/).map((s) => s.trim()).filter((s) => s.length > 0);
	if (!parts.length) {
		return new Set<string>();
	}
	return new Set(parts.filter((s) => KNOWN_ALLOWLIST_KEYS.has(s)));
}

function buildBodyFromTemplate(
	rawSummary: string,
	template: Template,
): {
	body: string;
	tldr: string | null;
	extractedFrontmatter: Record<string, unknown>;
	warnings: string[];
} {
	const sanitized = sanitizeModelOutput(rawSummary);
	const extracted = extractTemplateOutput(sanitized, template);

	const tldrFromSection = extracted.sections.get('tldr')?.trim() ?? null;

	const orderedBody: string[] = [];
	for (const section of template.sections ?? []) {
		if (section.id === 'tldr') {
			continue;
		}
		const content = extracted.sections.get(section.id);
		if (content && content.trim().length > 0) {
			orderedBody.push(`## ${section.heading}\n${content.trim()}`);
		}
	}

	for (const extra of extracted.extras) {
		orderedBody.push(`## ${extra.heading}\n${extra.body}`);
	}

	return {
		body: orderedBody.join('\n\n'),
		tldr: tldrFromSection,
		extractedFrontmatter: extracted.frontmatter ?? {},
		warnings: extracted.warnings,
	};
}

function formatYamlEntry(key: string, value: unknown): string {
	if (value === null) {
		return `${key}: null`;
	}
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return `${key}: []`;
		}
		const items = value.map((v) => `  - ${quoteYamlValue(formatYamlScalar(v))}`);
		return `${key}:\n${items.join('\n')}`;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return `${key}: ${value}`;
	}
	return `${key}: ${quoteYamlValue(formatYamlScalar(value))}`;
}

function formatYamlScalar(value: unknown): string {
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
		return `${value}`;
	}
	return JSON.stringify(value) ?? '';
}

function buildVideoFrontmatter(
	transcript: TranscriptResponse,
	url: string,
	options: GenerationOptions | undefined,
	template: Template | null,
	extractedFrontmatter: Record<string, unknown>,
): { content: string | null; warnings: string[] } {
	if (!(options?.includeFrontmatter ?? true)) {
		return { content: null, warnings: [] };
	}

	const allowlist = parseAllowlist(options?.frontmatterPropertyAllowlist);
	const lines: string[] = ['---'];

	if (allowlist.has('title')) {
		lines.push(`title: ${quoteYamlValue(transcript.title)}`);
	}

	if (allowlist.has('aliases')) {
		lines.push('aliases:');
		lines.push(`  - ${quoteYamlValue(transcript.title)}`);
	}

	const globalTags = parseTagList(options?.frontmatterTags);
	const mergeResult = mergeFrontmatter({
		globalTags,
		templateTags: template?.tags ?? [],
		declared: template?.frontmatter ?? [],
		extracted: extractedFrontmatter,
	});

	const merged = mergeResult.merged;

	if (Array.isArray(merged.tags) && merged.tags.length > 0) {
		lines.push('tags:');
		for (const tag of merged.tags as string[]) {
			lines.push(`  - ${tag}`);
		}
	}

	if (allowlist.has('source')) {
		lines.push('source: youtube');
	}

	if (transcript.author && allowlist.has('channel')) {
		lines.push(`channel: ${quoteYamlValue(transcript.author)}`);
	}

	if (transcript.channelUrl && allowlist.has('channelUrl')) {
		lines.push(`channelUrl: ${quoteYamlValue(transcript.channelUrl)}`);
	}

	if (allowlist.has('videoUrl')) {
		lines.push(`videoUrl: ${quoteYamlValue(url)}`);
	}

	if (allowlist.has('videoId')) {
		lines.push(`videoId: ${quoteYamlValue(transcript.videoId)}`);
	}

	if (allowlist.has('generated')) {
		lines.push(`generated: ${new Date().toISOString()}`);
	}

	for (const [key, value] of Object.entries(merged)) {
		if (key === 'tags') {
			continue;
		}
		lines.push(formatYamlEntry(key, value));
	}

	lines.push('---');
	return { content: lines.join('\n'), warnings: mergeResult.warnings };
}

function buildPlaylistFrontmatter(
	playlist: PlaylistTranscriptResponse,
	options: GenerationOptions | undefined,
	template: Template | null,
	extractedFrontmatter: Record<string, unknown>,
): { content: string | null; warnings: string[] } {
	if (!(options?.includeFrontmatter ?? true)) {
		return { content: null, warnings: [] };
	}

	const allowlist = parseAllowlist(options?.frontmatterPropertyAllowlist);
	const lines: string[] = ['---'];

	if (allowlist.has('title')) {
		lines.push(`title: ${quoteYamlValue(playlist.title)}`);
	}

	if (allowlist.has('aliases')) {
		lines.push('aliases:');
		lines.push(`  - ${quoteYamlValue(playlist.title)}`);
	}

	const globalTags = parseTagList(options?.frontmatterTags);
	const mergeResult = mergeFrontmatter({
		globalTags,
		templateTags: template?.tags ?? [],
		declared: template?.frontmatter ?? [],
		extracted: extractedFrontmatter,
	});

	const merged = mergeResult.merged;

	if (Array.isArray(merged.tags) && merged.tags.length > 0) {
		lines.push('tags:');
		for (const tag of merged.tags as string[]) {
			lines.push(`  - ${tag}`);
		}
	}

	if (allowlist.has('source')) {
		lines.push('source: youtube-playlist');
	}

	if (allowlist.has('videoCount')) {
		lines.push(`videoCount: ${playlist.transcripts.length}`);
	}

	if (allowlist.has('playlistUrl')) {
		lines.push(`playlistUrl: ${quoteYamlValue(playlist.url)}`);
	}

	if (allowlist.has('playlistId')) {
		lines.push(`playlistId: ${quoteYamlValue(playlist.playlistId)}`);
	}

	if (allowlist.has('generated')) {
		lines.push(`generated: ${new Date().toISOString()}`);
	}

	for (const [key, value] of Object.entries(merged)) {
		if (key === 'tags') {
			continue;
		}
		lines.push(formatYamlEntry(key, value));
	}

	lines.push('---');
	return { content: lines.join('\n'), warnings: mergeResult.warnings };
}

function buildVideoSourceSection(transcript: TranscriptResponse, url: string): string {
	return `> [!info] Source Info\n> - **Title:** ${transcript.title}\n> - **Channel:** [${transcript.author}](${transcript.channelUrl})\n> - **URL:** ${url}`;
}

function buildHeader(transcript: TranscriptResponse, thumbnailUrl: string, options?: GenerationOptions, headingLevel = 1): string[] {
	const prefix = '#'.repeat(headingLevel);
	const header = [`${prefix} ${transcript.title}`];

	if (options?.includeThumbnail ?? true) {
		header.push(`![Thumbnail](${thumbnailUrl})`);
	}

	return header;
}

function buildTranscriptParagraphs(lines: TranscriptLine[]): Array<{ offset: number; text: string }> {
	const paragraphs: Array<{ offset: number; text: string }> = [];
	let currentLines: string[] = [];
	let currentOffset = 0;
	let previousLine: TranscriptLine | null = null;

	for (const line of lines) {
		const text = line.text.trim();
		if (!text) {
			continue;
		}

		if (!currentLines.length) {
			currentOffset = line.offset;
		}

		currentLines.push(text);
		const endsParagraph = /[.!?]$/.test(text) || (previousLine ? line.offset - previousLine.offset >= 8 : false) || currentLines.length >= 3;

		if (endsParagraph) {
			paragraphs.push({ offset: currentOffset, text: currentLines.join(' ') });
			currentLines = [];
		}

		previousLine = line;
	}

	if (currentLines.length) {
		paragraphs.push({ offset: currentOffset, text: currentLines.join(' ') });
	}

	return paragraphs;
}

function buildTimestampDisplay(
	offsetMs: number,
	videoId: string | null,
	linkTimestamps: boolean,
): string {
	const seconds = Math.floor(offsetMs / 1000);
	const display = `[${formatTimestamp(seconds)}]`;

	if (!linkTimestamps || !videoId) {
		return `**${display}**`;
	}

	return `**[${formatTimestamp(seconds)}](https://youtu.be/${videoId}?t=${seconds}s)**`;
}

function buildTranscriptBody(
	transcript: TranscriptResponse,
	transcriptMode: GenerationOptions['transcriptMode'],
	options: GenerationOptions | undefined,
): string {
	if (transcriptMode === 'raw') {
		return `\`\`\`text
${transcript.lines.map((line) => line.text).join(' ')}
\`\`\``;
	}

	const paragraphs = buildTranscriptParagraphs(transcript.lines);
	if (transcriptMode === 'timestamped') {
		const linkTimestamps = options?.linkTimestamps ?? false;
		return paragraphs
			.map((paragraph) => `${buildTimestampDisplay(paragraph.offset, transcript.videoId, linkTimestamps)} ${paragraph.text}`)
			.join('\n\n');
	}

	return paragraphs.map((paragraph) => paragraph.text).join('\n\n');
}

function buildTranscriptDetails(
	transcript: TranscriptResponse,
	transcriptMode: GenerationOptions['transcriptMode'],
	options: GenerationOptions | undefined,
): string {
	return `<details>
<summary>Transcript</summary>

${buildTranscriptBody(transcript, transcriptMode, options)}

</details>`;
}

function buildPlaylistSourceSection(playlist: PlaylistTranscriptResponse): string {
	const videoLines = playlist.transcripts
		.map((transcript, index) => `${index + 1}. [${transcript.title}](${transcript.url}) - ${transcript.author}`)
		.join('\n');

	return `## Source
- Playlist: [${playlist.title}](${playlist.url})
- Video count: ${playlist.transcripts.length}

### Videos
${videoLines}`;
}

function buildPlaylistTranscriptDetails(
	playlist: PlaylistTranscriptResponse,
	transcriptMode: GenerationOptions['transcriptMode'],
	options: GenerationOptions | undefined,
): string {
	const sections = playlist.transcripts.map((transcript, index) => `### ${index + 1}. ${transcript.title}

${buildTranscriptBody(transcript, transcriptMode, options)}`);

	return `<details>
<summary>Playlist transcripts</summary>

${sections.join('\n\n')}

</details>`;
}

function formatRunReportOutcomeLabel(outcome: string): string {
	return outcome.charAt(0).toUpperCase() + outcome.slice(1);
}

export function renderQueueBatchReport(report: QueueBatchReport): string {
	const entries = report.entries;
	const total = entries.length;
	const completed = entries.filter((e) => e.outcome === 'completed').length;
	const skipped = entries.filter((e) => e.outcome === 'skipped').length;
	const failed = entries.filter((e) => e.outcome === 'failed').length;
	const canceled = entries.filter((e) => e.outcome === 'canceled').length;

	const lines = entries.map((entry, idx) => {
		const n = idx + 1;
		const label = formatRunReportOutcomeLabel(entry.outcome);

		if (entry.kind === 'video') {
			const parts = [`${n}. #${entry.ordinal} · ${entry.displayTitle} [${label}]`];
			if (entry.transcriptLanguageCode) parts.push(`language=${entry.transcriptLanguageCode}`);
			if (entry.notePath) parts.push(`note=${entry.notePath}`);
			if (entry.reason) parts.push(`reason=${entry.reason}`);
			const subLines = [parts.join(' | ')];
			if (entry.warnings && entry.warnings.length > 0) {
				entry.warnings.forEach((w) => subLines.push(`   - ${w}`));
			}
			return subLines.join('\n');
		}

		// playlist
		const parts = [`${n}. #${entry.ordinal} · ${entry.displayTitle} [${label}]`];
		if (entry.notePath) parts.push(`note=${entry.notePath}`);
		const subLines = [parts.join(' | ')];
		entry.entries.forEach((pe, pi) => {
			const peLabel = formatRunReportOutcomeLabel(pe.outcome);
			const peParts = [`   - ${pi + 1}. ${pe.title} [${peLabel}]`];
			if (pe.transcriptLanguageCode) peParts.push(`language=${pe.transcriptLanguageCode}`);
			if (pe.notePath) peParts.push(`note=${pe.notePath}`);
			if (pe.reason) peParts.push(`reason=${pe.reason}`);
			subLines.push(peParts.join(' | '));
			if (pe.warnings && pe.warnings.length > 0) {
				pe.warnings.forEach((w) => subLines.push(`     - ${w}`));
			}
		});
		return subLines.join('\n');
	});

	return `<details>
<summary>Run Report</summary>

## Run Report
- Total runs: ${total}
- Completed: ${completed}
- Skipped: ${skipped}
- Failed: ${failed}
- Canceled: ${canceled}

${lines.join('\n')}

</details>`;
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

	if (hasDeclaredSections && template) {
		const built = buildBodyFromTemplate(summaryText ?? '', template);
		body = built.body;
		tldrCandidate = built.tldr;
		extractedFrontmatter = built.extractedFrontmatter;
		warnings.push(...built.warnings);
	} else {
		body = sanitizeModelOutput(summaryText);
	}

	const tldrAtTop = options?.tldrCalloutAtTop ?? true;
	let finalBody = body;
	let finalTldr: string | null = tldrCandidate;

	// Fallback to extractTldr() ONLY for legacy/manual paths.
	// Declared templates rely solely on the declared `tldr` section — if missing,
	// the warning emitted during extraction is the signal; do not synthesize a
	// callout from an arbitrary first paragraph.
	if (tldrAtTop && !finalTldr && !hasDeclaredSections) {
		const fallback = extractTldr(body);
		finalTldr = fallback.tldr;
		finalBody = fallback.body;
	} else if (!tldrAtTop) {
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

	parts.push(...buildHeader(transcript, thumbnailUrl, options, mode === 'fragment' ? 2 : 1));

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

	if (hasDeclaredSections && template) {
		const built = buildBodyFromTemplate(summaryText ?? '', template);
		body = built.body;
		tldrCandidate = built.tldr;
		extractedFrontmatter = built.extractedFrontmatter;
		warnings.push(...built.warnings);
	} else {
		body = sanitizeModelOutput(summaryText);
	}

	const tldrAtTop = options?.tldrCalloutAtTop ?? true;
	let finalBody = body;
	let finalTldr: string | null = tldrCandidate;

	// Same as renderVideoNote: skip the synthesized-from-paragraph fallback
	// for declared templates so a missing TL;DR section is surfaced as a
	// warning rather than masked by the first body paragraph.
	if (tldrAtTop && !finalTldr && !hasDeclaredSections) {
		const fallback = extractTldr(body);
		finalTldr = fallback.tldr;
		finalBody = fallback.body;
	} else if (!tldrAtTop) {
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

	if ((options?.includeThumbnail ?? true) && thumbnailUrl) {
		parts.push(`![Thumbnail](${thumbnailUrl})`);
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
