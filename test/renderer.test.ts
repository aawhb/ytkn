import { describe, expect, it } from 'vitest';
import { renderPlaylistNote, renderQueueBatchReport, renderVideoNote } from '../src/services/renderer';
import { getTemplate } from '../src/services/templates';

const transcript = {
	url: 'https://youtube.com/watch?v=123',
	videoId: '123',
	title: 'Video',
	author: 'Author',
	channelId: 'UCabc',
	channelUrl: 'https://youtube.com/channel/abc',
	description: 'Video description.',
	thumbnailUrl: 'https://img.youtube.com/vi/123/hqdefault.jpg',
	durationSeconds: 42,
	keywords: ['alpha', 'beta'],
	lines: [{ text: 'Hello world', offset: 0 }],
};

const playlist = {
	url: 'https://www.youtube.com/playlist?list=PL123',
	playlistId: 'PL123',
	title: 'Playlist',
	entries: [{ videoId: '123', url: 'https://youtube.com/watch?v=123', position: 1, title: 'Video' }],
	transcripts: [transcript],
};

describe('renderVideoNote', () => {
	it('renders readable transcripts as a folded Obsidian callout', () => {
		const { content } = renderVideoNote(transcript as any, 'thumb.png', 'https://youtube.com/watch?v=123', 'Summary', { transcriptMode: 'readable' });
		expect(content).toContain('> [!note]- Transcript');
		expect(content).toContain('Hello world');
		expect(content).not.toContain('<details>');
		expect(content).not.toContain('<summary>Transcript</summary>');
		expect(content).not.toContain('```text');
	});

	it('renders readable transcript paragraphs without code fences', () => {
		const { content } = renderVideoNote(transcript as any, 'thumb.png', 'https://youtube.com/watch?v=123', null, { transcriptMode: 'readable' });

		expect(content).toContain('> [!note]- Transcript');
		expect(content).toContain('Hello world');
		expect(content).not.toContain('```text');
	});

	it('renders readable transcript paragraphs across normal caption gaps', () => {
		const readableTranscript = {
			...transcript,
			lines: [
				{ text: 'Okay, so the orchestration code', offset: 0 },
				{ text: 'wrapping your LLM now drives', offset: 3000 },
				{ text: 'more performance variation than the model itself.', offset: 6000 },
				{ text: 'Now here is why this matters.', offset: 16000 },
			],
		};
		const { content } = renderVideoNote(readableTranscript as any, 'thumb.png', 'https://youtube.com/watch?v=123', null, { transcriptMode: 'readable' });

		expect(content).toContain('Okay, so the orchestration code wrapping your LLM now drives more performance variation than the model itself.');
		expect(content).toContain('model itself.\n>\n> Now here is why this matters.');
	});

	it('keeps sentence fragments together until a natural boundary', () => {
		const readableTranscript = {
			...transcript,
			lines: [
				{ text: 'Okay, so the orchestration code', offset: 0 },
				{ text: 'wrapping your LLM now drives more performance variation than the model itself.', offset: 1000 },
				{ text: 'That is the headline finding from two papers and this note walks through the implications.', offset: 2000 },
				{ text: 'First, exactly what a harness is and why it matters more than the model.', offset: 3000 },
				{ text: 'Second, how to build one using known harness engineering.', offset: 4000 },
				{ text: 'And third, the practical', offset: 5000 },
				{ text: 'takeaways about what you should change when your agent is underperforming.', offset: 6000 },
			],
		};
		const { content } = renderVideoNote(readableTranscript as any, 'thumb.png', 'https://youtube.com/watch?v=123', null, { transcriptMode: 'readable' });

		expect(content).toContain('And third, the practical takeaways about what you should change when your agent is underperforming.');
		expect(content).not.toContain('the practical\n>\n> takeaways');
	});

	it('splits long transcript text at sentence boundaries inside caption cues', () => {
		const readableTranscript = {
			...transcript,
			lines: [
				{ text: 'This section keeps building context with a deliberately long clause about architecture wrappers and evaluation mechanics memory budgets execution loops tool calls state stores control planes routing policies and measurement surfaces without ending the sentence', offset: 0 },
				{ text: 'and it continues describing harness components memory tools storage orchestration benchmark variance agent loops system prompts queue behavior trace replay retry policy structured outputs evaluator design and measurement until the paragraph is already quite substantial', offset: 1000 },
				{ text: 'while still carrying more context about how benchmarks hide orchestration failures repeated tool calls retry loops state drift and runtime choices before reaching the actual point', offset: 2000 },
				{ text: 'depending on exactly how those components are structured? Okay, so let\'s look at the first paper and this is where it gets really interesting. The first paper is from Pan', offset: 3000 },
				{ text: 'and team and Shinhua University which was published in March 2026.', offset: 4000 },
			],
		};

		const { content } = renderVideoNote(readableTranscript as any, 'thumb.png', 'https://youtube.com/watch?v=123', null, { transcriptMode: 'readable' });

		expect(content).toContain('components are structured?\n>\n> Okay, so let\'s look at the first paper and this is where it gets really interesting.');
		expect(content).toContain('The first paper is from Pan and team and Shinhua University which was published in March 2026.');
		expect(content).not.toContain('The first paper is from Pan\n>\n> and team');
	});

	it('keeps mid-sentence caption continuations in the same paragraph', () => {
		const readableTranscript = {
			...transcript,
			lines: [
				{ text: 'Graph just means it is nodes and connections, commits and the links between them. This graph is your project history.', offset: 0 },
				{ text: 'Every branch, every merge, every decision any developer ever made is captured in the structure. And here is what makes Git powerful.', offset: 1000 },
				{ text: 'Because every commit is a complete snapshot. You can jump to any point in this graph and see your project history at that point in time', offset: 2000 },
				{ text: 'exactly as it existed. No reconstruction, no playing back changes, just there.', offset: 3000 },
			],
		};

		const { content } = renderVideoNote(readableTranscript as any, 'thumb.png', 'https://youtube.com/watch?v=123', null, { transcriptMode: 'readable' });

		expect(content).toContain('point in this graph and see your project history at that point in time exactly as it existed.');
		expect(content).not.toContain('point in time\n>\n> exactly as it existed.');
	});

	it('renders timestamped transcript paragraphs from millisecond offsets', () => {
		const timestampedTranscript = {
			...transcript,
			lines: [
				{ text: 'Hello world.', offset: 0 },
				{ text: 'Next point.', offset: 75000 },
			],
		};
		const { content } = renderVideoNote(timestampedTranscript as any, 'thumb.png', 'https://youtube.com/watch?v=123', null, { transcriptMode: 'timestamped' });

		expect(content).toContain('**[0:00]** Hello world.');
		expect(content).toContain('**[1:15]** Next point.');
	});

	it('wraps timestamps with YouTube deep links when linkTimestamps is enabled', () => {
		const timestampedTranscript = {
			...transcript,
			lines: [
				{ text: 'Hello world.', offset: 0 },
				{ text: 'Next point.', offset: 75000 },
			],
		};
		const { content } = renderVideoNote(
			timestampedTranscript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			null,
			{ transcriptMode: 'timestamped', linkTimestamps: true },
		);

		expect(content).toContain('**[0:00](https://youtu.be/123?t=0s)** Hello world.');
		expect(content).toContain('**[1:15](https://youtu.be/123?t=75s)** Next point.');
	});

	it('excludes collapsed transcript when disabled', () => {
		const { content } = renderVideoNote(transcript as any, 'thumb.png', 'https://youtube.com/watch?v=123', 'Summary', { transcriptMode: 'none' });
		expect(content).not.toContain('> [!note]- Transcript');
		expect(content).not.toContain('<details>');
	});

	it('omits media when media embed is off', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'Summary',
			{ transcriptMode: 'none', mediaEmbedMode: 'none' },
		);

		expect(content).not.toContain('![Thumbnail](thumb.png)');
		expect(content).not.toContain('![Video](https://youtube.com/watch?v=123)');
		expect(content).toContain('# Video');
	});

	it('renders thumbnail when media embed is thumbnail', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'Summary',
			{ transcriptMode: 'none', mediaEmbedMode: 'thumbnail' },
		);

		expect(content).toContain('![Thumbnail](thumb.png)');
		expect(content).not.toContain('![Video](https://youtube.com/watch?v=123)');
	});

	it('renders a deterministic source section and strips model generated source', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'## Summary\nAccurate summary\n\n## Source\n- Title: [placeholder]',
			{ transcriptMode: 'none' }
		);

		expect(content).toContain('> [!info] Source Info');
		expect(content).toContain('> - **Title:** Video');
		expect(content).toContain('> - **Channel:** [Author](https://youtube.com/channel/abc)');
		expect(content).toContain('> - **URL:** https://youtube.com/watch?v=123');
		expect(content).not.toContain('[placeholder]');
	});

	it('strips model generated transcript sections when transcript is disabled', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'## Summary\nAccurate summary\n\n## Transcript\nHello world',
			{ transcriptMode: 'none' }
		);

		expect(content).toContain('## Summary');
		expect(content).not.toContain('## Transcript');
		expect(content).not.toContain('> [!note]- Transcript');
	});

	it('renders playlist notes with a playlist source section', () => {
		const { content } = renderPlaylistNote(
			playlist as any,
			'thumb.png',
			'## Summary\nPlaylist summary\n\n## Source\nIgnore me',
			{ transcriptMode: 'readable' },
		);

		expect(content).toContain('# Playlist');
		expect(content).toContain('## Source');
		expect(content).toContain('- Playlist: [Playlist](https://www.youtube.com/playlist?list=PL123)');
		expect(content).toContain('1. [Video](https://youtube.com/watch?v=123) - Author');
		expect(content).toContain('> [!note]- Playlist transcripts');
		expect(content).not.toContain('<summary>Playlist transcripts</summary>');
		expect(content).not.toContain('```text');
		expect(content).not.toContain('Ignore me');
	});

	it('uses the playlist URL for default media embed when no thumbnail URL is provided', () => {
		const { content } = renderPlaylistNote(
			playlist as any,
			null,
			'## Summary\nPlaylist summary',
			{ transcriptMode: 'none' },
		);

		expect(content).not.toContain('![Thumbnail]');
		expect(content).toContain('![Playlist](https://www.youtube.com/playlist?list=PL123)');
		expect(content).toContain('# Playlist');
	});

	it('TL;DR section in a summary callout', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'## TL;DR\nMost important idea.\n\n## Summary\nRest of note.',
			{ transcriptMode: 'none', includeFrontmatter: false },
		);
		expect(content).toContain('> Most important idea.');
		expect(content).toContain('## Summary\nRest of note.');
		expect(content).not.toContain('## TL;DR\nMost important idea.');
	});

	it('keeps the TL;DR section in the body when the top callout is disabled', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'## TL;DR\nMost important idea.\n\n## Summary\nRest of note.',
			{ transcriptMode: 'none', includeFrontmatter: false, tldrCalloutAtTop: false },
		);

		expect(content).not.toContain('> [!summary] TL;DR');
		expect(content).toContain('## TL;DR\nMost important idea.');
	});

	it('decodes HTML entities inside Mermaid blocks so mindmaps render the intended text', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'## Summary\nBody\n\n## Mindmap\n```mermaid\nmindmap\n  root((Central idea))\n    Discovery -&gt; Planning -&gt; Execution\n```',
			{ transcriptMode: 'none', includeFrontmatter: false },
		);

		expect(content).toContain('Discovery -> Planning -> Execution');
		expect(content).not.toContain('Discovery -&gt; Planning -&gt; Execution');
	});

	it('fixes memorable quotes where only the first quote has the > prefix', () => {
		const summary = [
			'## Summary',
			'Body text.',
			'',
			'## Memorable quotes',
			'> [!quote] "First quote." (0:36)',
			'[!quote] "Second quote." (0:53)',
			'[!quote] "Third quote." (2:22)',
		].join('\n');

		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			summary,
			{ transcriptMode: 'none', includeFrontmatter: false },
		);

		expect(content).toContain('> [!quote] "First quote." (0:36)');
		expect(content).toContain('> [!quote] "Second quote." (0:53)');
		expect(content).toContain('> [!quote] "Third quote." (2:22)');
		expect(content).not.toMatch(/^(?!> )\[!quote\]/m);
	});

	it('adds blank lines between adjacent memorable quote callouts', () => {
		const summary = [
			'## Summary',
			'Body text.',
			'',
			'## Memorable quotes',
			'> [!quote] "First." (0:10)',
			'> [!quote] "Second." (0:20)',
			'> [!quote] "Third." (0:30)',
		].join('\n');

		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			summary,
			{ transcriptMode: 'none', includeFrontmatter: false },
		);

		const lines = content.split('\n');
		const quoteIndices = lines.map((l, i) => (l.startsWith('> [!quote]') ? i : -1)).filter((i) => i !== -1);
		expect(quoteIndices.length).toBe(3);
		// Each consecutive pair of quotes must have at least one blank line between them
		expect(lines[quoteIndices[0] + 1]).toBe('');
		expect(lines[quoteIndices[1] + 1]).toBe('');
	});

	it('leaves already-correct memorable quotes unchanged (idempotent)', () => {
		const quotesSection = [
			'## Memorable quotes',
			'> [!quote] "First." (0:10)',
			'',
			'> [!quote] "Second." (0:20)',
		].join('\n');
		const summary = `## Summary\nBody text.\n\n${quotesSection}`;

		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			summary,
			{ transcriptMode: 'none', includeFrontmatter: false },
		);

		expect(content).toContain('> [!quote] "First." (0:10)');
		expect(content).toContain('> [!quote] "Second." (0:20)');
	});

	it('does not alter output when no ## Memorable quotes section is present', () => {
		const summary = '## Summary\nJust a regular note without quotes.';

		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			summary,
			{ transcriptMode: 'none', includeFrontmatter: false },
		);

		expect(content).toContain('## Summary');
		expect(content).toContain('Just a regular note without quotes.');
		expect(content).not.toContain('[!quote]');
	});

	it('leaves memorable quotes section intact when it contains no [!quote] lines', () => {
		const summary = '## Summary\nBody.\n\n## Memorable quotes\nNo quotes were found.';

		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			summary,
			{ transcriptMode: 'none', includeFrontmatter: false },
		);

		expect(content).toContain('## Memorable quotes');
		expect(content).toContain('No quotes were found.');
	});
});

