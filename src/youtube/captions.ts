import { requestUrl } from 'obsidian';
import type { TranscriptLanguageMode, TranscriptLine } from '../types';
import { normalizeHtmlText } from './metadata';

export type CaptionTrack = {
	baseUrl: string;
	languageCode: string;
};

function browserHeaders(): Record<string, string> {
	return { 'Accept-Language': 'en-US,en;q=0.9' };
}

export function parseCaptionXml(xml: string): TranscriptLine[] {
	const paragraphLines = parseCaptionElements(xml, /<p\s+([^>]+)>([\s\S]*?)<\/p>/g, (attributes) => {
		const match = attributes.match(/\bt="(\d+)"/);
		return match ? Number.parseInt(match[1], 10) : null;
	});

	if (paragraphLines.length > 0) {
		return paragraphLines;
	}

	const textLines = parseCaptionElements(xml, /<text\s+([^>]+)>([\s\S]*?)<\/text>/g, (attributes) => {
		const match = attributes.match(/\bstart="([^"]+)"/);
		return match ? Number.parseFloat(match[1]) * 1000 : null;
	});

	if (textLines.length === 0) {
		throw new Error('Failed to parse transcript XML - no caption segments found');
	}

	return textLines;
}

function parseCaptionElements(
	xml: string,
	regex: RegExp,
	readOffset: (attributes: string) => number | null,
): TranscriptLine[] {
	const lines: TranscriptLine[] = [];
	let match: RegExpExecArray | null;

	while ((match = regex.exec(xml)) !== null) {
		const offset = readOffset(match[1]);
		if (offset === null) {
			continue;
		}

		const text = normalizeHtmlText(match[2].replace(/<[^>]+>/g, ' '));
		if (!text) {
			continue;
		}

		lines.push({ text, offset });
	}

	return lines;
}

export function selectCaptionTrack(captionTracks: CaptionTrack[], preferredLanguageCode: string | null): CaptionTrack | null {
	if (!preferredLanguageCode) {
		return captionTracks[0] ?? null;
	}

	const requested = preferredLanguageCode.toLowerCase();
	const exact = captionTracks.find((track) => track.languageCode.toLowerCase() === requested);
	if (exact) {
		return exact;
	}

	const variant = captionTracks.find((track) => track.languageCode.toLowerCase().startsWith(`${requested}-`));
	if (variant) {
		return variant;
	}

	const prefix = captionTracks.find((track) => requested.startsWith(`${track.languageCode.toLowerCase()}-`));
	return prefix ?? captionTracks[0] ?? null;
}

export function requestedTranscriptLanguage(
	languageMode: TranscriptLanguageMode | undefined,
	preferredLanguageCode: string | undefined,
): string | null {
	if (languageMode !== 'preferred') {
		return null;
	}

	const normalized = preferredLanguageCode?.trim().toLowerCase() ?? '';
	return normalized || null;
}

export async function requestCaptionLines(captionUrl: string): Promise<TranscriptLine[]> {
	const response = await requestUrl({
		url: captionUrl,
		method: 'GET',
		headers: browserHeaders(),
	});

	return parseCaptionXml(response.text);
}
