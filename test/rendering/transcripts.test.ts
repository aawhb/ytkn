import { describe, expect, it } from 'vitest';
import { buildPlaylistTranscriptDetails, buildTranscriptDetails } from '../../src/rendering/transcripts';

const transcript = {
	url: 'https://youtube.com/watch?v=abc',
	videoId: 'abc',
	title: 'Video',
	author: 'Author',
	lines: [
		{ text: 'Hello <world>.', offset: 0 },
		{ text: 'Next *point*.', offset: 75000 },
	],
};

describe('transcript detail rendering', () => {
	it('renders readable transcripts as escaped collapsed callouts', () => {
		const details = buildTranscriptDetails(transcript as any, 'readable', { transcriptMode: 'readable' });

		expect(details).toContain('> [!note]- Transcript');
		expect(details).toContain('> Hello &lt;world&gt;.');
		expect(details).toContain('> Next \\*point\\*.');
	});

	it('renders timestamped transcripts with optional YouTube links', () => {
		const details = buildTranscriptDetails(transcript as any, 'timestamped', { transcriptMode: 'timestamped', linkTimestamps: true });

		expect(details).toContain('> **[0:00](https://youtu.be/abc?t=0s)** Hello &lt;world&gt;.');
		expect(details).toContain('> **[1:15](https://youtu.be/abc?t=75s)** Next \\*point\\*.');
	});

	it('renders playlist transcripts in one numbered collapsed callout', () => {
		const details = buildPlaylistTranscriptDetails({
			url: 'playlist',
			playlistId: 'PL',
			title: 'Playlist',
			entries: [],
			transcripts: [
				{ ...transcript, title: ' First   Video ' },
				{ ...transcript, title: 'Second Video', videoId: 'def' },
			],
		} as any, 'readable', { transcriptMode: 'readable' });

		expect(details).toContain('> [!note]- Playlist transcripts');
		expect(details).toContain('> **1. First Video**');
		expect(details).toContain('> **2. Second Video**');
	});
});
