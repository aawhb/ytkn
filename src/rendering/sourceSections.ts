import type { TranscriptResponse, VideoCollectionTranscriptResponse } from '../types';

export function buildVideoSourceSection(transcript: TranscriptResponse, url: string): string {
	return `> [!info] Source Info\n> - **Title:** ${transcript.title}\n> - **Channel:** [${transcript.author}](${transcript.channelUrl})\n> - **URL:** ${url}`;
}

export function buildCollectionSourceSection(collection: VideoCollectionTranscriptResponse): string {
	const videoItems = collection.transcripts.length > 0
		? collection.transcripts.map((transcript) => ({
			title: transcript.title,
			url: transcript.url,
			author: transcript.author,
			channelUrl: transcript.channelUrl,
		}))
		: collection.entries.map((entry) => ({
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

	const sourceLabel = 'channelId' in collection ? 'Channel' : 'Playlist';
	return `## Source
- ${sourceLabel}: [${collection.title}](${collection.url})
- Video count: ${videoCount}

### Videos
${videoLines}`;
}
