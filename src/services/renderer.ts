import { GenerationOptions, MediaEmbedMode, PlaylistTranscriptResponse, QueueBatchReport, TranscriptLine, TranscriptResponse } from '../types';
import type { Template } from '../types';
import { DEFAULT_FRONTMATTER_PROPERTY_ALLOWLIST, DEFAULT_MEDIA_EMBED_MODE } from '../defaults';
import {
	buildTldrCallout,
	extractTldr,
	sanitizeModelOutput,
	shiftMarkdownHeadings,
} from './outputNormalizer';
import { extractTemplateOutput } from './templates/extractTemplateOutput';
import { mergeFrontmatter } from './templates/frontmatterMerge';

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
	'title', 'aliases', 'source', 'channel', 'channelUrl', 'channelId',
	'videoUrl', 'playlistUrl', 'videoId', 'playlistId', 'thumbnailUrl',
	'videoDescription', 'durationSeconds', 'keywords', 'generated', 'videoCount',
]);
const DEFAULT_ALLOWLIST_KEYS: ReadonlySet<string> = new Set(DEFAULT_FRONTMATTER_PROPERTY_ALLOWLIST.split(/\s+/));

function parseAllowlist(input: string | undefined): Set<string> {
	if (input === undefined) {
		return new Set(DEFAULT_ALLOWLIST_KEYS);
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

	if (transcript.channelId && allowlist.has('channelId')) {
		lines.push(`channelId: ${quoteYamlValue(transcript.channelId)}`);
	}

	if (allowlist.has('videoUrl')) {
		lines.push(`videoUrl: ${quoteYamlValue(url)}`);
	}

	if (allowlist.has('videoId')) {
		lines.push(`videoId: ${quoteYamlValue(transcript.videoId)}`);
	}

	if (transcript.thumbnailUrl && allowlist.has('thumbnailUrl')) {
		lines.push(`thumbnailUrl: ${quoteYamlValue(transcript.thumbnailUrl)}`);
	}

	if (transcript.description && allowlist.has('videoDescription')) {
		lines.push(`videoDescription: ${quoteYamlValue(transcript.description)}`);
	}

	if (typeof transcript.durationSeconds === 'number' && Number.isFinite(transcript.durationSeconds) && allowlist.has('durationSeconds')) {
		lines.push(`durationSeconds: ${transcript.durationSeconds}`);
	}

	if (Array.isArray(transcript.keywords) && transcript.keywords.length > 0 && allowlist.has('keywords')) {
		lines.push(formatYamlEntry('keywords', transcript.keywords));
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
		const videoCount = playlist.transcripts.length > 0 ? playlist.transcripts.length : playlist.entries.length;
		lines.push(`videoCount: ${videoCount}`);
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

function escapeMarkdownAltText(value: string): string {
	return value
		.replace(/\s+/g, ' ')
		.replace(/\\/g, '\\\\')
		.replace(/\]/g, '\\]')
		.trim();
}

function resolveMediaEmbedMode(options?: GenerationOptions): MediaEmbedMode {
	return options?.mediaEmbedMode ?? DEFAULT_MEDIA_EMBED_MODE;
}

function buildMediaEmbed(
	title: string,
	url: string,
	thumbnailUrl: string | null,
	options?: GenerationOptions,
): string | null {
	const mediaEmbedMode = resolveMediaEmbedMode(options);

	if (mediaEmbedMode === 'none') {
		return null;
	}

	if (mediaEmbedMode === 'thumbnail') {
		return thumbnailUrl ? `![Thumbnail](${thumbnailUrl})` : null;
	}

	return `![${escapeMarkdownAltText(title)}](${url})`;
}

function buildHeader(transcript: TranscriptResponse, thumbnailUrl: string, url: string, options?: GenerationOptions, headingLevel = 1): string[] {
	const prefix = '#'.repeat(headingLevel);
	const header = [`${prefix} ${transcript.title}`];
	const mediaEmbed = buildMediaEmbed(transcript.title, url, thumbnailUrl, options);

	if (mediaEmbed) {
		header.push(mediaEmbed);
	}

	return header;
}

const TRANSCRIPT_PARAGRAPH_GAP_MS = 8000;
const TRANSCRIPT_TARGET_PARAGRAPH_CHARS = 700;
const TRANSCRIPT_MAX_PARAGRAPH_CHARS = 1800;
const TRANSCRIPT_MAX_SENTENCES_PER_PARAGRAPH = 4;
const TRANSCRIPT_SENTENCE_PARAGRAPH_MIN_CHARS = 320;

function normalizeTranscriptText(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

function endsSentence(text: string): boolean {
	return /[.!?]["')\]]*$/.test(text);
}

function splitTranscriptTextIntoChunks(text: string): string[] {
	const matches = text.match(/.+?(?:[.!?]["')\]]*(?=\s|$)|$)/g) ?? [];
	const chunks = matches
		.map((chunk) => normalizeTranscriptText(chunk))
		.filter((chunk) => chunk.length > 0);

	return chunks.length ? chunks : [text];
}

function joinTranscriptParts(parts: string[]): string {
	return parts.join(' ');
}

function renderCollapsedCallout(type: string, title: string, body: string): string {
	return [
		`> [!${type}]- ${title}`,
		...body.split('\n').map((line) => line ? `> ${line}` : '>'),
	].join('\n');
}

function buildTranscriptParagraphs(lines: TranscriptLine[]): Array<{ offset: number; text: string }> {
	const paragraphs: Array<{ offset: number; text: string }> = [];
	let currentParts: string[] = [];
	let currentOffset = 0;
	let previousOffset: number | null = null;
	let sentenceCount = 0;

	const flush = () => {
		if (!currentParts.length) {
			return;
		}

		paragraphs.push({
			offset: currentOffset,
			text: joinTranscriptParts(currentParts),
		});
		currentParts = [];
		sentenceCount = 0;
	};

	for (const line of lines) {
		const text = normalizeTranscriptText(line.text);
		if (!text) {
			continue;
		}

		for (const chunk of splitTranscriptTextIntoChunks(text)) {
			const gapFromPrevious = previousOffset === null ? 0 : line.offset - previousOffset;
			if (currentParts.length && gapFromPrevious >= TRANSCRIPT_PARAGRAPH_GAP_MS) {
				flush();
			}

			if (!currentParts.length) {
				currentOffset = line.offset;
			}

			currentParts.push(chunk);

			const endedAtSentenceBoundary = endsSentence(chunk);
			if (endedAtSentenceBoundary) {
				sentenceCount += 1;
			}

			const currentTextLength = joinTranscriptParts(currentParts).length;
			const reachedSentenceLimit = endedAtSentenceBoundary
				&& sentenceCount >= TRANSCRIPT_MAX_SENTENCES_PER_PARAGRAPH
				&& currentTextLength >= TRANSCRIPT_SENTENCE_PARAGRAPH_MIN_CHARS;
			const reachedTargetLength = endedAtSentenceBoundary
				&& currentTextLength >= TRANSCRIPT_TARGET_PARAGRAPH_CHARS;
			const reachedSafetyLimit = currentTextLength >= TRANSCRIPT_MAX_PARAGRAPH_CHARS;

			if (reachedSentenceLimit || reachedTargetLength || reachedSafetyLimit) {
				flush();
			}

			previousOffset = line.offset;
		}
	}

	flush();

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
	return renderCollapsedCallout('note', 'Transcript', buildTranscriptBody(transcript, transcriptMode, options));
}

function buildPlaylistSourceSection(playlist: PlaylistTranscriptResponse): string {
	const videoItems = playlist.transcripts.length > 0
		? playlist.transcripts.map((transcript) => ({
			title: transcript.title,
			url: transcript.url,
			author: transcript.author,
		}))
		: playlist.entries.map((entry) => ({
			title: entry.title,
			url: entry.url,
			author: null,
		}));
	const videoLines = videoItems
		.map((item, index) => {
			const authorSuffix = item.author ? ` - ${item.author}` : '';
			return `${index + 1}. [${item.title}](${item.url})${authorSuffix}`;
		})
		.join('\n');
	const videoCount = videoItems.length;

	return `## Source
- Playlist: [${playlist.title}](${playlist.url})
- Video count: ${videoCount}

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

	return renderCollapsedCallout('note', 'Playlist transcripts', sections.join('\n\n'));
}

function formatRunReportOutcomeLabel(outcome: string): string {
	return outcome.charAt(0).toUpperCase() + outcome.slice(1);
}

function normalizeReportInline(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function stripRunOrdinalPrefix(displayTitle: string, ordinal: number): string {
	const prefix = `#${ordinal} · `;
	return displayTitle.startsWith(prefix) ? displayTitle.slice(prefix.length) : displayTitle;
}

function formatReportNotePath(notePath: string): string {
	return `\`${normalizeReportInline(notePath)}\``;
}

function renderCollapsedRunReportCallout(body: string): string {
	return renderCollapsedCallout('summary', 'Run Report', body);
}

function buildRunReportSummary(total: number, completed: number, skipped: number, failed: number, canceled: number): string {
	return [
		'**Summary**',
		'',
		`- Total: ${total}`,
		`- Completed: ${completed}`,
		`- Skipped: ${skipped}`,
		`- Failed: ${failed}`,
		`- Canceled: ${canceled}`,
	].join('\n');
}

interface RunReportCounts {
	total: number;
	completed: number;
	skipped: number;
	failed: number;
	canceled: number;
}

function emptyRunReportCounts(): RunReportCounts {
	return { total: 0, completed: 0, skipped: 0, failed: 0, canceled: 0 };
}

function addOutcomeToCounts(counts: RunReportCounts, outcome: string): void {
	counts.total += 1;
	if (outcome === 'completed') counts.completed += 1;
	if (outcome === 'skipped') counts.skipped += 1;
	if (outcome === 'failed') counts.failed += 1;
	if (outcome === 'canceled') counts.canceled += 1;
}

function countPlaylistRunReportEntry(entry: Extract<QueueBatchReport['entries'][number], { kind: 'playlist' }>): RunReportCounts {
	const counts = emptyRunReportCounts();
	if (entry.entries.length === 0) {
		addOutcomeToCounts(counts, entry.outcome);
		return counts;
	}
	for (const playlistEntry of entry.entries) {
		addOutcomeToCounts(counts, playlistEntry.outcome);
	}
	return counts;
}

function countQueueBatchReportEntries(entries: QueueBatchReport['entries']): RunReportCounts {
	const counts = emptyRunReportCounts();
	for (const entry of entries) {
		if (entry.kind === 'video') {
			addOutcomeToCounts(counts, entry.outcome);
			continue;
		}
		const playlistCounts = countPlaylistRunReportEntry(entry);
		counts.total += playlistCounts.total;
		counts.completed += playlistCounts.completed;
		counts.skipped += playlistCounts.skipped;
		counts.failed += playlistCounts.failed;
		counts.canceled += playlistCounts.canceled;
	}
	return counts;
}

function formatRunReportCounts(counts: RunReportCounts): string {
	return `${counts.total} total, ${counts.completed} completed, ${counts.skipped} skipped, ${counts.failed} failed, ${counts.canceled} canceled`;
}

function appendRunReportWarnings(lines: string[], warnings: string[] | undefined, indent: string): void {
	if (!warnings || warnings.length === 0) {
		return;
	}

	lines.push(`${indent}- Warnings:`);
	for (const warning of warnings) {
		lines.push(`${indent}  - ${normalizeReportInline(warning)}`);
	}
}

function buildVideoRunReportEntry(entry: Extract<QueueBatchReport['entries'][number], { kind: 'video' }>, index: number): string {
	const label = formatRunReportOutcomeLabel(entry.outcome);
	const title = stripRunOrdinalPrefix(entry.displayTitle, entry.ordinal);
	const lines = [`${index + 1}. **${label}** · ${normalizeReportInline(title)}`];

	lines.push(`   - Run: #${entry.ordinal}`);
	if (entry.transcriptLanguageCode) {
		lines.push(`   - Language: \`${entry.transcriptLanguageCode}\``);
	}
	if (entry.notePath) {
		lines.push(`   - Note: ${formatReportNotePath(entry.notePath)}`);
	}
	if (entry.reason) {
		lines.push(`   - Reason: ${normalizeReportInline(entry.reason)}`);
	}
	appendRunReportWarnings(lines, entry.warnings, '   ');

	return lines.join('\n');
}

function buildPlaylistRunReportEntry(entry: Extract<QueueBatchReport['entries'][number], { kind: 'playlist' }>, index: number): string {
	const label = formatRunReportOutcomeLabel(entry.outcome);
	const title = normalizeReportInline(entry.playlistTitle || stripRunOrdinalPrefix(entry.displayTitle, entry.ordinal));
	const lines = [`${index + 1}. **${label}** · ${title}`];

	lines.push(`   - Run: #${entry.ordinal}`);
	if (entry.notePath) {
		lines.push(`   - Note: ${formatReportNotePath(entry.notePath)}`);
	}
	if (entry.reason) {
		lines.push(`   - Reason: ${normalizeReportInline(entry.reason)}`);
	}
	appendRunReportWarnings(lines, entry.warnings, '   ');
	lines.push(`   - Counts: ${formatRunReportCounts(countPlaylistRunReportEntry(entry))}`);
	if (entry.entries.length > 0) {
		lines.push('   - Videos:');
		entry.entries.forEach((playlistEntry, playlistIndex) => {
			const playlistEntryLabel = formatRunReportOutcomeLabel(playlistEntry.outcome);
			lines.push(`      ${playlistIndex + 1}. **${playlistEntryLabel}** · ${normalizeReportInline(playlistEntry.title)}`);
			if (playlistEntry.transcriptLanguageCode) {
				lines.push(`         - Language: \`${playlistEntry.transcriptLanguageCode}\``);
			}
			if (playlistEntry.notePath) {
				lines.push(`         - Note: ${formatReportNotePath(playlistEntry.notePath)}`);
			}
			if (playlistEntry.reason) {
				lines.push(`         - Reason: ${normalizeReportInline(playlistEntry.reason)}`);
			}
			appendRunReportWarnings(lines, playlistEntry.warnings, '         ');
		});
	}

	return lines.join('\n');
}

export function renderQueueBatchReport(report: QueueBatchReport): string {
	const entries = report.entries;
	const counts = countQueueBatchReportEntries(entries);
	const summary = buildRunReportSummary(counts.total, counts.completed, counts.skipped, counts.failed, counts.canceled);
	const runLines = entries.length
		? entries.map((entry, index) => entry.kind === 'video'
			? buildVideoRunReportEntry(entry, index)
			: buildPlaylistRunReportEntry(entry, index)).join('\n\n')
		: 'No runs recorded.';

	return renderCollapsedRunReportCallout(`${summary}

**Runs**

${runLines}`);
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

	parts.push(...buildHeader(transcript, thumbnailUrl, url, options, mode === 'fragment' ? 2 : 1));

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
	const mediaEmbed = buildMediaEmbed(playlist.title, playlist.url, thumbnailUrl, options);
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
