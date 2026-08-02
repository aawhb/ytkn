import type {
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
import { DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_TEMPERATURE } from '../defaults';
import { normalizeRequestTimeoutMs } from '../ai/providers/shared';
import { formatModelId, parseModelId } from '../modelId';
import type { RawOutputDefaults } from './normalizeSettings';
import {
	normalizeContextWindow,
	normalizeInstructionConfig,
	normalizeOutputDefaults,
	normalizeReleaseNotesVersion,
	normalizeTemperature,
} from './normalizeSettings';

interface SecretStorageLike {
	getSecret(id: string): string | null;
}

interface SettingsHost {
	app: unknown;
	loadData(): Promise<unknown>;
	saveData(data: unknown): Promise<void>;
}

type RawStoredSettings = Partial<StoredSettings> & {
	providers?: RawStoredProvider[];
	outputDefaults?: RawOutputDefaults;
};

export class SettingsService implements PluginSettings {
	private settings: StoredSettings;
	private loadedSettingsExisted = false;

	constructor(private host: SettingsHost) {
		this.settings = this.getDefaultSettings();
	}

	async loadSettings(): Promise<void> {
		const loaded = (await this.host.loadData()) as { settings?: RawStoredSettings } | undefined;
		const savedSettings = loaded?.settings;
		this.loadedSettingsExisted = savedSettings !== undefined;

		const savedModelIds = Array.isArray(savedSettings?.modelIds)
			? savedSettings.modelIds.filter((id): id is string => typeof id === 'string')
			: [];

		const normalized: StoredSettings = {
			providers: this.normalizeProviders(savedSettings?.providers),
			modelIds: savedModelIds,
			outputDefaults: normalizeOutputDefaults(savedSettings?.outputDefaults),
			instructionConfig: normalizeInstructionConfig(savedSettings?.instructionConfig),
			temperature: normalizeTemperature(savedSettings?.temperature),
			requestTimeoutMs: normalizeRequestTimeoutMs(savedSettings?.requestTimeoutMs),
			lastSeenReleaseNotesVersion: normalizeReleaseNotesVersion(savedSettings?.lastSeenReleaseNotesVersion),
		};

		this.settings = normalized;
		this.pruneModelChain();

		const needsSave = JSON.stringify(savedSettings ?? null) !== JSON.stringify(this.settings);
		if (needsSave) {
			await this.saveData();
		}
	}

	getSelectedModels(): ModelConfig[] {
		const resolved: ModelConfig[] = [];
		for (const modelId of this.settings.modelIds) {
			const found = this.findModelAndProvider(modelId);
			if (found) {
				resolved.push(this.convertToModelConfig(found.model, found.provider));
			}
		}
		return resolved;
	}

	getModelIds(): string[] {
		return [...this.settings.modelIds];
	}

	async updateModelIds(modelIds: string[]): Promise<void> {
		this.settings.modelIds = modelIds;
		this.pruneModelChain();
		await this.saveData();
	}

	private pruneModelChain(): void {
		const seen = new Set<string>();
		this.settings.modelIds = this.settings.modelIds.filter((modelId) => {
			if (seen.has(modelId) || !this.validateModelId(modelId)) {
				return false;
			}
			seen.add(modelId);
			return true;
		});
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

		this.assertProviderIdentityValid(storedProvider);
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
				existingModel.contextWindow = contextWindow ?? existingModel.contextWindow;
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

		this.assertProviderIdentityValid(updatedProvider, originalName);

		const index = this.settings.providers.indexOf(storedProvider);
		this.settings.providers[index] = updatedProvider;

		if (originalName !== updatedProvider.name) {
			this.settings.modelIds = this.settings.modelIds.map((modelId) => {
				const parsed = parseModelId(modelId);
				return parsed && parsed.providerName === originalName
					? formatModelId(updatedProvider.name, parsed.modelName)
					: modelId;
			});
		}
		this.pruneModelChain();

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
		this.pruneModelChain();

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

		provider.models.splice(index, 1);
		this.pruneModelChain();
		await this.saveData();
	}

	async updateInstructionConfig(patch: Partial<InstructionConfig>): Promise<void> {
		this.settings.instructionConfig = normalizeInstructionConfig({
			...this.settings.instructionConfig,
			...patch,
		});
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

	async resetGeneralDefaults(): Promise<void> {
		const defaults = normalizeOutputDefaults();
		this.settings.outputDefaults = {
			...defaults,
			useAi: this.settings.outputDefaults.useAi,
			generateAiSummary: this.settings.outputDefaults.generateAiSummary,
			tldrCalloutAtTop: this.settings.outputDefaults.tldrCalloutAtTop,
		};
		await this.saveData();
	}

	async resetAiDefaults(): Promise<void> {
		const defaults = normalizeOutputDefaults();
		this.settings.outputDefaults = {
			...this.settings.outputDefaults,
			useAi: defaults.useAi,
			generateAiSummary: defaults.generateAiSummary,
			tldrCalloutAtTop: defaults.tldrCalloutAtTop,
		};
		this.settings.instructionConfig = normalizeInstructionConfig();
		this.settings.temperature = DEFAULT_TEMPERATURE;
		this.settings.requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS;
		await this.saveData();
	}

	async resetAllSettings(): Promise<void> {
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
		const parsed = parseModelId(modelId);
		if (!parsed) {
			return false;
		}

		return this.findModelAndProvider(formatModelId(parsed.providerName, parsed.modelName)) !== null;
	}

	private getDefaultSettings(): StoredSettings {
		return {
			providers: [],
			modelIds: [],
			outputDefaults: normalizeOutputDefaults(),
			instructionConfig: normalizeInstructionConfig(),
			temperature: DEFAULT_TEMPERATURE,
			requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
			lastSeenReleaseNotesVersion: null,
		};
	}

	private normalizeProviders(providers?: RawStoredProvider[]): StoredProvider[] {
		return (providers ?? []).map((provider) => ({
				name: provider.name,
				type: provider.type,
				apiKeySecretId: provider.apiKeySecretId?.trim() || undefined,
				url: provider.type === 'openai-compatible' ? provider.url : undefined,
				models: (provider.models ?? []).map((model) => ({
					name: model.name,
					displayName: model.displayName || model.name,
					contextWindow: normalizeContextWindow(model.contextWindow),
				})),
			}));
	}

	private async saveData(): Promise<void> {
		try {
			await this.host.saveData({ settings: this.settings });
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
		return (this.host.app as { secretStorage?: SecretStorageLike } | undefined)?.secretStorage ?? null;
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

	private assertProviderIdentityValid(provider: StoredProvider, originalName?: string): void {
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
		const parsed = parseModelId(modelId);
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

}
