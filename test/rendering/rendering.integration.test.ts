import { describe, expect, it } from 'vitest';
import { renderPlaylistNote } from '../../src/rendering/playlistNote';
import { renderQueueBatchReport } from '../../src/rendering/runReport';
import { renderVideoNote } from '../../src/rendering/videoNote';

const transcript = {
	url: 'https://youtube.com/watch?v=123',
	videoId: '123',
	title: 'Video',
	author: 'Author',
	channelId: 'UCabc',
	channelUrl: 'https://youtube.com/channel/abc',
	description: 'Video description.',
	thumbnailUrl: 'https://img.youtube.com/vi/123/hqdefault.jpg',
	uploadDate: '2024-03-05',
	videoCategory: 'Science & Technology',
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
	it('preserves free-form manual summary content without H2 headings', () => {
		const summary = '- First insight\n- Second insight\n- Third insight';
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			summary,
			{ transcriptMode: 'none', includeFrontmatter: false, tldrCalloutAtTop: false },
		);

		expect(content).toContain(summary);
	});

	it('renders readable transcripts as a folded Obsidian callout', () => {
		const { content } = renderVideoNote(transcript as any, 'thumb.png', 'https://youtube.com/watch?v=123', 'Summary', { transcriptMode: 'readable' });
		expect(content).toContain('> [!note]- Transcript');
		expect(content).toContain('Hello world');
		expect(content).not.toContain('<details>');
		expect(content).not.toContain('<summary>Transcript</summary>');
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

	it('escapes transcript text that looks like Markdown or HTML', () => {
		const riskyTranscript = {
			...transcript,
			lines: [
				{ text: 'K is <unk>10 and * [Music] with [label](target), #tag, C++ and A | B!', offset: 0 },
			],
		};

		const { content } = renderVideoNote(riskyTranscript as any, 'thumb.png', 'https://youtube.com/watch?v=123', null, { transcriptMode: 'readable' });

		expect(content).toContain('&lt;unk&gt;10');
		expect(content).toContain('\\* \\[Music\\]');
		expect(content).toContain('\\[label\\]\\(target\\)');
		expect(content).toContain('\\#tag');
		expect(content).toContain('C\\+\\+');
		expect(content).toContain('A \\| B\\!');
		expect(content).not.toContain('<unk>');
		expect(content).not.toContain('* [Music]');
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
		expect(content).toContain('1. [Video](https://youtube.com/watch?v=123) - [Author](https://youtube.com/channel/abc)');
		expect(content).not.toContain('1. [Video](https://youtube.com/watch?v=123) - Author');
		expect(content).toContain('> [!note]- Playlist transcripts');
		expect(content).toContain('> **1. Video**');
		expect(content).not.toContain('<summary>Playlist transcripts</summary>');
		expect(content).not.toContain('```text');
		expect(content).not.toContain('Ignore me');
	});

	it('renders combined playlist transcripts in one playlist callout', () => {
		const multiTranscriptPlaylist = {
			...playlist,
			entries: [
				{ videoId: '123', url: 'https://youtube.com/watch?v=123', position: 1, title: 'Video' },
				{ videoId: '456', url: 'https://youtube.com/watch?v=456', position: 2, title: 'Second Video' },
			],
			transcripts: [
				{
					...transcript,
					title: 'Video',
					lines: [
						{ text: 'First paragraph.', offset: 0 },
						{ text: 'Second paragraph.', offset: 10000 },
					],
				},
				{
					...transcript,
					url: 'https://youtube.com/watch?v=456',
					videoId: '456',
					title: 'Second Video',
					lines: [
						{ text: 'Another transcript paragraph.', offset: 0 },
					],
				},
			],
		};

		const { content } = renderPlaylistNote(
			multiTranscriptPlaylist as any,
			'thumb.png',
			null,
			{ transcriptMode: 'readable' },
		);

		expect(content).toContain('> [!note]- Playlist transcripts');
		expect(content).toContain('> **1. Video**');
		expect(content).toContain('> First paragraph.');
		expect(content).toContain('> Second paragraph.');
		expect(content).toContain('> **2. Second Video**');
		expect(content).toContain('> Another transcript paragraph.');
		expect(content).not.toContain('## Playlist transcripts');
		expect(content).not.toContain('> [!note]- 1. Video');
		expect(content).not.toContain('> ###');
		expect(content).not.toContain('\n### 2. Second Video');
	});

	it('renders metadata-only playlist notes from playlist entries', () => {
		const metadataOnlyPlaylist = {
			...playlist,
			entries: [
				{ videoId: '123', url: 'https://youtube.com/watch?v=123', position: 1, title: 'Video A', author: 'Channel A', channelUrl: 'https://www.youtube.com/@channel-a' },
				{ videoId: '456', url: 'https://youtube.com/watch?v=456', position: 2, title: 'Video B', author: 'Channel B' },
			],
			transcripts: [],
		};

		const { content } = renderPlaylistNote(
			metadataOnlyPlaylist as any,
			null,
			null,
			{ transcriptMode: 'none', mediaEmbedMode: 'thumbnail' },
			null,
		);

		expect(content).toContain('![Thumbnail](https://img.youtube.com/vi/123/hqdefault.jpg)');
		expect(content).toContain('videoCount: 2');
		expect(content).not.toContain('uploadDate:');
		expect(content).not.toContain('videoCategory:');
		expect(content).toContain('- Video count: 2');
		expect(content).toContain('1. [Video A](https://youtube.com/watch?v=123) - [Channel A](https://www.youtube.com/@channel-a)');
		expect(content).toContain('2. [Video B](https://youtube.com/watch?v=456)');
		expect(content).not.toContain('2. [Video B](https://youtube.com/watch?v=456) - Channel B');
		expect(content).not.toContain('Playlist transcripts');
	});

	it('renders the first playlist video with the same Markdown embed pattern as video notes', () => {
		const { content } = renderPlaylistNote(
			playlist as any,
			null,
			'## Summary\nPlaylist summary',
			{ transcriptMode: 'none' },
		);

		expect(content).not.toContain('![Thumbnail]');
		expect(content).not.toContain('![Playlist](https://www.youtube.com/playlist?list=PL123)');
		expect(content).not.toContain('<iframe');
		expect(content).toContain('![Playlist](https://youtube.com/watch?v=123)');
		expect(content).toContain('# Playlist');
	});

	it('renders a playlist thumbnail from the first transcript when media embed is thumbnail', () => {
		const { content } = renderPlaylistNote(
			playlist as any,
			null,
			'## Summary\nPlaylist summary',
			{ transcriptMode: 'none', mediaEmbedMode: 'thumbnail' },
		);

		expect(content).toContain('![Thumbnail](https://img.youtube.com/vi/123/hqdefault.jpg)');
		expect(content).not.toContain('<iframe');
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

	it('preserves the TL;DR section as body content when the callout is disabled', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'## TL;DR\nMost important idea.\n\n## Summary\nRest of note.',
			{ transcriptMode: 'none', includeFrontmatter: false, tldrCalloutAtTop: false },
		);

		expect(content).not.toContain('> [!summary] TL;DR');
		expect(content).toContain('## TL;DR\nMost important idea.');
		expect(content).toContain('## Summary\nRest of note.');
	});

	it('renders a Mindmap outline into a clean mermaid block in the final note', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'## Summary\nBody\n\n## Mindmap\n- Central idea\n  - Discovery -> Planning -> Execution\n  - Time O(sqrt(n))\n  - Design &amp;amp; Architecture',
			{ transcriptMode: 'none', includeFrontmatter: false, includeMindmap: true },
		);

		expect(content).toContain('```mermaid');
		expect(content).toContain('root(("Central idea"))');
		expect(content).toContain('node1["Discovery to Planning to Execution"]');
		expect(content).toContain('node2["Time O(sqrt(n))"]');
		expect(content).toContain('node3["Design and Architecture"]');
		expect(content).not.toContain('-&gt;');
		expect(content).not.toContain('&amp;');
	});

	it('preserves unmatched summary sections in addons-only mode', () => {
		const leaked = [
			'## Solution Approach',
			'Preserve this unmatched section even when the summary is off.',
			'',
			'## Mindmap',
			'- Central idea',
			'  - Branch',
			'',
			'## Memorable quotes',
			'> [!quote] Keep me.',
		].join('\n');

		const { content, warnings } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			leaked,
			{ transcriptMode: 'none', includeFrontmatter: false, generateAiSummary: false, includeMindmap: true, includeMemorableQuotes: true },
		);

		expect(content).toContain('## Mindmap');
		expect(content).toContain('## Memorable quotes');
		expect(content).toContain('## Solution Approach');
		expect(content).toContain('Preserve this unmatched section even when the summary is off.');
		expect(warnings.some((warning) => warning.includes('preserved'))).toBe(true);
	});

	it('does not filter the body when generateAiSummary is not explicitly false', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'## Solution Approach\nKeep this prose.',
			{ transcriptMode: 'none', includeFrontmatter: false },
		);

		expect(content).toContain('## Solution Approach');
		expect(content).toContain('Keep this prose.');
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
			{ transcriptMode: 'none', includeFrontmatter: false, includeMemorableQuotes: true },
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
			{ transcriptMode: 'none', includeFrontmatter: false, includeMemorableQuotes: true },
		);

		const lines = content.split('\n');
		const quoteIndices = lines.map((l, i) => (l.startsWith('> [!quote]') ? i : -1)).filter((i) => i !== -1);
		expect(quoteIndices.length).toBe(3);
		expect(lines[quoteIndices[0] + 1]).toBe('');
		expect(lines[quoteIndices[1] + 1]).toBe('');
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
		expect(block).toContain('videoUrl: "https://youtube.com/watch?v=123"');
		expect(block).toContain('videoId: "123"');
		expect(block).toContain('thumbnailUrl: "https://img.youtube.com/vi/123/hqdefault.jpg"');
		expect(block).toContain('videoDescription: "Video description."');
		expect(block).toContain('uploadDate: 2024-03-05');
		expect(block).toContain('videoCategory: "Science & Technology"');
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

	it('warns when a declared template is missing a required section', () => {
		const requiredTemplate = {
			id: 'general',
			label: 'X',
			subtitle: 'X',
			body: '',
			tags: ['ytkn/general'],
			sections: [{ id: 'evidence', heading: 'Evidence', required: true, description: '' }],
		} as any;
		const { content, warnings } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'## Other notes\nstuff',
			{ transcriptMode: 'readable' },
			requiredTemplate,
		);

		expect(content).toContain('ytkn/general');
		expect(warnings.some((warning) => warning.includes('Evidence'))).toBe(true);
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

	it('suppresses uploadDate and videoCategory unless they are allowlisted', () => {
		const { content } = renderVideoNote(
			transcript as any,
			'thumb.png',
			'https://youtube.com/watch?v=123',
			'Summary',
			{ transcriptMode: 'none', frontmatterPropertyAllowlist: 'title uploadDate' },
		);

		expect(content).toContain('uploadDate: 2024-03-05');
		expect(content).not.toContain('videoCategory:');
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

		expect(result.startsWith('> [!summary]- Run Report')).toBe(true);
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
		expect(result).not.toContain('<details>');
		expect(result).not.toContain('<summary>');
		expect(result).not.toContain('|');
	});

	it('labels a directly submitted Short', () => {
		const result = renderQueueBatchReport({
			batchId,
			entries: [{
				kind: 'video', runId: 'r1', batchId, ordinal: 1,
				url: 'https://youtube.com/shorts/abcdefghijk', displayTitle: 'A Short',
				contentType: 'shorts', outcome: 'completed',
			}],
		});

		expect(result).toContain('- Content: Short');
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

	it('renders channel content selections and nested outcomes', () => {
		const report = {
			batchId,
			entries: [{
				kind: 'channel' as const,
				runId: 'r1', batchId, ordinal: 1,
				url: 'https://youtube.com/@channel',
				displayTitle: 'Channel',
				channelTitle: 'Channel Name',
				channelUrl: 'https://youtube.com/@channel',
				contentTypes: ['videos', 'shorts', 'streams'] as Array<'videos' | 'shorts' | 'streams'>,
				outcome: 'completed' as const,
				entries: [
					{ title: 'Video', url: 'https://yt/a', position: 1, contentType: 'videos' as const, outcome: 'completed' as const },
					{ title: 'Short', url: 'https://yt/b', position: 2, contentType: 'shorts' as const, outcome: 'skipped' as const },
				],
			}],
		};

		const result = renderQueueBatchReport(report);

		expect(result).toContain('1. **Completed** · Channel Name');
		expect(result).toContain('- Content: Videos, Shorts, Stream replays');
		expect(result).toContain('- Counts: 2 total, 1 completed, 1 skipped, 0 failed, 0 canceled');
		expect(result).toContain('- Items:');
		expect(result).toContain('1. **Completed** · Video · Video');
		expect(result).toContain('2. **Skipped** · Short · Short');
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

	it('aggregates video and nested playlist outcomes through the same counting path', () => {
		const report = {
			batchId,
			entries: [
				{
					kind: 'video' as const, runId: 'r1', batchId, ordinal: 1,
					url: 'https://yt/a', displayTitle: 'Video A', outcome: 'completed' as const,
				},
				{
					kind: 'playlist' as const, runId: 'r2', batchId, ordinal: 2,
					url: 'https://yt/pl', displayTitle: 'Playlist', playlistTitle: 'Playlist',
					playlistUrl: 'https://yt/pl', outcome: 'failed' as const,
					entries: [
						{ title: 'Vid B', url: 'https://yt/b', position: 1, outcome: 'skipped' as const },
						{ title: 'Vid C', url: 'https://yt/c', position: 2, outcome: 'canceled' as const },
					],
				},
				{
					kind: 'playlist' as const, runId: 'r3', batchId, ordinal: 3,
					url: 'https://yt/broken', displayTitle: 'Broken Playlist', playlistTitle: 'Broken Playlist',
					playlistUrl: 'https://yt/broken', outcome: 'failed' as const, entries: [],
				},
			],
		};

		const result = renderQueueBatchReport(report);

		expect(result).toContain('> - Total: 4');
		expect(result).toContain('> - Completed: 1');
		expect(result).toContain('> - Skipped: 1');
		expect(result).toContain('> - Failed: 1');
		expect(result).toContain('> - Canceled: 1');
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
});