describe('frontmatter and linkback options', () => {
	it('emits frontmatter with source metadata by default', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'Summary',
			{ transcriptMode: 'none' },
		);
		const block = content.split('---\n')[1];

		expect(content.startsWith('---\n')).toBe(true);
		expect(block).toContain('title: "Video"');
		expect(block).toContain('aliases:');
		expect(block).toContain('  - "Video"');
		expect(block).toContain('source: youtube');
		expect(block).toContain('channel: "Author"');
		expect(block).toContain('channelId: "UCabc"');
		expect(block).toContain('videoId: "123"');
		expect(block).toContain('thumbnailUrl: "https://img.youtube.com/vi/123/hqdefault.jpg"');
		expect(block).toContain('videoDescription: "Video description."');
		expect(block).toContain('durationSeconds: 42');
		expect(block).toContain('keywords:\n  - "alpha"\n  - "beta"');
		expect(block).toContain('generated: ');
	});

	it('does not apply template tags or section warnings when no template is provided', () => {
		const { content, warnings } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			null,
			{ transcriptMode: 'readable' },
			null,
		);

		expect(content).not.toContain('ytkn/general');
		expect(warnings.some((warning) => warning.includes('TL;DR'))).toBe(false);
	});

	it('still warns when a declared template is used without required sections', () => {
		const { content, warnings } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			null,
			{ transcriptMode: 'readable' },
			getTemplate('general'),
		);

		expect(content).toContain('ytkn/general');
		expect(warnings.some((warning) => warning.includes('TL;DR'))).toBe(true);
	});

	it('omits frontmatter when includeFrontmatter is false', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'Summary',
			{ transcriptMode: 'none', includeFrontmatter: false },
		);

		expect(content.startsWith('# Video')).toBe(true);
		expect(content).not.toContain('---');
	});

	it('writes user-supplied tags as a frontmatter list, stripping leading hashes', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'Summary',
			{ transcriptMode: 'none', frontmatterTags: '#youtube, ai/summary, learning' },
		);

		expect(content).toContain('tags:');
		expect(content).toContain('  - youtube');
		expect(content).toContain('  - ai/summary');
		expect(content).toContain('  - learning');
	});

	it('embeds videoUrl in frontmatter when videoUrl is in the allowlist', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'Summary',
			{ transcriptMode: 'none' },
		);

		expect(content).toContain('videoUrl: "https://youtube.com/watch?v=123"');
	});

	it('moves the source section to the top when sourceSectionPosition is top', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'## Summary\nSummary body',
			{ transcriptMode: 'none', sourceSectionPosition: 'top', includeFrontmatter: false },
		);

		const sourceIndex = content.indexOf('> [!info] Source Info');
		const summaryIndex = content.indexOf('## Summary');
		expect(sourceIndex).toBeGreaterThan(-1);
		expect(summaryIndex).toBeGreaterThan(-1);
		expect(sourceIndex).toBeLessThan(summaryIndex);
	});

	it('renders the canonical header format for video notes', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'Summary',
			{ transcriptMode: 'none', includeFrontmatter: false },
		);

		expect(content).toContain('# Video');
		expect(content).toContain('![Video](https://youtube.com/watch?v=123)');
		expect(content).not.toContain('![Thumbnail](thumb.png)');
		expect(content).not.toContain('Watch Video');
	});
});

