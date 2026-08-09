import type {
	ChannelContentType,
	InstructionConfig,
	InstructionMode,
	InstructionTemplate,
	MediaEmbedMode,
	NoteDestinationMode,
	OutputDefaults,
	PlaylistMode,
	ReportLocation,
	SourceSectionPosition,
	TranscriptFailureMode,
	TranscriptLanguageMode,
} from '../types';
import {
	DEFAULT_CHANNEL_CONTENT_TYPES,
	DEFAULT_CHANNEL_VIDEO_LIMIT,
	DEFAULT_FRONTMATTER_TAGS,
	DEFAULT_GENERATE_AI_SUMMARY,
	DEFAULT_INCLUDE_FRONTMATTER,
	DEFAULT_INCLUDE_MEMORABLE_QUOTES,
	DEFAULT_INCLUDE_MINDMAP,
	DEFAULT_INSTRUCTION_MODE,
	DEFAULT_INSTRUCTION_TEMPLATE,
	DEFAULT_MEDIA_EMBED_MODE,
	DEFAULT_INCLUDE_REPORT,
	DEFAULT_LINK_TIMESTAMPS,
	DEFAULT_MANUAL_INSTRUCTIONS,
	DEFAULT_NOTE_DESTINATION_FOLDER,
	DEFAULT_OPEN_CREATED_NOTE,
	DEFAULT_NOTE_DESTINATION_MODE,
	DEFAULT_OUTPUT_TRANSCRIPT_MODE,
	DEFAULT_REPORT_LOCATION,
	DEFAULT_PLAYLIST_MODE,
	DEFAULT_PREFERRED_TRANSCRIPT_LANGUAGE,
	DEFAULT_SOURCE_SECTION_POSITION,
	DEFAULT_TEMPERATURE,
	DEFAULT_TLDR_CALLOUT_AT_TOP,
	DEFAULT_TRANSCRIPT_FAILURE_MODE,
	DEFAULT_TRANSCRIPT_LANGUAGE_MODE,
	DEFAULT_USE_AI,
	DEFAULT_USE_VIDEO_TITLE_AS_NOTE_NAME,
} from '../defaults';
import { normalizeVaultFolderPath } from '../utils';
import { isInstructionTemplate } from '../ai/templates/registry';
import { normalizeFrontmatterPropertyPreferences } from '../frontmatterProperties';

export type RawOutputDefaults = Partial<Omit<OutputDefaults, 'mediaEmbedMode' | 'channelContentTypes' | 'channelVideoLimit' | 'frontmatterProperties'>> & {
	mediaEmbedMode?: unknown;
	channelContentTypes?: unknown;
	channelVideoLimit?: unknown;
	frontmatterProperties?: unknown;
	frontmatterPropertyAllowlist?: string;
	includeRunReport?: boolean;
	runReportLocation?: ReportLocation;
};

function normalizeOneOf<T extends string>(value: unknown, allowedValues: readonly T[], fallback: T): T {
	return allowedValues.includes(value as T) ? (value as T) : fallback;
}

const VALID_INSTRUCTION_MODES: readonly InstructionMode[] = ['template', 'manual'];
const VALID_TRANSCRIPT_MODES: readonly OutputDefaults['transcriptMode'][] = [
	'none',
	'readable',
	'timestamped',
];
const VALID_PLAYLIST_MODES: readonly PlaylistMode[] = ['per-video', 'combined'];
const VALID_NOTE_DESTINATION_MODES: readonly NoteDestinationMode[] = [
	'current-note',
	'folder',
	'append-to-active-note',
];
const VALID_TRANSCRIPT_LANGUAGE_MODES: readonly TranscriptLanguageMode[] = ['auto', 'preferred'];
const VALID_TRANSCRIPT_FAILURE_MODES: readonly TranscriptFailureMode[] = ['skip', 'fail'];
const VALID_REPORT_LOCATIONS: readonly ReportLocation[] = ['generated-note', 'separate-note'];
const VALID_SOURCE_SECTION_POSITIONS: readonly SourceSectionPosition[] = ['top', 'bottom'];
const VALID_MEDIA_EMBED_MODES: readonly MediaEmbedMode[] = ['video', 'thumbnail', 'none'];
const VALID_CHANNEL_CONTENT_TYPES: readonly ChannelContentType[] = ['videos', 'shorts', 'streams'];

function normalizeInstructionMode(mode?: InstructionMode): InstructionMode {
	return normalizeOneOf(mode, VALID_INSTRUCTION_MODES, DEFAULT_INSTRUCTION_MODE);
}

