import YTKN from '../main';
import { isOllamaEndpoint } from '../utils';
import {
	DiscoveredModel,
	InstructionConfig,
	InstructionMode,
	InstructionTemplate,
	ModelConfig,
	NoteDestinationMode,
	OutputDefaults,
	RunReportLocation,
	PlaylistMode,
	PluginSettings,
	ProviderConfig,
	ReasoningMode,
	ReasoningSupport,
	SourceSectionPosition,
	StoredModel,
	StoredProvider,
	StoredSettings,
	TranscriptFailureMode,
	TranscriptLanguageMode,
} from '../types';
import {
	DEFAULT_FRONTMATTER_PROPERTY_ALLOWLIST,
	DEFAULT_FRONTMATTER_TAGS,
	DEFAULT_GENERATE_AI_SUMMARY,
	DEFAULT_INCLUDE_FRONTMATTER,
	DEFAULT_INCLUDE_MEMORABLE_QUOTES,
	DEFAULT_INCLUDE_MINDMAP,
	DEFAULT_INSTRUCTION_MODE,
	DEFAULT_INSTRUCTION_TEMPLATE,
	DEFAULT_INCLUDE_THUMBNAIL,
	DEFAULT_INCLUDE_RUN_REPORT,
	DEFAULT_LINK_TIMESTAMPS,
	DEFAULT_MANUAL_INSTRUCTIONS,
	DEFAULT_NOTE_DESTINATION_FOLDER,
	DEFAULT_NOTE_DESTINATION_MODE,
	DEFAULT_OUTPUT_TRANSCRIPT_MODE,
	DEFAULT_RUN_REPORT_LOCATION,
	DEFAULT_PLAYLIST_MODE,
	DEFAULT_PREFERRED_TRANSCRIPT_LANGUAGE,
	DEFAULT_REASONING_MODE,
	DEFAULT_REQUEST_TIMEOUT_MS,
	DEFAULT_SOURCE_SECTION_POSITION,
	DEFAULT_TEMPERATURE,
	DEFAULT_TLDR_CALLOUT_AT_TOP,
	DEFAULT_TRANSCRIPT_FAILURE_MODE,
	DEFAULT_TRANSCRIPT_LANGUAGE_MODE,
	DEFAULT_USE_VIDEO_TITLE_AS_NOTE_NAME,
} from '../defaults';
import { isInstructionTemplate } from './templates';

function normalizeOneOf<T extends string>(value: unknown, allowedValues: readonly T[], fallback: T): T {
	return allowedValues.includes(value as T) ? (value as T) : fallback;
}

const VALID_INSTRUCTION_MODES: readonly InstructionMode[] = ['template', 'manual'];
const VALID_TRANSCRIPT_MODES: readonly OutputDefaults['transcriptMode'][] = [
	'none',
	'raw',
	'readable',
	'timestamped',
];
const VALID_REASONING_MODES: readonly ReasoningMode[] = ['on', 'off', 'provider-default'];
const VALID_REASONING_SUPPORT_VALUES: readonly ReasoningSupport[] = ['supported', 'unsupported', 'unknown'];
const VALID_PLAYLIST_MODES: readonly PlaylistMode[] = ['per-video', 'combined'];
const VALID_NOTE_DESTINATION_MODES: readonly NoteDestinationMode[] = [
	'current-note',
	'folder',
	'append-to-active-note',
];
const VALID_TRANSCRIPT_LANGUAGE_MODES: readonly TranscriptLanguageMode[] = ['auto', 'preferred'];
const VALID_TRANSCRIPT_FAILURE_MODES: readonly TranscriptFailureMode[] = ['skip', 'fail'];
const VALID_RUN_REPORT_LOCATIONS: readonly RunReportLocation[] = ['first-note', 'separate-note'];
const VALID_SOURCE_SECTION_POSITIONS: readonly SourceSectionPosition[] = ['top', 'bottom'];

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