describe('renderQueueBatchReport', () => {
	const batchId = 'batch-1';

	it('reports total/outcome counts, language, note path, and reason for video entries', () => {
		const report = {
			batchId,
			entries: [
				{ kind: 'video' as const, runId: 'r1', batchId, ordinal: 1, url: 'https://yt/a', displayTitle: 'Video A', outcome: 'completed' as const, transcriptLanguageCode: 'en', notePath: 'Notes/A.md' },
				{ kind: 'video' as const, runId: 'r2', batchId, ordinal: 2, url: 'https://yt/b', displayTitle: 'Video B', outcome: 'skipped' as const, reason: 'No transcript available' },
				{ kind: 'video' as const, runId: 'r3', batchId, ordinal: 3, url: 'https://yt/c', displayTitle: 'Video C', outcome: 'failed' as const, reason: 'API rate limit' },
				{ kind: 'video' as const, runId: 'r4', batchId, ordinal: 4, url: 'https://yt/d', displayTitle: 'Video D', outcome: 'canceled' as const, reason: 'Removed from queue.' },
			],
		};

		const result = renderQueueBatchReport(report);

		expect(result).toContain('> [!summary]- Run Report');
		expect(result).toContain('> **Summary**');
		expect(result).toContain('> - Total: 4');
		expect(result).toContain('> - Completed: 1');
		expect(result).toContain('> - Skipped: 1');
		expect(result).toContain('> - Failed: 1');
		expect(result).toContain('> - Canceled: 1');

		expect(result).toContain('1. **Completed** · Video A');
		expect(result).toContain('- Language: `en`');
		expect(result).toContain('- Note: `Notes/A.md`');

		expect(result).toContain('2. **Skipped** · Video B');
		expect(result).toContain('- Reason: No transcript available');

		expect(result).toContain('3. **Failed** · Video C');
		expect(result).toContain('- Reason: API rate limit');

		expect(result).toContain('4. **Canceled** · Video D');
		expect(result).toContain('- Reason: Removed from queue.');
		expect(result).not.toContain('|');
	});

	it('renders the report as one collapsed Obsidian callout', () => {
		const report = {
			batchId,
			entries: [
				{ kind: 'video' as const, runId: 'r1', batchId, ordinal: 1, url: 'https://yt/a', displayTitle: 'A', outcome: 'completed' as const },
			],
		};
		const result = renderQueueBatchReport(report);
		expect(result.startsWith('> [!summary]- Run Report')).toBe(true);
		expect(result).toContain('> **Runs**');
		expect(result).not.toContain('<details>');
		expect(result).not.toContain('<summary>');
		expect(result).not.toContain('## Run Report');
		expect(result.match(/Run Report/g)).toHaveLength(1);
	});

	it('renders nested playlist entries', () => {
		const report = {
			batchId,
			entries: [
				{
					kind: 'playlist' as const,
					runId: 'r1', batchId, ordinal: 1,
					url: 'https://yt/pl',
					displayTitle: 'My Playlist',
					playlistTitle: 'My Playlist',
					playlistUrl: 'https://yt/pl',
					outcome: 'completed' as const,
					notePath: 'Playlists/My Playlist.md',
					entries: [
						{ title: 'Vid A', url: 'https://yt/a', position: 1, outcome: 'completed' as const, transcriptLanguageCode: 'en', notePath: 'Notes/A.md' },
						{ title: 'Vid B', url: 'https://yt/b', position: 2, outcome: 'skipped' as const, reason: 'No transcript' },
					],
				},
			],
		};
		const result = renderQueueBatchReport(report);
		expect(result).toContain('> - Total: 2');
		expect(result).toContain('> - Completed: 1');
		expect(result).toContain('> - Skipped: 1');
		expect(result).toContain('1. **Completed** · My Playlist');
		expect(result).toContain('- Note: `Playlists/My Playlist.md`');
		expect(result).toContain('- Counts: 2 total, 1 completed, 1 skipped, 0 failed, 0 canceled');
		expect(result).toContain('1. **Completed** · Vid A');
		expect(result).toContain('- Language: `en`');
		expect(result).toContain('2. **Skipped** · Vid B');
		expect(result).toContain('- Reason: No transcript');
	});

	it('summarizes mixed batches by video-level work while preserving playlist groups', () => {
		const report = {
			batchId,
			entries: [
				{
					kind: 'playlist' as const,
					runId: 'r1', batchId, ordinal: 1,
					url: 'https://yt/pl-a',
					displayTitle: 'Playlist A',
					playlistTitle: 'Playlist A',
					playlistUrl: 'https://yt/pl-a',
					outcome: 'completed' as const,
					entries: [
						{ title: 'A1', url: 'https://yt/a1', position: 1, outcome: 'completed' as const },
						{ title: 'A2', url: 'https://yt/a2', position: 2, outcome: 'skipped' as const, reason: 'No transcript' },
					],
				},
				{
					kind: 'playlist' as const,
					runId: 'r2', batchId, ordinal: 2,
					url: 'https://yt/pl-b',
					displayTitle: 'Playlist B',
					playlistTitle: 'Playlist B',
					playlistUrl: 'https://yt/pl-b',
					outcome: 'completed' as const,
					entries: [
						{ title: 'B1', url: 'https://yt/b1', position: 1, outcome: 'failed' as const, reason: 'Provider error' },
					],
				},
				{ kind: 'video' as const, runId: 'r3', batchId, ordinal: 3, url: 'https://yt/v', displayTitle: 'Standalone', outcome: 'completed' as const },
			],
		};

		const result = renderQueueBatchReport(report);

		expect(result).toContain('> - Total: 4');
		expect(result).toContain('> - Completed: 2');
		expect(result).toContain('> - Skipped: 1');
		expect(result).toContain('> - Failed: 1');
		expect(result).toContain('1. **Completed** · Playlist A');
		expect(result).toContain('- Counts: 2 total, 1 completed, 1 skipped, 0 failed, 0 canceled');
		expect(result).toContain('2. **Completed** · Playlist B');
		expect(result).toContain('- Counts: 1 total, 0 completed, 0 skipped, 1 failed, 0 canceled');
		expect(result).toContain('3. **Completed** · Standalone');
	});

	it('counts a playlist-level failure as one item when no child entries exist', () => {
		const report = {
			batchId,
			entries: [
				{
					kind: 'playlist' as const,
					runId: 'r1', batchId, ordinal: 1,
					url: 'https://yt/pl',
					displayTitle: 'Broken Playlist',
					playlistTitle: 'Broken Playlist',
					playlistUrl: 'https://yt/pl',
					outcome: 'failed' as const,
					reason: 'Failed to fetch playlist',
					entries: [],
				},
			],
		};

		const result = renderQueueBatchReport(report);

		expect(result).toContain('> - Total: 1');
		expect(result).toContain('> - Failed: 1');
		expect(result).toContain('- Reason: Failed to fetch playlist');
		expect(result).toContain('- Counts: 1 total, 0 completed, 0 skipped, 1 failed, 0 canceled');
	});

	it('renders video entry warnings as sub-lines', () => {
		const report = {
			batchId,
			entries: [
				{
					kind: 'video' as const, runId: 'r1', batchId, ordinal: 1,
					url: 'https://yt/a', displayTitle: 'Vid A',
					outcome: 'completed' as const,
					notePath: 'a.md',
					warnings: ['Required section "TL;DR" was not emitted by the model.'],
				},
			],
		};
		const result = renderQueueBatchReport(report);
		expect(result).toContain('Required section "TL;DR" was not emitted by the model.');
		expect(result).toContain('- Warnings:');
	});

	it('omits warnings sub-line when entry has no warnings', () => {
		const report = {
			batchId,
			entries: [
				{ kind: 'video' as const, runId: 'r1', batchId, ordinal: 1, url: 'https://yt/a', displayTitle: 'Vid B', outcome: 'completed' as const },
			],
		};
		const result = renderQueueBatchReport(report);
		expect(result).not.toContain('Warnings:');
	});

	it('canceled-queued entry shows reason "Removed from queue."', () => {
		const report = {
			batchId,
			entries: [
				{
					kind: 'video' as const, runId: 'r1', batchId, ordinal: 1,
					url: 'https://yt/a', displayTitle: 'Never started',
					outcome: 'canceled' as const,
					reason: 'Removed from queue.',
				},
			],
		};
		const result = renderQueueBatchReport(report);
		expect(result).toContain('- Reason: Removed from queue.');
	});
});
