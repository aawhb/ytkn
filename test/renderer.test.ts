import { describe, expect, it } from 'vitest';
import { renderPlaylistNote, renderQueueBatchReport, renderVideoNote } from '../src/services/renderer';

const transcript = {
	url: 'https://youtube.com/watch?v=123',
	videoId: '123',
	title: 'Video',
	author: 'Author',
	channelUrl: 'https://youtube.com/channel/abc',
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
	it('includes raw collapsed transcript when enabled', () => {
		const { content } = renderVideoNote(transcript as any, 'thumb.png', 'https://youtube.com/watch?v=123', 'Summary', { transcriptMode: 'raw' });
		expect(content).toContain('<details>');
		expect(content).toContain('```text');
		expect(content).toContain('Hello world');
	});

	it('renders readable transcript paragraphs without raw code fences', () => {
		const { content } = renderVideoNote(transcript as any, 'thumb.png', 'https://youtube.com/watch?v=123', null, { transcriptMode: 'readable' });

		expect(content).toContain('<summary>Transcript</summary>');
		expect(content).toContain('Hello world');
		expect(content).not.toContain('```text');
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
		expect(content).not.toContain('<details>');
	});

	it('excludes thumbnail when disabled', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'Summary',
			{ transcriptMode: 'none', includeThumbnail: false },
		);

		expect(content).not.toContain('![Thumbnail](thumb.png)');
		expect(content).toContain('# Video');
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
		expect(content).not.toContain('<summary>Transcript</summary>');
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
		expect(content).toContain('<summary>Playlist transcripts</summary>');
		expect(content).not.toContain('```text');
		expect(content).not.toContain('Ignore me');
	});

	it('omits the thumbnail block on playlist notes when no thumbnail URL is provided', () => {
		const { content } = renderPlaylistNote(
			playlist as any,
			null,
			'## Summary\nPlaylist summary',
			{ transcriptMode: 'none' },
		);

		expect(content).not.toContain('![Thumbnail]');
		expect(content).toContain('# Playlist');
	});

	it('promotes the TL;DR section into a top summary callout and removes the duplicate section from the body', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'## TL;DR\nMost important idea.\n\n## Summary\nRest of note.',
			{ transcriptMode: 'none', includeFrontmatter: false },
		);

		expect(content).toContain('> [!summary] TL;DR');
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
	it('emits frontmatter with title, alias, channel, videoId, and generated timestamp by default', () => {
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
		expect(block).toContain('videoId: "123"');
		expect(block).toContain('generated: ');
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
		expect(content).toContain('![Thumbnail](thumb.png)');
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

		expect(result).toContain('Total runs: 4');
		expect(result).toContain('Completed: 1');
		expect(result).toContain('Skipped: 1');
		expect(result).toContain('Failed: 1');
		expect(result).toContain('Canceled: 1');

		expect(result).toContain('Video A [Completed]');
		expect(result).toContain('language=en');
		expect(result).toContain('note=Notes/A.md');

		expect(result).toContain('Video B [Skipped]');
		expect(result).toContain('reason=No transcript available');

		expect(result).toContain('Video C [Failed]');
		expect(result).toContain('reason=API rate limit');

		expect(result).toContain('Video D [Canceled]');
		expect(result).toContain('reason=Removed from queue.');
	});

	it('wraps the report inside a collapsed details section', () => {
		const report = {
			batchId,
			entries: [
				{ kind: 'video' as const, runId: 'r1', batchId, ordinal: 1, url: 'https://yt/a', displayTitle: 'A', outcome: 'completed' as const },
			],
		};
		const result = renderQueueBatchReport(report);
		expect(result.startsWith('<details>')).toBe(true);
		expect(result.endsWith('</details>')).toBe(true);
		expect(result).toContain('<summary>Run Report</summary>');
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
		expect(result).toContain('My Playlist [Completed]');
		expect(result).toContain('note=Playlists/My Playlist.md');
		expect(result).toContain('Vid A [Completed]');
		expect(result).toContain('language=en');
		expect(result).toContain('Vid B [Skipped]');
		expect(result).toContain('reason=No transcript');
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
	});

	it('omits warnings sub-line when entry has no warnings', () => {
		const report = {
			batchId,
			entries: [
				{ kind: 'video' as const, runId: 'r1', batchId, ordinal: 1, url: 'https://yt/a', displayTitle: 'Vid B', outcome: 'completed' as const },
			],
		};
		const result = renderQueueBatchReport(report);
		expect(result).not.toContain('   - ');
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
		expect(result).toContain('reason=Removed from queue.');
	});
});
