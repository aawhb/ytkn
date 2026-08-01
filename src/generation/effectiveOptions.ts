import type {
	ChannelContentType,
	GenerationOptions,
	InstructionMode,
	InstructionTemplate,
	MediaEmbedMode,
	NoteDestinationMode,
	PlaylistMode,
	PluginSettings,
	ReportLocation,
	SourceSectionPosition,
	TranscriptFailureMode,
	TranscriptLanguageMode,
	TranscriptMode,
} from '../types';
export interface EffectiveGenerationOptions extends GenerationOptions {
	useAi: boolean;
	generateAiSummary: boolean;
	instructionMode: InstructionMode;
	instructionTemplate: InstructionTemplate;
	manualInstructions: string;
	includeMindmap: boolean;
	includeMemorableQuotes: boolean;
	controlValues: Record<string, string>;
	transcriptMode: TranscriptMode;
	playlistMode: PlaylistMode;
	channelContentTypes: ChannelContentType[];
	channelVideoLimit: number | null;
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
	modelIds: string[];
	temperature: number;
	requestTimeoutMs: number;
	includeFrontmatter: boolean;
	frontmatterTags: string;
	frontmatterPropertyAllowlist: string;
	sourceSectionPosition: SourceSectionPosition;
	linkTimestamps: boolean;
	tldrCalloutAtTop: boolean;
}

export function resolveEffectiveGenerationOptions(
	options: GenerationOptions,
	settings: PluginSettings,
): EffectiveGenerationOptions {
	const outputDefaults = settings.getOutputDefaults();
	const instructionConfig = settings.getInstructionConfig();

	return {
		...options,
		useAi: options.useAi ?? outputDefaults.useAi,
		generateAiSummary: options.generateAiSummary ?? outputDefaults.generateAiSummary,
		instructionMode: options.instructionMode ?? instructionConfig.mode,
		instructionTemplate: options.instructionTemplate ?? instructionConfig.template,
		manualInstructions: options.manualInstructions ?? instructionConfig.manualInstructions,
		includeMindmap: options.includeMindmap ?? instructionConfig.includeMindmap,
		includeMemorableQuotes: options.includeMemorableQuotes ?? instructionConfig.includeMemorableQuotes,
		controlValues: options.controlValues ?? instructionConfig.controlValues ?? {},
		transcriptMode: options.transcriptMode ?? outputDefaults.transcriptMode,
		playlistMode: options.playlistMode ?? outputDefaults.playlistMode,
		channelContentTypes: options.channelContentTypes ?? outputDefaults.channelContentTypes,
		channelVideoLimit: options.channelVideoLimit !== undefined
			? options.channelVideoLimit
			: outputDefaults.channelVideoLimit,
		transcriptLanguageMode: options.transcriptLanguageMode ?? outputDefaults.transcriptLanguageMode,
		preferredTranscriptLanguage: options.preferredTranscriptLanguage ?? outputDefaults.preferredTranscriptLanguage,
		transcriptFailureMode: options.transcriptFailureMode ?? outputDefaults.transcriptFailureMode,
		mediaEmbedMode: options.mediaEmbedMode ?? outputDefaults.mediaEmbedMode,
		includeReport: options.includeReport ?? outputDefaults.includeReport,
		reportLocation: options.reportLocation ?? outputDefaults.reportLocation,
		useVideoTitleAsNoteName: options.useVideoTitleAsNoteName ?? outputDefaults.useVideoTitleAsNoteName,
		noteDestinationMode: options.noteDestinationMode ?? outputDefaults.noteDestinationMode,
		noteDestinationFolder: options.noteDestinationFolder ?? outputDefaults.noteDestinationFolder,
		openCreatedNote: options.openCreatedNote ?? outputDefaults.openCreatedNote,
		modelIds: options.modelIds ?? settings.getModelIds(),
		temperature: options.temperature ?? settings.getTemperature(),
		requestTimeoutMs: options.requestTimeoutMs ?? settings.getRequestTimeoutMs(),
		includeFrontmatter: options.includeFrontmatter ?? outputDefaults.includeFrontmatter,
		frontmatterTags: options.frontmatterTags ?? outputDefaults.frontmatterTags,
		frontmatterPropertyAllowlist: options.frontmatterPropertyAllowlist ?? outputDefaults.frontmatterPropertyAllowlist,
		sourceSectionPosition: options.sourceSectionPosition ?? outputDefaults.sourceSectionPosition,
		linkTimestamps: options.linkTimestamps ?? outputDefaults.linkTimestamps,
		tldrCalloutAtTop: options.tldrCalloutAtTop ?? outputDefaults.tldrCalloutAtTop,
	};
}
