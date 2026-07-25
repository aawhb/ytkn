import type {
	ChannelContentType,
	GenerationOptions,
	InstructionMode,
	InstructionTemplate,
	MediaEmbedMode,
	ModelConfig,
	NoteDestinationMode,
	PlaylistMode,
	ReportLocation,
	SourceSectionPosition,
	TranscriptFailureMode,
	TranscriptLanguageMode,
	TranscriptMode,
} from '../../types';
import {
	DEFAULT_CHANNEL_CONTENT_TYPES,
	DEFAULT_CHANNEL_VIDEO_LIMIT,
	DEFAULT_GENERATE_AI_SUMMARY,
	DEFAULT_INCLUDE_FRONTMATTER,
	DEFAULT_INCLUDE_MEMORABLE_QUOTES,
	DEFAULT_INCLUDE_MINDMAP,
	DEFAULT_INCLUDE_REPORT,
	DEFAULT_INSTRUCTION_MODE,
	DEFAULT_INSTRUCTION_TEMPLATE,
	DEFAULT_LINK_TIMESTAMPS,
	DEFAULT_MEDIA_EMBED_MODE,
	DEFAULT_NOTE_DESTINATION_MODE,
	DEFAULT_OPEN_CREATED_NOTE,
	DEFAULT_OUTPUT_TRANSCRIPT_MODE,
	DEFAULT_REPORT_LOCATION,
	DEFAULT_PLAYLIST_MODE,
	DEFAULT_SOURCE_SECTION_POSITION,
	DEFAULT_TEMPERATURE,
	DEFAULT_TLDR_CALLOUT_AT_TOP,
	DEFAULT_TRANSCRIPT_FAILURE_MODE,
	DEFAULT_TRANSCRIPT_LANGUAGE_MODE,
	DEFAULT_USE_AI,
	DEFAULT_USE_VIDEO_TITLE_AS_NOTE_NAME,
} from '../../defaults';
import { resolveLegacyUseAi } from '../../aiOutputPolicy';
import { buildModelId } from '../../modelId';
import { getTemplate } from '../../ai/templates/registry';
import { controlDefaultToString } from '../shared/templateControls';
import { extractChannelRef, parseUrls } from '../../youtube/urls';

export interface GenerationFormState {
	url: string;
	useAi: boolean;
	generateAiSummary: boolean;
	transcriptMode: TranscriptMode;
	playlistMode: PlaylistMode;
	channelContentTypes: ChannelContentType[];
	channelVideoLimit: string;
	transcriptLanguageMode: TranscriptLanguageMode;
	preferredTranscriptLanguage: string;
	transcriptFailureMode: TranscriptFailureMode;
	mediaEmbedMode: MediaEmbedMode;
	includeReport: boolean;
	reportLocation: ReportLocation;
	useVideoTitleAsNoteName: boolean;
	noteDestinationMode: NoteDestinationMode;
	noteDestinationFolder: string;
	openCreatedNote: boolean;
	includeFrontmatter: boolean;
	frontmatterTags: string;
	frontmatterPropertyAllowlist: string;
	sourceSectionPosition: SourceSectionPosition;
	linkTimestamps: boolean;
	tldrCalloutAtTop: boolean;
	modelIds: string[];
	instructionMode: InstructionMode;
	instructionTemplate: InstructionTemplate;
	manualInstructions: string;
	includeMindmap: boolean;
	includeMemorableQuotes: boolean;
	temperature: string;
	requestTimeoutSeconds: string;
	controlValues: Record<string, string>;
}

export function seedTemplateControlValues(
	instructionTemplate: InstructionTemplate,
	values: Record<string, string> = {},
): Record<string, string> {
	const seeded = { ...values };
	for (const control of getTemplate(instructionTemplate).controls ?? []) {
		if (seeded[control.id] === undefined && control.default !== undefined) {
			seeded[control.id] = controlDefaultToString(control.default);
		}
	}
	return seeded;
}

interface BuildGenerationFormStateInput {
	initialUrl: string;
	availableModels: ModelConfig[];
	initialOptions: GenerationOptions;
	hasActiveNote: boolean;
}

