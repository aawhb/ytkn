import type { GenerationOptions, TranscriptLine, TranscriptResponse, VideoCollectionTranscriptResponse } from '../types';
import { normalizeWhitespace } from '../utils';
import { renderCollapsedCallout } from './callouts';

const TRANSCRIPT_PARAGRAPH_GAP_MS = 8000;
const TRANSCRIPT_TARGET_PARAGRAPH_CHARS = 700;
const TRANSCRIPT_MAX_PARAGRAPH_CHARS = 1800;
const TRANSCRIPT_MAX_SENTENCES_PER_PARAGRAPH = 4;
const TRANSCRIPT_SENTENCE_PARAGRAPH_MIN_CHARS = 320;

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

function endsSentence(text: string): boolean {
	return /[.!?]["')\]]*$/.test(text);
}

function splitTranscriptTextIntoChunks(text: string): string[] {
	const matches = text.match(/.+?(?:[.!?]["')\]]*(?=\s|$)|$)/g) ?? [];
	const chunks = matches
		.map((chunk) => normalizeWhitespace(chunk))
		.filter((chunk) => chunk.length > 0);

	return chunks.length ? chunks : [text];
}

function joinTranscriptParts(parts: string[]): string {
	return parts.join(' ');
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
		const text = normalizeWhitespace(line.text);
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

function escapeTranscriptMarkdownText(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/([\\`*_[\](){}#+!|])/g, '\\$1');
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
			.map((paragraph) => `${buildTimestampDisplay(paragraph.offset, transcript.videoId, linkTimestamps)} ${escapeTranscriptMarkdownText(paragraph.text)}`)
			.join('\n\n');
	}

	return paragraphs.map((paragraph) => escapeTranscriptMarkdownText(paragraph.text)).join('\n\n');
}

export function buildTranscriptDetails(
	transcript: TranscriptResponse,
	transcriptMode: GenerationOptions['transcriptMode'],
	options: GenerationOptions | undefined,
): string {
	return renderCollapsedCallout('note', 'Transcript', buildTranscriptBody(transcript, transcriptMode, options));
}

export function buildPlaylistTranscriptDetails(
	playlist: VideoCollectionTranscriptResponse,
	transcriptMode: GenerationOptions['transcriptMode'],
	options: GenerationOptions | undefined,
): string {
	const sections = playlist.transcripts.map((transcript, index) => `**${index + 1}. ${normalizeWhitespace(transcript.title)}**

${buildTranscriptBody(transcript, transcriptMode, options)}`);

	return renderCollapsedCallout(
		'note',
		'channelId' in playlist ? 'Channel transcripts' : 'Playlist transcripts',
		sections.join('\n\n'),
	);
}