function normalizeInstructionTemplate(template?: InstructionTemplate): InstructionTemplate {
	if (isInstructionTemplate(template)) {
		return template;
	}

	return DEFAULT_INSTRUCTION_TEMPLATE;
}

function normalizeControlValues(controlValues?: Record<string, string>): Record<string, string> | undefined {
	const normalized: Record<string, string> = {};

	for (const [id, value] of Object.entries(controlValues ?? {})) {
		if (typeof value !== 'string') {
			continue;
		}
		const trimmed = value.trim();
		if (trimmed) {
			normalized[id] = trimmed;
		}
	}

	return Object.keys(normalized).length ? normalized : undefined;
}

function normalizeManualInstructions(manualInstructions?: string): string {
	return manualInstructions?.trim() ?? DEFAULT_MANUAL_INSTRUCTIONS;
}

function normalizeIncludeMindmap(includeMindmap?: boolean): boolean {
	return includeMindmap ?? DEFAULT_INCLUDE_MINDMAP;
}

function normalizeIncludeMemorableQuotes(value?: boolean): boolean {
	return value ?? DEFAULT_INCLUDE_MEMORABLE_QUOTES;
}

export function normalizeInstructionConfig(instructionConfig?: Partial<InstructionConfig>): InstructionConfig {
	if (instructionConfig) {
		const controlValues = normalizeControlValues(instructionConfig.controlValues);
		return {
			mode: normalizeInstructionMode(instructionConfig.mode),
			template: normalizeInstructionTemplate(instructionConfig.template),
			manualInstructions: normalizeManualInstructions(instructionConfig.manualInstructions),
			includeMindmap: normalizeIncludeMindmap(instructionConfig.includeMindmap),
			includeMemorableQuotes: normalizeIncludeMemorableQuotes(instructionConfig.includeMemorableQuotes),
			...(controlValues ? { controlValues } : {}),
		};
	}

	return {
		mode: DEFAULT_INSTRUCTION_MODE,
		template: DEFAULT_INSTRUCTION_TEMPLATE,
		manualInstructions: DEFAULT_MANUAL_INSTRUCTIONS,
		includeMindmap: DEFAULT_INCLUDE_MINDMAP,
		includeMemorableQuotes: DEFAULT_INCLUDE_MEMORABLE_QUOTES,
	};
}

function normalizeTranscriptMode(transcriptMode?: string): OutputDefaults['transcriptMode'] {
	return normalizeOneOf(transcriptMode, VALID_TRANSCRIPT_MODES, DEFAULT_OUTPUT_TRANSCRIPT_MODE);
}

function normalizePlaylistMode(playlistMode?: PlaylistMode): PlaylistMode {
	return normalizeOneOf(playlistMode, VALID_PLAYLIST_MODES, DEFAULT_PLAYLIST_MODE);
}

function normalizeChannelContentTypes(value: unknown): ChannelContentType[] {
	if (!Array.isArray(value)) {
		return [...DEFAULT_CHANNEL_CONTENT_TYPES];
	}

	const selected = VALID_CHANNEL_CONTENT_TYPES.filter((type) => value.includes(type));
	return selected.length > 0 ? selected : [...DEFAULT_CHANNEL_CONTENT_TYPES];
}

function normalizeChannelVideoLimit(value: unknown): number | null {
	if (value === null) {
		return null;
	}
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
		return DEFAULT_CHANNEL_VIDEO_LIMIT;
	}
	return Math.floor(value);
}

function normalizeNoteDestinationMode(noteDestinationMode?: NoteDestinationMode): NoteDestinationMode {
	return normalizeOneOf(noteDestinationMode, VALID_NOTE_DESTINATION_MODES, DEFAULT_NOTE_DESTINATION_MODE);
}

function normalizeNoteDestinationFolder(noteDestinationFolder?: string): string {
	return normalizeVaultFolderPath(noteDestinationFolder ?? DEFAULT_NOTE_DESTINATION_FOLDER);
}

function normalizeTranscriptLanguageMode(transcriptLanguageMode?: TranscriptLanguageMode): TranscriptLanguageMode {
	return normalizeOneOf(transcriptLanguageMode, VALID_TRANSCRIPT_LANGUAGE_MODES, DEFAULT_TRANSCRIPT_LANGUAGE_MODE);
}

function normalizePreferredTranscriptLanguage(preferredTranscriptLanguage?: string): string {
	return preferredTranscriptLanguage?.trim() ?? DEFAULT_PREFERRED_TRANSCRIPT_LANGUAGE;
}

