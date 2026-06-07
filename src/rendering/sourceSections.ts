import type { PlaylistTranscriptResponse, TranscriptResponse } from '../types';

export function buildVideoSourceSection(transcript: TranscriptResponse, url: string): string {
	return `> [!info] Source Info\n> - **Title:** ${transcript.title}\n> - **Channel:** [${transcript.author}](${transcript.channelUrl})\n> - **URL:** ${url}`;
}

export function buildPlaylistSourceSection(playlist: PlaylistTranscriptResponse): string {
	const videoItems = playlist.transcripts.length > 0
		? playlist.transcripts.map((transcript) => ({
			title: transcript.title,
			url: transcript.url,
			author: transcript.author,
			channelUrl: transcript.channelUrl,
		}))
		: playlist.entries.map((entry) => ({
			title: entry.title,
			url: entry.url,
			author: entry.author ?? null,
			channelUrl: entry.channelUrl ?? null,
		}));
	const videoLines = videoItems
		.map((item, index) => {
			const authorSuffix = item.author && item.channelUrl ? ` - [${item.author}](${item.channelUrl})` : '';
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
