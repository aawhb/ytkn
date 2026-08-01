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
export type ReportLocation = 'generated-note' | 'separate-note';
export type SourceSectionPosition = 'top' | 'bottom';
export type MediaEmbedMode = 'video' | 'thumbnail' | 'none';
export type ChannelContentType = 'videos' | 'shorts' | 'streams';

interface BaseProvider {
	name: string;
	type: ProviderType;
	apiKeySecretId?: string;
	url?: string;
}

interface ModelIdentity {
	name: string;
	displayName: string;
	contextWindow?: number;
}

export type DiscoveredModel = ModelIdentity;

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
	includeFrontmatter: boolean;
	frontmatterTags: string;
	frontmatterPropertyAllowlist: string;
	sourceSectionPosition: SourceSectionPosition;
	linkTimestamps: boolean;
	tldrCalloutAtTop: boolean;
}

export type StoredModel = ModelIdentity;

export interface StoredProvider extends BaseProvider {
	models: StoredModel[];
}

export type RawStoredProvider = StoredProvider & {
	apiKey?: string;
};

export interface StoredSettings {
	providers: StoredProvider[];
	modelIds: string[];
	outputDefaults: OutputDefaults;
	instructionConfig: InstructionConfig;
	temperature: number;
	requestTimeoutMs: number;
	lastSeenReleaseNotesVersion: string | null;
}

export interface PluginSettings {
	loadSettings(): Promise<void>;
	hasSavedSettings(): boolean;
	getSelectedModels(): ModelConfig[];
	getModelIds(): string[];
	updateModelIds(modelIds: string[]): Promise<void>;
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
	updateInstructionConfig(patch: Partial<InstructionConfig>): Promise<void>;
	updateOutputDefaults(outputDefaults: OutputDefaults): Promise<void>;
	updateTemperature(temperature: number): Promise<void>;
	updateRequestTimeoutMs(timeoutMs: number): Promise<void>;
	mergeProviderModels(providerName: string, models: DiscoveredModel[]): Promise<number>;
	resetSettings(): Promise<void>;
	saveProviderSecretId(providerName: string, secretId: string): Promise<void>;
	validateModelId(modelId: string): boolean;
}

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
	channelContentTypes?: ChannelContentType[];
	channelVideoLimit?: number | null;
	transcriptLanguageMode?: TranscriptLanguageMode;
	preferredTranscriptLanguage?: string;
	transcriptFailureMode?: TranscriptFailureMode;
	mediaEmbedMode?: MediaEmbedMode;
	includeReport?: boolean;
	reportLocation?: ReportLocation;
	useVideoTitleAsNoteName?: boolean;
	noteDestinationMode?: NoteDestinationMode;
	noteDestinationFolder?: string;
	openCreatedNote?: boolean;
	modelIds?: string[];
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
	uploadDate?: string;
	videoCategory?: string;
	durationSeconds?: number;
	keywords?: string[];
	lines: TranscriptLine[];
}

export interface VideoCollectionEntry {
	videoId: string;
	url: string;
	position: number;
	title: string;
	author?: string;
	channelUrl?: string;
	channelId?: string;
	thumbnailUrl?: string;
	liveStatus?: 'live' | 'upcoming';
}

export type PlaylistEntry = VideoCollectionEntry;

export interface PlaylistResponse {
	url: string;
	playlistId: string;
	title: string;
	entries: PlaylistEntry[];
}

export interface ChannelResponse {
	url: string;
	channelId: string;
	title: string;
	contentTypes: ChannelContentType[];
	entries: Array<VideoCollectionEntry & { contentType: ChannelContentType }>;
}

export type VideoCollectionResponse = PlaylistResponse | ChannelResponse;

export interface ChannelFetchOptions {
	contentTypes: ChannelContentType[];
	videoLimit: number | null;
}

export type VideoCollectionTranscriptResponse = VideoCollectionResponse & {
	transcripts: TranscriptResponse[];
};

export interface TranscriptFetchResult {
	transcript: TranscriptResponse;
	languageCode: string;
}

export interface CollectionItemResult {
	title: string;
	url: string;
	position: number;
	contentType?: ChannelContentType;
	outcome: QueueRunOutcome;
	transcriptLanguageCode?: string;
	notePath?: string;
	reason?: string;
	warnings?: string[];
}

interface SectionDeclaration {
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

type ControlFieldType = 'string' | 'enum' | 'number' | 'duration';

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

export interface Template {
	id: InstructionTemplate;
	label: string;
	subtitle: string;
	body: string;
	sections?: SectionDeclaration[];
	frontmatter?: FrontmatterDeclaration[];
	tags?: string[];
	controls?: ControlDeclaration[];
}

export type QueueRunOutcome = 'completed' | 'skipped' | 'failed' | 'canceled';

export type QueueRunResult =
	| {
		kind: 'video';
		runId: string;
		batchId: string;
		ordinal: number;
		url: string;
		displayTitle: string;
		contentType?: Extract<ChannelContentType, 'videos' | 'shorts'>;
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
		entries: CollectionItemResult[];
	}
	| {
		kind: 'channel';
		runId: string;
		batchId: string;
		ordinal: number;
		url: string;
		displayTitle: string;
		channelTitle: string;
		channelUrl: string;
		contentTypes: ChannelContentType[];
		outcome: QueueRunOutcome;
		notePath?: string;
		reason?: string;
		warnings?: string[];
		entries: CollectionItemResult[];
	};

export interface BatchReport {
	batchId: string;
	entries: QueueRunResult[];
}
