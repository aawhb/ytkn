import YTKN from '../main';
import {
	DiscoveredModel,
	InstructionConfig,
	ModelConfig,
	OutputDefaults,
	PluginSettings,
	ProviderConfig,
	RawStoredProvider,
	StoredModel,
	StoredProvider,
	StoredSettings,
} from '../types';
import {
	DEFAULT_FRONTMATTER_PROPERTY_ALLOWLIST,
	DEFAULT_REQUEST_TIMEOUT_MS,
	DEFAULT_TEMPERATURE,
} from '../defaults';
import { normalizeRequestTimeoutMs } from '../ai/providers/shared';
import {
	normalizeContextWindow,
	normalizeInstructionConfig,
	normalizeOutputDefaults,
	normalizeReleaseNotesVersion,
	normalizeTemperature,
	RawOutputDefaults,
} from './normalizeSettings';

interface SecretStorageLike {
	getSecret(id: string): string | null;
}

export class SettingsService implements PluginSettings {
	private settings: StoredSettings;
	private loadedSettingsExisted = false;

	constructor(private plugin: YTKN) {
		this.settings = this.getDefaultSettings();
	}

	async loadSettings(): Promise<void> {
		const loaded = (await this.plugin.loadData()) as { settings?: Partial<Omit<StoredSettings, 'providers'>> & { providers?: RawStoredProvider[]; outputDefaults?: RawOutputDefaults } } | undefined;
		const savedSettings = loaded?.settings;
		this.loadedSettingsExisted = savedSettings !== undefined;

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
			lastSeenReleaseNotesVersion: normalizeReleaseNotesVersion(savedSettings?.lastSeenReleaseNotesVersion),
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
			apiKey: this.resolveProviderApiKey(provider),
			apiKeySecretId: provider.apiKeySecretId,
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

	hasSavedSettings(): boolean {
		return this.loadedSettingsExisted;
	}

	getLastSeenReleaseNotesVersion(): string | null {
		return this.settings.lastSeenReleaseNotesVersion;
	}

	async setLastSeenReleaseNotesVersion(version: string): Promise<void> {
		this.settings.lastSeenReleaseNotesVersion = normalizeReleaseNotesVersion(version);
		await this.saveData();
	}

	async addProvider(provider: ProviderConfig): Promise<void> {
		const storedProvider: StoredProvider = {
			...this.normalizeStoredProvider(provider),
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
			const contextWindow = normalizeContextWindow(model.contextWindow);

			if (!name) {
				continue;
			}

			const existingModel = provider.models.find((item) => item.name === name);
			if (existingModel) {
				existingModel.displayName = displayName;
				existingModel.contextWindow = contextWindow;
				continue;
			}

			provider.models.push({
				name,
				displayName,
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
			...this.normalizeStoredProvider(provider, storedProvider),
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
		const lastSeenReleaseNotesVersion = this.settings.lastSeenReleaseNotesVersion;
		this.settings = this.getDefaultSettings();
		this.settings.lastSeenReleaseNotesVersion = lastSeenReleaseNotesVersion;
		await this.saveData();
	}

	async saveProviderSecretId(providerName: string, secretId: string): Promise<void> {
		const provider = this.settings.providers.find((item) => item.name === providerName);
		if (!provider) {
			throw new Error(`Provider "${providerName}" not found.`);
		}

		provider.apiKeySecretId = secretId.trim() || undefined;
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
			lastSeenReleaseNotesVersion: null,
		};
	}

	private normalizeProviders(providers?: RawStoredProvider[]): StoredProvider[] {
		return (providers ?? []).map((provider) => {
			// Migrate legacy 'openai' providers that had a custom URL to 'openai-compatible'.
			// Anyone using cloud OpenAI never sets a URL; a custom URL means local/compat server.
			const storedType = provider.type as string;
			const type =
				storedType === 'openai' && provider.url && !provider.url.includes('api.openai.com')
					? ('openai-compatible' as const)
					: provider.type;

			return {
				name: provider.name,
				type,
				apiKeySecretId: provider.apiKeySecretId?.trim() || undefined,
				url: type === 'openai-compatible' ? provider.url : undefined,
				models: (provider.models ?? []).map((model) => ({
					name: model.name,
					displayName: model.displayName || model.name,
					contextWindow: normalizeContextWindow(model.contextWindow),
				})),
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
			apiKeySecretId: provider.apiKeySecretId?.trim() || undefined,
			url: provider.url?.trim() || undefined,
		};
	}

	private normalizeStoredProvider(provider: ProviderConfig, existingProvider?: StoredProvider): Omit<StoredProvider, 'models'> {
		const normalized = this.normalizeProvider(provider);
		return {
			name: normalized.name,
			type: normalized.type,
			apiKeySecretId: normalized.apiKeySecretId ?? existingProvider?.apiKeySecretId,
			url: normalized.type === 'openai-compatible' ? normalized.url : undefined,
		};
	}

	private getSecretStorage(): SecretStorageLike | null {
		return (this.plugin.app as { secretStorage?: SecretStorageLike } | undefined)?.secretStorage ?? null;
	}

	private resolveProviderApiKey(provider: Pick<StoredProvider, 'apiKeySecretId'>): string {
		if (provider.apiKeySecretId) {
			const secret = this.getSecretStorage()?.getSecret(provider.apiKeySecretId);
			if (secret) {
				return secret;
			}
		}

		return '';
	}

	private normalizeModel(model: ModelConfig): ModelConfig {
		return {
			...model,
			name: model.name.trim(),
			displayName: model.displayName?.trim() || undefined,
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

		if (provider.type === 'openai' && !this.hasProviderApiKey(provider)) {
			throw new Error('OpenAI providers require an API key.');
		}

		if (provider.type === 'openai-compatible' && !provider.url) {
			throw new Error('OpenAI-compatible providers require a URL.');
		}

		if ((provider.type === 'anthropic' || provider.type === 'gemini') && !this.hasProviderApiKey(provider)) {
			throw new Error(`${provider.type === 'anthropic' ? 'Anthropic' : 'Gemini'} providers require an API key.`);
		}
	}

	private hasProviderApiKey(provider: StoredProvider): boolean {
		return Boolean(this.resolveProviderApiKey(provider));
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
			contextWindow: model.contextWindow,
			provider: {
				name: provider.name,
				type: provider.type,
				apiKey: this.resolveProviderApiKey(provider),
				apiKeySecretId: provider.apiKeySecretId,
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
