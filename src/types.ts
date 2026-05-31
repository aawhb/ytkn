// Provider and settings
export type ProviderType = 'openai' | 'openai-compatible' | 'anthropic' | 'gemini';
export type TranscriptMode = 'none' | 'readable' | 'timestamped';
export type PlaylistMode = 'per-video' | 'combined';
export type NoteDestinationMode = 'current-note' | 'folder' | 'append-to-active-note';
export type InstructionMode = 'template' | 'manual';
export type InstructionTemplate =
	| 'general'
	| 'study'
	| 'full-extract'
	| 'deep-dive'
	| 'research'
	| 'implementation';
export type TranscriptLanguageMode = 'auto' | 'preferred';
export type TranscriptFailureMode = 'skip' | 'fail';
export type RunReportLocation = 'generated-note' | 'separate-note';
export type SourceSectionPosition = 'top' | 'bottom';
export type MediaEmbedMode = 'video' | 'thumbnail' | 'none';

interface BaseProvider {
	name: string;
	type: ProviderType;
	apiKeySecretId?: string;
	url?: string;
}

export interface DiscoveredModel {
	name: string;
	displayName: string;
	contextWindow?: number;
}

export interface ModelConfig {
	name: string;
	displayName?: string;
	contextWindow?: number;
	provider: ProviderConfig;
}

export interface ProviderConfig extends BaseProvider {
	apiKey: string;
	models?: ModelConfig[];
}

export interface InstructionConfig {
	mode: InstructionMode;
	template: InstructionTemplate;
	manualInstructions: string;
	includeMindmap: boolean;
	includeMemorableQuotes: boolean;
	controlValues?: Record<string, string>;
}

export interface OutputDefaults {
	useAi: boolean;
	generateAiSummary: boolean;
	transcriptMode: TranscriptMode;
	playlistMode: PlaylistMode;
	transcriptLanguageMode: TranscriptLanguageMode;
	preferredTranscriptLanguage: string;
	transcriptFailureMode: TranscriptFailureMode;
	mediaEmbedMode: MediaEmbedMode;
	includeRunReport: boolean;
	runReportLocation: RunReportLocation;
	useVideoTitleAsNoteName: boolean;
	noteDestinationMode: NoteDestinationMode;
	noteDestinationFolder: string;
	includeFrontmatter: boolean;
	frontmatterTags: string;
	frontmatterPropertyAllowlist: string;
	sourceSectionPosition: SourceSectionPosition;
	linkTimestamps: boolean;
	tldrCalloutAtTop: boolean;
}

export interface StoredModel {
	name: string;
	displayName: string;
	contextWindow?: number;
}

export interface StoredProvider extends BaseProvider {
	models: StoredModel[];
}

export type RawStoredProvider = StoredProvider & {
	apiKey?: string;
};

export interface StoredSettings {
	providers: StoredProvider[];
	selectedModelId: string | null;
	outputDefaults: OutputDefaults;
	instructionConfig: InstructionConfig;
	temperature: number;
	requestTimeoutMs: number;
	lastSeenReleaseNotesVersion: string | null;
}

export interface PluginSettings {
	loadSettings(): Promise<void>;
	hasSavedSettings(): boolean;
	getSelectedModel(): ModelConfig | null;
	getProviders(): ProviderConfig[];
	getModels(): ModelConfig[];
	getInstructionConfig(): InstructionConfig;
	getOutputDefaults(): OutputDefaults;
	getTemperature(): number;
	getRequestTimeoutMs(): number;
	getLastSeenReleaseNotesVersion(): string | null;
	setLastSeenReleaseNotesVersion(version: string): Promise<void>;
	addProvider(provider: ProviderConfig): Promise<void>;
	addModel(model: ModelConfig): Promise<void>;
	updateProvider(provider: ProviderConfig, originalName: string): Promise<void>;
	updateModel(modelName: string, modelDisplayName: string, providerName: string): Promise<void>;
	deleteProvider(provider: ProviderConfig): Promise<void>;
	deleteModel(providerName: string, modelName: string): Promise<void>;
	updateActiveModel(modelId: string): Promise<void>;
	updateInstructionConfig(config: InstructionConfig): Promise<void>;
	updateOutputDefaults(outputDefaults: OutputDefaults): Promise<void>;
	updateTemperature(temperature: number): Promise<void>;
	updateRequestTimeoutMs(timeoutMs: number): Promise<void>;
	mergeProviderModels(providerName: string, models: DiscoveredModel[]): Promise<number>;
	resetSettings(): Promise<void>;
	saveProviderSecretId(providerName: string, secretId: string): Promise<void>;
	validateModelId(modelId: string): boolean;
}