function normalizeTranscriptFailureMode(transcriptFailureMode?: TranscriptFailureMode): TranscriptFailureMode {
	return normalizeOneOf(transcriptFailureMode, VALID_TRANSCRIPT_FAILURE_MODES, DEFAULT_TRANSCRIPT_FAILURE_MODE);
}

function normalizeReportLocation(reportLocation?: ReportLocation): ReportLocation {
	return normalizeOneOf(reportLocation, VALID_REPORT_LOCATIONS, DEFAULT_REPORT_LOCATION);
}

function normalizeSourceSectionPosition(value?: SourceSectionPosition): SourceSectionPosition {
	return normalizeOneOf(value, VALID_SOURCE_SECTION_POSITIONS, DEFAULT_SOURCE_SECTION_POSITION);
}

function normalizeMediaEmbedMode(value?: unknown): MediaEmbedMode {
	if (VALID_MEDIA_EMBED_MODES.includes(value as MediaEmbedMode)) {
		return value as MediaEmbedMode;
	}

	return DEFAULT_MEDIA_EMBED_MODE;
}

function normalizeFrontmatterTags(value?: string): string {
	return value?.trim() ?? DEFAULT_FRONTMATTER_TAGS;
}

export function normalizeContextWindow(contextWindow?: number): number | undefined {
	if (!Number.isFinite(contextWindow) || (contextWindow ?? 0) <= 0) {
		return undefined;
	}

	return Math.round(contextWindow as number);
}

export function normalizeOutputDefaults(outputDefaults?: RawOutputDefaults): OutputDefaults {
	return {
		useAi: outputDefaults?.useAi ?? DEFAULT_USE_AI,
		generateAiSummary: outputDefaults?.generateAiSummary ?? DEFAULT_GENERATE_AI_SUMMARY,
		transcriptMode: normalizeTranscriptMode(outputDefaults?.transcriptMode),
		playlistMode: normalizePlaylistMode(outputDefaults?.playlistMode),
		channelContentTypes: normalizeChannelContentTypes(outputDefaults?.channelContentTypes),
		channelVideoLimit: normalizeChannelVideoLimit(outputDefaults?.channelVideoLimit),
		transcriptLanguageMode: normalizeTranscriptLanguageMode(outputDefaults?.transcriptLanguageMode),
		preferredTranscriptLanguage: normalizePreferredTranscriptLanguage(outputDefaults?.preferredTranscriptLanguage),
		transcriptFailureMode: normalizeTranscriptFailureMode(outputDefaults?.transcriptFailureMode),
		mediaEmbedMode: normalizeMediaEmbedMode(outputDefaults?.mediaEmbedMode),
		includeReport: outputDefaults?.includeReport ?? outputDefaults?.includeRunReport ?? DEFAULT_INCLUDE_REPORT,
		reportLocation: normalizeReportLocation(outputDefaults?.reportLocation ?? outputDefaults?.runReportLocation),
		useVideoTitleAsNoteName: outputDefaults?.useVideoTitleAsNoteName ?? DEFAULT_USE_VIDEO_TITLE_AS_NOTE_NAME,
		noteDestinationMode: normalizeNoteDestinationMode(outputDefaults?.noteDestinationMode),
		noteDestinationFolder: normalizeNoteDestinationFolder(outputDefaults?.noteDestinationFolder),
		openCreatedNote: outputDefaults?.openCreatedNote ?? DEFAULT_OPEN_CREATED_NOTE,
		includeFrontmatter: outputDefaults?.includeFrontmatter ?? DEFAULT_INCLUDE_FRONTMATTER,
		frontmatterTags: normalizeFrontmatterTags(outputDefaults?.frontmatterTags),
		frontmatterProperties: normalizeFrontmatterPropertyPreferences(
			outputDefaults?.frontmatterProperties,
			outputDefaults?.frontmatterPropertyAllowlist,
		),
		sourceSectionPosition: normalizeSourceSectionPosition(outputDefaults?.sourceSectionPosition),
		linkTimestamps: outputDefaults?.linkTimestamps ?? DEFAULT_LINK_TIMESTAMPS,
		tldrCalloutAtTop: outputDefaults?.tldrCalloutAtTop ?? DEFAULT_TLDR_CALLOUT_AT_TOP,
	};
}

export function normalizeTemperature(temperature?: number): number {
	if (!Number.isFinite(temperature)) {
		return DEFAULT_TEMPERATURE;
	}

	return Math.min(Math.max(temperature as number, 0), 2);
}

export function normalizeReleaseNotesVersion(value?: string | null): string | null {
	const trimmed = typeof value === 'string' ? value.trim() : '';
	return trimmed || null;
}
