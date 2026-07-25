import type { BatchReport, QueueRunOutcome } from '../types';
import { normalizeWhitespace } from '../utils';
import { renderCollapsedCallout } from './callouts';

function formatReportOutcomeLabel(outcome: QueueRunOutcome): string {
	return outcome.charAt(0).toUpperCase() + outcome.slice(1);
}

function stripRunOrdinalPrefix(displayTitle: string, ordinal: number): string {
	const prefix = `#${ordinal} · `;
	return displayTitle.startsWith(prefix) ? displayTitle.slice(prefix.length) : displayTitle;
}

function formatReportNotePath(notePath: string): string {
	return `\`${normalizeWhitespace(notePath)}\``;
}

function renderCollapsedReportCallout(body: string): string {
	return renderCollapsedCallout('summary', 'Report', body);
}

function buildReportSummary(total: number, completed: number, skipped: number, failed: number, canceled: number): string {
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

type ReportCounts = Record<QueueRunOutcome, number> & { total: number };

function emptyReportCounts(): ReportCounts {
	return { total: 0, completed: 0, skipped: 0, failed: 0, canceled: 0 };
}

function addOutcomeToCounts(counts: ReportCounts, outcome: QueueRunOutcome): void {
	counts.total += 1;
	counts[outcome] += 1;
}

type CollectionReportEntry = Exclude<BatchReport['entries'][number], { kind: 'video' }>;

function countPlaylistReportEntry(entry: CollectionReportEntry): ReportCounts {
	const counts = emptyReportCounts();
	addReportEntryToCounts(counts, entry);
	return counts;
}

function addReportEntryToCounts(counts: ReportCounts, entry: BatchReport['entries'][number]): void {
	if (entry.kind !== 'video' && entry.entries.length > 0) {
		for (const playlistEntry of entry.entries) {
			addOutcomeToCounts(counts, playlistEntry.outcome);
		}
		return;
	}

	addOutcomeToCounts(counts, entry.outcome);
}

function countBatchReportEntries(entries: BatchReport['entries']): ReportCounts {
	const counts = emptyReportCounts();
	for (const entry of entries) {
		addReportEntryToCounts(counts, entry);
	}
	return counts;
}

function formatReportCounts(counts: ReportCounts): string {
	return `${counts.total} total, ${counts.completed} completed, ${counts.skipped} skipped, ${counts.failed} failed, ${counts.canceled} canceled`;
}

function appendReportWarnings(lines: string[], warnings: string[] | undefined, indent: string): void {
	if (!warnings || warnings.length === 0) {
		return;
	}

	lines.push(`${indent}- Warnings:`);
	for (const warning of warnings) {
		lines.push(`${indent}  - ${normalizeWhitespace(warning)}`);
	}
}

function formatContentType(contentType: 'videos' | 'shorts' | 'streams'): string {
	if (contentType === 'shorts') return 'Short';
	if (contentType === 'streams') return 'Stream replay';
	return 'Video';
}

function buildVideoReportEntry(entry: Extract<BatchReport['entries'][number], { kind: 'video' }>, index: number): string {
	const label = formatReportOutcomeLabel(entry.outcome);
	const title = stripRunOrdinalPrefix(entry.displayTitle, entry.ordinal);
	const lines = [`${index + 1}. **${label}** · ${normalizeWhitespace(title)}`];

	lines.push(`   - Run: #${entry.ordinal}`);
	if (entry.contentType === 'shorts') {
		lines.push('   - Content: Short');
	}
	if (entry.transcriptLanguageCode) {
		lines.push(`   - Language: \`${entry.transcriptLanguageCode}\``);
	}
	if (entry.notePath) {
		lines.push(`   - Note: ${formatReportNotePath(entry.notePath)}`);
	}
	if (entry.reason) {
		lines.push(`   - Reason: ${normalizeWhitespace(entry.reason)}`);
	}
	appendReportWarnings(lines, entry.warnings, '   ');

	return lines.join('\n');
}

function buildPlaylistReportEntry(entry: CollectionReportEntry, index: number): string {
	const label = formatReportOutcomeLabel(entry.outcome);
	const title = normalizeWhitespace(
		(entry.kind === 'channel' ? entry.channelTitle : entry.playlistTitle)
		|| stripRunOrdinalPrefix(entry.displayTitle, entry.ordinal),
	);
	const lines = [`${index + 1}. **${label}** · ${title}`];

	lines.push(`   - Run: #${entry.ordinal}`);
	if (entry.notePath) {
		lines.push(`   - Note: ${formatReportNotePath(entry.notePath)}`);
	}
	if (entry.reason) {
		lines.push(`   - Reason: ${normalizeWhitespace(entry.reason)}`);
	}
	appendReportWarnings(lines, entry.warnings, '   ');
	if (entry.kind === 'channel' && entry.contentTypes.length > 0) {
		lines.push(`   - Content: ${entry.contentTypes.map((type) => type === 'streams' ? 'Streams' : `${type[0].toUpperCase()}${type.slice(1)}`).join(', ')}`);
	}
	lines.push(`   - Counts: ${formatReportCounts(countPlaylistReportEntry(entry))}`);
	if (entry.entries.length > 0) {
		lines.push(entry.kind === 'channel' ? '   - Items:' : '   - Videos:');
		entry.entries.forEach((playlistEntry, playlistIndex) => {
			const playlistEntryLabel = formatReportOutcomeLabel(playlistEntry.outcome);
			const contentLabel = playlistEntry.contentType ? ` · ${formatContentType(playlistEntry.contentType)}` : '';
			lines.push(`      ${playlistIndex + 1}. **${playlistEntryLabel}**${contentLabel} · ${normalizeWhitespace(playlistEntry.title)}`);
			if (playlistEntry.transcriptLanguageCode) {
				lines.push(`         - Language: \`${playlistEntry.transcriptLanguageCode}\``);
			}
			if (playlistEntry.notePath) {
				lines.push(`         - Note: ${formatReportNotePath(playlistEntry.notePath)}`);
			}
			if (playlistEntry.reason) {
				lines.push(`         - Reason: ${normalizeWhitespace(playlistEntry.reason)}`);
			}
			appendReportWarnings(lines, playlistEntry.warnings, '         ');
		});
	}

	return lines.join('\n');
}

export function renderBatchReport(report: BatchReport): string {
	const entries = report.entries;
	const counts = countBatchReportEntries(entries);
	const summary = buildReportSummary(counts.total, counts.completed, counts.skipped, counts.failed, counts.canceled);
	const runLines = entries.length
		? entries.map((entry, index) => entry.kind === 'video'
			? buildVideoReportEntry(entry, index)
			: buildPlaylistReportEntry(entry, index)).join('\n\n')
		: 'No runs recorded.';

	return renderCollapsedReportCallout(`${summary}

**Runs**

${runLines}`);
}