function normalizeFrontmatterPropertyAllowlist(value?: string): string {
	return value?.trim() ?? DEFAULT_FRONTMATTER_PROPERTY_ALLOWLIST;
}

function normalizeInstructionConfig(instructionConfig?: Partial<InstructionConfig>): InstructionConfig {
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

function normalizeReasoningMode(reasoningMode?: ReasoningMode): ReasoningMode {
	return normalizeOneOf(reasoningMode, VALID_REASONING_MODES, DEFAULT_REASONING_MODE);
}

function normalizeReasoningSupport(reasoningSupport?: ReasoningSupport): ReasoningSupport {
	return normalizeOneOf(reasoningSupport, VALID_REASONING_SUPPORT_VALUES, 'unknown');
}

function normalizePlaylistMode(playlistMode?: PlaylistMode): PlaylistMode {
	return normalizeOneOf(playlistMode, VALID_PLAYLIST_MODES, DEFAULT_PLAYLIST_MODE);
}

function normalizeNoteDestinationMode(noteDestinationMode?: NoteDestinationMode): NoteDestinationMode {
	return normalizeOneOf(noteDestinationMode, VALID_NOTE_DESTINATION_MODES, DEFAULT_NOTE_DESTINATION_MODE);
}

function normalizeNoteDestinationFolder(noteDestinationFolder?: string): string {
	return noteDestinationFolder?.trim() ?? DEFAULT_NOTE_DESTINATION_FOLDER;
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

function normalizeRunReportLocation(runReportLocation?: RunReportLocation): RunReportLocation {
	return normalizeOneOf(runReportLocation, VALID_RUN_REPORT_LOCATIONS, DEFAULT_RUN_REPORT_LOCATION);
}

function normalizeSourceSectionPosition(value?: SourceSectionPosition): SourceSectionPosition {
	return normalizeOneOf(value, VALID_SOURCE_SECTION_POSITIONS, DEFAULT_SOURCE_SECTION_POSITION);
}

function normalizeFrontmatterTags(value?: string): string {
	return value?.trim() ?? DEFAULT_FRONTMATTER_TAGS;
}

function normalizeContextWindow(contextWindow?: number): number | undefined {
	if (!Number.isFinite(contextWindow) || (contextWindow ?? 0) <= 0) {
		return undefined;
	}

	return Math.round(contextWindow as number);
}

function normalizeOutputDefaults(outputDefaults?: Partial<OutputDefaults>): OutputDefaults {
	return {
		generateAiSummary: outputDefaults?.generateAiSummary ?? DEFAULT_GENERATE_AI_SUMMARY,
		transcriptMode: normalizeTranscriptMode(outputDefaults?.transcriptMode),
		playlistMode: normalizePlaylistMode(outputDefaults?.playlistMode),
		transcriptLanguageMode: normalizeTranscriptLanguageMode(outputDefaults?.transcriptLanguageMode),
		preferredTranscriptLanguage: normalizePreferredTranscriptLanguage(outputDefaults?.preferredTranscriptLanguage),
		transcriptFailureMode: normalizeTranscriptFailureMode(outputDefaults?.transcriptFailureMode),
		includeThumbnail: outputDefaults?.includeThumbnail ?? DEFAULT_INCLUDE_THUMBNAIL,
		includeRunReport: outputDefaults?.includeRunReport ?? DEFAULT_INCLUDE_RUN_REPORT,
		runReportLocation: normalizeRunReportLocation(outputDefaults?.runReportLocation),
		useVideoTitleAsNoteName: outputDefaults?.useVideoTitleAsNoteName ?? DEFAULT_USE_VIDEO_TITLE_AS_NOTE_NAME,
		noteDestinationMode: normalizeNoteDestinationMode(outputDefaults?.noteDestinationMode),
		noteDestinationFolder: normalizeNoteDestinationFolder(outputDefaults?.noteDestinationFolder),
		reasoningMode: normalizeReasoningMode(outputDefaults?.reasoningMode),
		includeFrontmatter: outputDefaults?.includeFrontmatter ?? DEFAULT_INCLUDE_FRONTMATTER,
		frontmatterTags: normalizeFrontmatterTags(outputDefaults?.frontmatterTags),
		frontmatterPropertyAllowlist: normalizeFrontmatterPropertyAllowlist(outputDefaults?.frontmatterPropertyAllowlist),
		sourceSectionPosition: normalizeSourceSectionPosition(outputDefaults?.sourceSectionPosition),
		linkTimestamps: outputDefaults?.linkTimestamps ?? DEFAULT_LINK_TIMESTAMPS,
		tldrCalloutAtTop: outputDefaults?.tldrCalloutAtTop ?? DEFAULT_TLDR_CALLOUT_AT_TOP,
	};
}

function normalizeTemperature(temperature?: number): number {
	if (!Number.isFinite(temperature)) {
		return DEFAULT_TEMPERATURE;
	}

	return Math.min(Math.max(temperature as number, 0), 2);
}

function normalizeRequestTimeoutMs(timeoutMs?: number): number {
	if (!Number.isFinite(timeoutMs) || (timeoutMs ?? 0) <= 0) {
		return DEFAULT_REQUEST_TIMEOUT_MS;
	}

	return Math.round(timeoutMs as number);
}

export class SettingsService implements PluginSettings {
	private settings: StoredSettings;

	constructor(private plugin: YTKN) {
		this.settings = this.getDefaultSettings();
	}

	async loadSettings(): Promise<void> {
		const loaded = (await this.plugin.loadData()) as { settings?: Partial<StoredSettings> & { outputDefaults?: Partial<StoredSettings['outputDefaults']> & { addAlias?: boolean } } } | undefined;
		const savedSettings = loaded?.settings;

		// One-shot migration: if the user previously set addAlias=false, honour that intent by
		// removing 'aliases' from frontmatterPropertyAllowlist before we drop the field entirely.
		if (savedSettings?.outputDefaults && savedSettings.outputDefaults.addAlias === false) {
			const raw = savedSettings.outputDefaults.frontmatterPropertyAllowlist
				?? DEFAULT_FRONTMATTER_PROPERTY_ALLOWLIST;
			savedSettings.outputDefaults.frontmatterPropertyAllowlist = raw
				.split(/[\s,]+/)
				.map((s) => s.trim())
				.filter((s) => s.length > 0 && s !== 'aliases')
				.join(' ');
		}

		const normalized: StoredSettings = {
			providers: this.normalizeProviders(savedSettings?.providers),
			selectedModelId: savedSettings?.selectedModelId ?? null,
			outputDefaults: normalizeOutputDefaults(savedSettings?.outputDefaults),
			instructionConfig: normalizeInstructionConfig(savedSettings?.instructionConfig),
			temperature: normalizeTemperature(savedSettings?.temperature),
			requestTimeoutMs: normalizeRequestTimeoutMs(savedSettings?.requestTimeoutMs),
		};

		this.settings = normalized;

		const needsSave = JSON.stringify(savedSettings ?? null) !== JSON.stringify(normalized);

		if (this.settings.selectedModelId && !this.validateModelId(this.settings.selectedModelId)) {
			this.settings.selectedModelId = null;
			await this.saveData();
			return;
		}

		if (needsSave) {
			await this.saveData();
		}
	}

	getSelectedModel(): ModelConfig | null {
		if (!this.settings.selectedModelId) {
			return null;
		}

		const found = this.findModelAndProvider(this.settings.selectedModelId);
		return found ? this.convertToModelConfig(found.model, found.provider) : null;
	}

	getProviders(): ProviderConfig[] {
		return this.settings.providers.map((provider) => ({
			name: provider.name,
			type: provider.type,
			apiKey: provider.apiKey,
			url: provider.url,
			models: provider.models.map((model) => this.convertToModelConfig(model, provider)),
		}));
	}

	getModels(): ModelConfig[] {
		return this.settings.providers.flatMap((provider) =>
			provider.models.map((model) => this.convertToModelConfig(model, provider)),
		);
	}

	getInstructionConfig(): InstructionConfig {
		return this.settings.instructionConfig;
	}

	getOutputDefaults(): OutputDefaults {
		return this.settings.outputDefaults;
	}

	getTemperature(): number {
		return this.settings.temperature;
	}

	getRequestTimeoutMs(): number {
		return this.settings.requestTimeoutMs;
	}

	async addProvider(provider: ProviderConfig): Promise<void> {
		const storedProvider: StoredProvider = {
			...this.normalizeProvider(provider),
			models: [],
		};

		this.assertProviderValid(storedProvider);
		this.settings.providers.push(storedProvider);
		await this.saveData();
	}

	async addModel(model: ModelConfig): Promise<void> {
		const normalizedModel = this.normalizeModel(model);
		const provider = this.settings.providers.find((item) => item.name === normalizedModel.provider.name);
		if (!provider) {
			throw new Error(`Provider "${normalizedModel.provider.name}" not found.`);
		}

		const storedModel: StoredModel = {
			name: normalizedModel.name,
			displayName: normalizedModel.displayName || normalizedModel.name,
			reasoningSupport: normalizeReasoningSupport(normalizedModel.reasoningSupport),
			contextWindow: normalizeContextWindow(normalizedModel.contextWindow),
		};

		this.assertNewModelValid(storedModel, provider);
		provider.models.push(storedModel);
		await this.saveData();
	}

	async mergeProviderModels(providerName: string, models: DiscoveredModel[]): Promise<number> {
		const provider = this.settings.providers.find((item) => item.name === providerName);
		if (!provider) {
			throw new Error(`Provider "${providerName}" not found.`);
		}

		let addedCount = 0;

		for (const model of models) {
			const name = model.name.trim();
			const displayName = model.displayName.trim() || name;
			const reasoningSupport = normalizeReasoningSupport(model.reasoningSupport);
			const contextWindow = normalizeContextWindow(model.contextWindow);

			if (!name) {
				continue;
			}

			const existingModel = provider.models.find((item) => item.name === name);
			if (existingModel) {
				existingModel.displayName = displayName;
				existingModel.reasoningSupport = reasoningSupport;
				existingModel.contextWindow = contextWindow;
				continue;
			}

			provider.models.push({
				name,
				displayName,
				reasoningSupport,
				contextWindow,
			});
			addedCount += 1;
		}

		if (addedCount || models.length) {
			await this.saveData();
		}

		return addedCount;
	}

	async updateProvider(provider: ProviderConfig, originalName: string): Promise<void> {
		const storedProvider = this.settings.providers.find((item) => item.name === originalName);
		if (!storedProvider) {
			throw new Error(`Provider "${originalName}" not found.`);
		}

		const updatedProvider: StoredProvider = {
			...this.normalizeProvider(provider),
			models: storedProvider.models,
		};

		this.assertProviderValid(updatedProvider, originalName);

		const index = this.settings.providers.indexOf(storedProvider);
		this.settings.providers[index] = updatedProvider;

		if (this.settings.selectedModelId?.startsWith(`${originalName}:`) && originalName !== updatedProvider.name) {
			const selectedModel = this.parseModelId(this.settings.selectedModelId);
			if (selectedModel) {
				this.settings.selectedModelId = this.makeModelId(updatedProvider.name, selectedModel.modelName);
			}
		}

		await this.saveData();
	}

	async updateModel(modelName: string, modelDisplayName: string, providerName: string): Promise<void> {
		const provider = this.settings.providers.find((item) => item.name === providerName);
		if (!provider) {
			throw new Error(`Provider "${providerName}" not found.`);
		}

		const model = provider.models.find((item) => item.name === modelName);
		if (!model) {
			throw new Error(`Model "${modelName}" not found.`);
		}

		const trimmedName = modelName.trim();
		const trimmedDisplay = (modelDisplayName || modelName).trim();
		if (!trimmedName || !trimmedDisplay) {
			throw new Error('Model name and display name are required.');
		}

		model.displayName = trimmedDisplay;
		await this.saveData();
	}

	async deleteProvider(provider: ProviderConfig): Promise<void> {
		const index = this.settings.providers.findIndex((item) => item.name === provider.name);
		if (index === -1) {
			throw new Error(`Provider "${provider.name}" not found.`);
		}

		this.settings.providers.splice(index, 1);

		if (this.settings.selectedModelId?.startsWith(`${provider.name}:`)) {
			this.settings.selectedModelId = null;
		}

		await this.saveData();
	}

	async deleteModel(providerName: string, modelName: string): Promise<void> {
		const provider = this.settings.providers.find((item) => item.name === providerName);
		if (!provider) {
			throw new Error(`Provider "${providerName}" not found.`);
		}

		const index = provider.models.findIndex((item) => item.name === modelName);
		if (index === -1) {
			throw new Error(`Model "${modelName}" not found.`);
		}

		if (this.settings.selectedModelId === this.makeModelId(providerName, modelName)) {
			this.settings.selectedModelId = null;
		}

		provider.models.splice(index, 1);
		await this.saveData();
	}

	async updateActiveModel(modelId: string): Promise<void> {
		this.settings.selectedModelId = modelId;
		await this.saveData();
	}

	async updateInstructionConfig(config: InstructionConfig): Promise<void> {
		this.settings.instructionConfig = normalizeInstructionConfig(config);
		await this.saveData();
	}

	async updateOutputDefaults(outputDefaults: OutputDefaults): Promise<void> {
		this.settings.outputDefaults = normalizeOutputDefaults(outputDefaults);
		await this.saveData();
	}

	async updateTemperature(temperature: number): Promise<void> {
		this.settings.temperature = normalizeTemperature(temperature);
		await this.saveData();
	}

	async updateRequestTimeoutMs(timeoutMs: number): Promise<void> {
		this.settings.requestTimeoutMs = normalizeRequestTimeoutMs(timeoutMs);
		await this.saveData();
	}

	async resetSettings(): Promise<void> {
		this.settings = this.getDefaultSettings();
		await this.saveData();
	}

	async saveProviderKey(providerName: string, key: string): Promise<void> {
		const provider = this.settings.providers.find((item) => item.name === providerName);
		if (!provider) {
			throw new Error(`Provider "${providerName}" not found.`);
		}

		provider.apiKey = key;
		await this.saveData();
	}

	validateModelId(modelId: string): boolean {
		const parsed = this.parseModelId(modelId);
		if (!parsed) {
			return false;
		}

		return this.findModelAndProvider(this.makeModelId(parsed.providerName, parsed.modelName)) !== null;
	}

	private getDefaultSettings(): StoredSettings {
		return {
			providers: [],
			selectedModelId: null,
			outputDefaults: normalizeOutputDefaults(),
			instructionConfig: normalizeInstructionConfig(),
			temperature: DEFAULT_TEMPERATURE,
			requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
		};
	}

	private normalizeProviders(providers?: StoredProvider[]): StoredProvider[] {
		return (providers ?? []).map((provider) => {
			// Migrate legacy 'openai' providers that had a custom URL to 'openai-compatible'.
			// Anyone using cloud OpenAI never sets a URL; a custom URL means local/compat server.
			const storedType = provider.type as string;
			const type =
				storedType === 'openai' && provider.url && !provider.url.includes('api.openai.com')
					? ('openai-compatible' as const)
					: provider.type;

			// For openai-compatible (including migrated), non-Ollama models pre-dating
			// capability detection may carry 'unknown' — treat as 'unsupported'.
			const isCompatNonOllama =
				type === 'openai-compatible' && !isOllamaEndpoint(provider.url ?? '');

			return {
				name: provider.name,
				type,
				apiKey: provider.apiKey ?? '',
				url: type === 'openai-compatible' ? provider.url : undefined,
				models: (provider.models ?? []).map((model) => {
					const rawSupport = normalizeReasoningSupport(model.reasoningSupport);
					const reasoningSupport =
						isCompatNonOllama && rawSupport === 'unknown' ? 'unsupported' : rawSupport;
					return {
						name: model.name,
						displayName: model.displayName || model.name,
						reasoningSupport,
						contextWindow: normalizeContextWindow(model.contextWindow),
					};
				}),
			};
		});
	}

	private async saveData(): Promise<void> {
		try {
			await this.plugin.saveData({ settings: this.settings });
		} catch (error) {
			console.error('Failed to save settings:', error);
			throw error;
		}
	}

	private normalizeProvider(provider: ProviderConfig): ProviderConfig {
		return {
			...provider,
			name: provider.name.trim(),
			apiKey: provider.apiKey.trim(),
			url: provider.url?.trim() || undefined,
		};
	}

	private normalizeModel(model: ModelConfig): ModelConfig {
		return {
			...model,
			name: model.name.trim(),
			displayName: model.displayName?.trim() || undefined,
			reasoningSupport: normalizeReasoningSupport(model.reasoningSupport),
			contextWindow: normalizeContextWindow(model.contextWindow),
			provider: this.normalizeProvider(model.provider),
		};
	}

	private assertProviderValid(provider: StoredProvider, originalName?: string): void {
		if (!provider.name || !provider.type) {
			throw new Error('Invalid provider configuration');
		}

		if (provider.name.includes(':')) {
			throw new Error('Provider name cannot contain a colon.');
		}

		const existingProvider = this.settings.providers.find((item) => item.name === provider.name);
		if (existingProvider && (!originalName || provider.name !== originalName)) {
			throw new Error('Provider names must be unique.');
		}

		if (provider.type === 'openai' && !provider.apiKey) {
			throw new Error('OpenAI providers require an API key.');
		}

		if (provider.type === 'openai-compatible' && !provider.url) {
			throw new Error('OpenAI-compatible providers require a URL.');
		}

		if ((provider.type === 'anthropic' || provider.type === 'gemini') && !provider.apiKey) {
			throw new Error(`${provider.type === 'anthropic' ? 'Anthropic' : 'Gemini'} providers require an API key.`);
		}
	}

	private assertNewModelValid(model: StoredModel, provider: StoredProvider): void {
		if (!model.name || !model.displayName) {
			throw new Error('Model name and display name are required.');
		}

		if (provider.models.some((item) => item.name === model.name)) {
			throw new Error('Model names must be unique within a provider.');
		}
	}

	private findModelAndProvider(modelId: string): { model: StoredModel; provider: StoredProvider } | null {
		const parsed = this.parseModelId(modelId);
		if (!parsed) {
			return null;
		}

		const provider = this.settings.providers.find((item) => item.name === parsed.providerName);
		if (!provider) {
			return null;
		}

		const model = provider.models.find((item) => item.name === parsed.modelName);
		return model ? { model, provider } : null;
	}

	private convertToModelConfig(model: StoredModel, provider: StoredProvider): ModelConfig {
		return {
			name: model.name,
			displayName: model.displayName,
			reasoningSupport: model.reasoningSupport,
			contextWindow: model.contextWindow,
			provider: {
				name: provider.name,
				type: provider.type,
				apiKey: provider.apiKey,
				url: provider.url,
			},
		};
	}

	private parseModelId(modelId: string): { providerName: string; modelName: string } | null {
		// Provider names cannot contain a colon (enforced in assertProviderValid),
		// so the first colon always separates provider from model. Model names
		// may contain colons (e.g. Ollama tags like "qwen3:4b").
		const separatorIndex = modelId.indexOf(':');
		if (separatorIndex <= 0) {
			return null;
		}

		const providerName = modelId.slice(0, separatorIndex);
		const modelName = modelId.slice(separatorIndex + 1);
		if (!providerName || !modelName) {
			return null;
		}

		return { providerName, modelName };
	}

	private makeModelId(provider: string, model: string): string {
		return `${provider}:${model}`;
	}
}