export function buildGenerationFormState({
	initialUrl,
	availableModels,
	initialOptions,
	hasActiveNote,
}: BuildGenerationFormStateInput): GenerationFormState {
	const init = initialOptions;
	const instructionTemplate = init.instructionTemplate ?? DEFAULT_INSTRUCTION_TEMPLATE;
	const controlValues = seedTemplateControlValues(instructionTemplate, init.controlValues);
	const channelRef = parseUrls(initialUrl).length === 1 ? extractChannelRef(initialUrl.trim()) : null;
	const explicitChannelContentType: ChannelContentType | null = channelRef?.tab === 'videos'
		? 'videos'
		: channelRef?.tab === 'shorts'
			? 'shorts'
			: channelRef?.tab === 'streams' ? 'streams' : null;

	return {
		url: initialUrl,
		useAi: resolveLegacyUseAi(init, DEFAULT_USE_AI),
		generateAiSummary: init.generateAiSummary ?? DEFAULT_GENERATE_AI_SUMMARY,
		transcriptMode: init.transcriptMode ?? DEFAULT_OUTPUT_TRANSCRIPT_MODE,
		playlistMode: init.playlistMode ?? DEFAULT_PLAYLIST_MODE,
		channelContentTypes: explicitChannelContentType
			? [explicitChannelContentType]
			: [...(init.channelContentTypes ?? DEFAULT_CHANNEL_CONTENT_TYPES)],
		channelVideoLimit: init.channelVideoLimit === null
			? ''
			: String(init.channelVideoLimit ?? DEFAULT_CHANNEL_VIDEO_LIMIT),
		transcriptLanguageMode: init.transcriptLanguageMode ?? DEFAULT_TRANSCRIPT_LANGUAGE_MODE,
		preferredTranscriptLanguage: init.preferredTranscriptLanguage ?? '',
		transcriptFailureMode: init.transcriptFailureMode ?? DEFAULT_TRANSCRIPT_FAILURE_MODE,
		mediaEmbedMode: init.mediaEmbedMode ?? DEFAULT_MEDIA_EMBED_MODE,
		includeReport: init.includeReport ?? DEFAULT_INCLUDE_REPORT,
		reportLocation: init.reportLocation ?? DEFAULT_REPORT_LOCATION,
		useVideoTitleAsNoteName: init.useVideoTitleAsNoteName ?? DEFAULT_USE_VIDEO_TITLE_AS_NOTE_NAME,
		noteDestinationMode: hasActiveNote
			? (init.noteDestinationMode ?? DEFAULT_NOTE_DESTINATION_MODE)
			: 'folder',
		noteDestinationFolder: init.noteDestinationFolder ?? '',
		openCreatedNote: init.openCreatedNote ?? DEFAULT_OPEN_CREATED_NOTE,
		includeFrontmatter: init.includeFrontmatter ?? DEFAULT_INCLUDE_FRONTMATTER,
		frontmatterTags: init.frontmatterTags ?? '',
		frontmatterPropertyAllowlist: init.frontmatterPropertyAllowlist ?? '',
		sourceSectionPosition: init.sourceSectionPosition ?? DEFAULT_SOURCE_SECTION_POSITION,
		linkTimestamps: init.linkTimestamps ?? DEFAULT_LINK_TIMESTAMPS,
		tldrCalloutAtTop: init.tldrCalloutAtTop ?? DEFAULT_TLDR_CALLOUT_AT_TOP,
		modelIds: init.modelIds ?? (availableModels[0] ? [buildModelId(availableModels[0])] : []),
		instructionMode: init.instructionMode ?? DEFAULT_INSTRUCTION_MODE,
		instructionTemplate,
		manualInstructions: init.manualInstructions ?? '',
		includeMindmap: init.includeMindmap ?? DEFAULT_INCLUDE_MINDMAP,
		includeMemorableQuotes: init.includeMemorableQuotes ?? DEFAULT_INCLUDE_MEMORABLE_QUOTES,
		temperature: String(init.temperature ?? DEFAULT_TEMPERATURE),
		requestTimeoutSeconds: String(init.requestTimeoutMs != null ? Math.round(init.requestTimeoutMs / 1000) : ''),
		controlValues,
	};
}
