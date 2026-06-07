import { describe, expect, it } from 'vitest';
import { buildPlaylistSourceSection, buildVideoSourceSection } from '../../src/rendering/sourceSections';

const transcript = {
	url: 'https://youtube.com/watch?v=abc',
	videoId: 'abc',
	title: 'Video',
	author: 'Author',
	channelUrl: 'https://youtube.com/@author',
	lines: [],
};

describe('source section rendering', () => {
	it('renders deterministic video source metadata', () => {
		expect(buildVideoSourceSection(transcript as any, transcript.url)).toBe([
			'> [!info] Source Info',
			'> - **Title:** Video',
			'> - **Channel:** [Author](https://youtube.com/@author)',
			'> - **URL:** https://youtube.com/watch?v=abc',
		].join('\n'));
	});

	it('prefers transcript metadata for playlist videos when transcripts exist', () => {
		const playlist = {
			url: 'https://youtube.com/playlist?list=PL123',
			title: 'Playlist',
			entries: [{ title: 'Entry Title', url: 'entry-url', position: 1, author: 'Entry Author', channelUrl: 'entry-channel' }],
			transcripts: [{ ...transcript, title: 'Transcript Title', url: 'transcript-url' }],
		};

		const section = buildPlaylistSourceSection(playlist as any);

		expect(section).toContain('- Playlist: [Playlist](https://youtube.com/playlist?list=PL123)');
		expect(section).toContain('- Video count: 1');
		expect(section).toContain('1. [Transcript Title](transcript-url) - [Author](https://youtube.com/@author)');
		expect(section).not.toContain('Entry Title');
	});

	it('uses playlist entry metadata when transcripts are absent', () => {
		const playlist = {
			url: 'https://youtube.com/playlist?list=PL123',
			title: 'Playlist',
			entries: [{ title: 'Entry Title', url: 'entry-url', position: 1, author: 'Entry Author', channelUrl: 'entry-channel' }],
			transcripts: [],
		};

		expect(buildPlaylistSourceSection(playlist as any)).toContain('1. [Entry Title](entry-url) - [Entry Author](entry-channel)');
	});
});