// Generation options and providers
export interface GenerationOptions {
	useAi?: boolean;
	generateAiSummary?: boolean;
	instructionMode?: InstructionMode;
	instructionTemplate?: InstructionTemplate;
	manualInstructions?: string;
	includeMindmap?: boolean;
	includeMemorableQuotes?: boolean;
	controlValues?: Record<string, string>;
	transcriptMode?: TranscriptMode;
	playlistMode?: PlaylistMode;
	transcriptLanguageMode?: TranscriptLanguageMode;
	preferredTranscriptLanguage?: string;
	transcriptFailureMode?: TranscriptFailureMode;
	mediaEmbedMode?: MediaEmbedMode;
	includeRunReport?: boolean;
	runReportLocation?: RunReportLocation;
	useVideoTitleAsNoteName?: boolean;
	noteDestinationMode?: NoteDestinationMode;
	noteDestinationFolder?: string;
	modelId?: string;
	temperature?: number;
	requestTimeoutMs?: number;
	includeFrontmatter?: boolean;
	frontmatterTags?: string;
	frontmatterPropertyAllowlist?: string;
	sourceSectionPosition?: SourceSectionPosition;
	linkTimestamps?: boolean;
	tldrCalloutAtTop?: boolean;
}

export interface AIModelProvider {
	summarizeVideo(prompt: string, signal?: AbortSignal): Promise<string>;
}

// YouTube, transcripts, and playlists
export interface TranscriptLine {
	text: string;
	offset: number;
}

export interface TranscriptResponse {
	url: string;
	videoId: string;
	title: string;
	author: string;
	channelId?: string;
	channelUrl: string;
	description?: string;
	thumbnailUrl?: string;
	durationSeconds?: number;
	keywords?: string[];
	lines: TranscriptLine[];
}

export interface PlaylistEntry {
	videoId: string;
	url: string;
	position: number;
	title: string;
}

export interface PlaylistResponse {
	url: string;
	playlistId: string;
	title: string;
	entries: PlaylistEntry[];
}

export interface PlaylistTranscriptResponse extends PlaylistResponse {
	transcripts: TranscriptResponse[];
}

export interface TranscriptFetchResult {
	transcript: TranscriptResponse;
	languageCode: string;
}

export type PlaylistRunOutcome = 'completed' | 'skipped' | 'failed' | 'canceled';

export interface PlaylistRunReportEntry {
	title: string;
	url: string;
	position: number;
	outcome: PlaylistRunOutcome;
	transcriptLanguageCode?: string;
	notePath?: string;
	reason?: string;
	warnings?: string[];
}

// Templates and rendering metadata
export interface SectionDeclaration {
	id: string;
	heading: string;
	required: boolean;
	description: string;
}

export type FrontmatterFieldType = 'string' | 'string[]' | 'number' | 'enum' | 'date';

export interface FrontmatterDeclaration {
	key: string;
	type: FrontmatterFieldType;
	enumValues?: string[];
	description: string;
	default?: unknown;
}

export type ControlFieldType = 'string' | 'enum' | 'number' | 'duration';

export interface ControlDeclaration {
	id: string;
	label: string;
	type: ControlFieldType;
	enumValues?: string[];
	required: boolean;
	default?: unknown;
	description: string;
	multiline?: boolean;
}

export interface BlockDeclaration {
	id: string;
	kind: string;
}

export type LeadCalloutKind = 'summary' | 'quote' | 'note' | 'info' | 'warning';
export type SectionCalloutKind = 'summary' | 'quote' | 'note' | 'info' | 'warning' | 'question' | 'example';

export interface Template {
	id: InstructionTemplate;
	label: string;
	subtitle: string;
	body: string;
	sections?: SectionDeclaration[];
	frontmatter?: FrontmatterDeclaration[];
	tags?: string[];
	controls?: ControlDeclaration[];
	filenamePattern?: string;
	leadCallout?: LeadCalloutKind;
	sectionCallouts?: Record<string, SectionCalloutKind>;
	customBlocks?: BlockDeclaration[];
}

// Queue and reporting
export type QueueRunOutcome = 'completed' | 'skipped' | 'failed' | 'canceled';

export type QueueRunReportEntry =
	| {
		kind: 'video';
		runId: string;
		batchId: string;
		ordinal: number;
		url: string;
		displayTitle: string;
		outcome: QueueRunOutcome;
		notePath?: string;
		transcriptLanguageCode?: string;
		warnings?: string[];
		reason?: string;
	}
	| {
		kind: 'playlist';
		runId: string;
		batchId: string;
		ordinal: number;
		url: string;
		displayTitle: string;
		playlistTitle: string;
		playlistUrl: string;
		outcome: QueueRunOutcome;
		notePath?: string;
		reason?: string;
		warnings?: string[];
		entries: PlaylistRunReportEntry[];
	};

export interface QueueBatchReport {
	batchId: string;
	entries: QueueRunReportEntry[];
}

// Output extraction
export interface ExtractedTemplateOutput {
	frontmatter: Record<string, unknown> | null;
	sections: Map<string, string>;
	extras: Array<{ heading: string; body: string }>;
	warnings: string[];
}
