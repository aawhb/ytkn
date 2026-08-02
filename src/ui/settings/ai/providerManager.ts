import type { App, ButtonComponent } from 'obsidian';
import { ConfirmationModal, Notice } from 'obsidian';
import { discoverProviderModels } from '../../../ai/providers/discovery';
import { DEFAULT_OPENAI_COMPATIBLE_URL } from '../../../defaults';
import { buildModelId } from '../../../modelId';
import type { ModelConfig, PluginSettings, ProviderConfig, ProviderType } from '../../../types';
import { getErrorMessage } from '../../../utils';
import { notifyError } from '../../shared/notifications';
import { ModelPickerModal } from '../../shared/modelPickerModal';
import { ModelFormModal } from './modals/modelForm';
import { ProviderFormModal } from './modals/providerForm';

interface ProviderReadiness {
	ready: boolean;
	message: string;
}

export interface ProviderPageChange {
	kind: 'renamed' | 'structure';
	providerName: string;
	previousName?: string;
}

type ProviderPageListener = (change: ProviderPageChange) => boolean;

export class ProviderManager {
	private activeProviderPageListener?: ProviderPageListener;

	constructor(
		private app: App,
		private settings: PluginSettings,
		private onStructureChanged: () => void,
		private onStateChanged: () => void = () => undefined,
	) {}

	getProvider(name: string): ProviderConfig | null {
		return this.settings.getProviders().find((provider) => provider.name === name) ?? null;
	}

	registerActiveProviderPage(listener: ProviderPageListener): () => void {
		this.activeProviderPageListener = listener;
		return () => {
			if (this.activeProviderPageListener === listener) this.activeProviderPageListener = undefined;
		};
	}

	refreshSettingsStructure(): void {
		this.onStructureChanged();
	}

	getReadiness(provider: ProviderConfig): ProviderReadiness {
		if (provider.type === 'openai-compatible') {
			return provider.url?.trim()
				? { ready: true, message: 'Ready to fetch models.' }
				: { ready: false, message: 'Add a base URL before fetching models.' };
		}

		if (!provider.apiKeySecretId) {
			return { ready: false, message: 'Select an API key secret before fetching models.' };
		}
		if (!provider.apiKey) {
			return { ready: false, message: 'The selected API key secret is empty or unavailable.' };
		}
		return { ready: true, message: 'Ready to fetch models.' };
	}

	hasUsableSelectedModel(): boolean {
		const selected = new Set(this.settings.getModelIds());
		return this.settings.getModels().some((model) =>
			selected.has(buildModelId(model)) && this.getReadiness(model.provider).ready,
		);
	}

	openAddProvider(): void {
		new ProviderFormModal(this.app, this).open();
	}

	async addProvider(provider: ProviderConfig): Promise<void> {
		try {
			await this.settings.addProvider(provider);
			this.onStructureChanged();
			new Notice(`Provider "${provider.name}" added.`);
		} catch (error) {
			notifyError("Couldn't add provider", error);
			throw error;
		}
	}

	async renameProvider(originalName: string, nextName: string): Promise<void> {
		const provider = this.getProvider(originalName);
		if (!provider) {
			throw new Error(`Provider "${originalName}" not found.`);
		}

		try {
			await this.settings.updateProvider({ ...provider, name: nextName }, originalName);
			const normalizedName = nextName.trim();
			this.notifyProviderPage({
				kind: 'renamed',
				providerName: normalizedName,
				previousName: originalName,
			});
			new Notice(`Provider renamed to "${normalizedName}".`);
		} catch (error) {
			notifyError("Couldn't rename provider", error);
			throw error;
		}
	}

	async updateProviderType(providerName: string, type: ProviderType): Promise<void> {
		const provider = this.getProvider(providerName);
		if (!provider) return;

		try {
			await this.settings.updateProvider({
				...provider,
				type,
				url: type === 'openai-compatible'
					? (provider.url?.trim() || DEFAULT_OPENAI_COMPATIBLE_URL)
					: undefined,
			}, providerName);
			this.notifyProviderPage({ kind: 'structure', providerName });
		} catch (error) {
			notifyError("Couldn't change provider type", error);
			throw error;
		}
	}

	async updateProviderUrl(providerName: string, url: string): Promise<void> {
		const provider = this.getProvider(providerName);
		if (!provider) return;
		const normalized = url.trim() || undefined;
		if (provider.url === normalized) return;

		try {
			await this.settings.updateProvider({ ...provider, url: normalized }, providerName);
			this.onStateChanged();
		} catch (error) {
			console.error('Failed to save provider URL:', error);
		}
	}

	async updateProviderSecret(providerName: string, secretId: string): Promise<void> {
		try {
			await this.settings.saveProviderSecretId(providerName, secretId);
			this.onStateChanged();
		} catch (error) {
			console.error('Failed to save API key secret:', error);
		}
	}

	async fetchModels(providerName: string, button?: ButtonComponent): Promise<void> {
		const provider = this.getProvider(providerName);
		if (!provider) {
			new Notice(`Provider ${providerName} no longer exists.`);
			return;
		}
		if (!this.getReadiness(provider).ready) {
			new Notice(this.getReadiness(provider).message);
			return;
		}

		button?.setDisabled(true).setButtonText('Fetching…');
		try {
			const discovered = await discoverProviderModels(provider);
			const addedCount = await this.settings.mergeProviderModels(providerName, discovered);
			if (!discovered.length) {
				new Notice(`No models found for ${providerName}.`);
			} else if (!addedCount) {
				new Notice(`No new models found for ${providerName}.`);
			} else {
				new Notice(`Added ${addedCount} model${addedCount === 1 ? '' : 's'} to ${providerName}.`);
			}
			this.notifyProviderPage({ kind: 'structure', providerName });
		} catch (error) {
			notifyError("Couldn't fetch models", error);
			button?.setDisabled(false).setButtonText('Fetch models');
		}
	}

	openAddModel(provider: ProviderConfig): void {
		new ModelFormModal(this.app, { kind: 'add', provider }, this).open();
	}

	openEditModel(model: ModelConfig): void {
		new ModelFormModal(this.app, { kind: 'edit', model }, this).open();
	}

	async addModel(model: ModelConfig): Promise<void> {
		try {
			await this.settings.addModel(model);
			this.notifyProviderPage({ kind: 'structure', providerName: model.provider.name });
		} catch (error) {
			notifyError("Couldn't add model", error);
			throw error;
		}
	}

	async editModel(model: ModelConfig): Promise<void> {
		try {
			await this.settings.updateModel(
				model.name,
				model.displayName || model.name,
				model.provider.name,
			);
			this.notifyProviderPage({ kind: 'structure', providerName: model.provider.name });
		} catch (error) {
			notifyError("Couldn't update model", error);
			throw error;
		}
	}

	openModelPicker(): void {
		const models = this.settings.getModels();
		if (!models.length) {
			new Notice('Add a model to a provider before adding it to model order.');
			return;
		}

		const selected = new Set(this.settings.getModelIds());
		const remaining = models.filter((model) => !selected.has(buildModelId(model)));
		if (!remaining.length) {
			new Notice('All available models are already in model order.');
			return;
		}
		new ModelPickerModal(this.app, remaining, async (modelId) => {
			await this.updateModelOrder([...this.settings.getModelIds(), modelId]);
		}).open();
	}

	async updateModelOrder(modelIds: string[]): Promise<void> {
		try {
			await this.settings.updateModelIds(modelIds);
			this.onStructureChanged();
		} catch (error) {
			notifyError("Couldn't update model order", error, 'Models:', modelIds.join(', '));
		}
	}

	confirmDeleteProvider(provider: ProviderConfig): void {
		const modelCount = provider.models?.length ?? 0;
		const warning = modelCount
			? ` This also deletes ${modelCount} associated model${modelCount === 1 ? '' : 's'} from the plugin.`
			: '';
		this.openConfirmation(
			'Delete provider?',
			`Delete the provider "${provider.name}"?${warning}`,
			async () => {
				await this.settings.deleteProvider(provider);
				this.onStructureChanged();
				new Notice(`Provider "${provider.name}" deleted.`);
			},
		);
	}

	confirmDeleteModel(model: ModelConfig): void {
		this.openConfirmation(
			'Delete model?',
			`Delete the model "${model.displayName || model.name}"?`,
			async () => {
				await this.settings.deleteModel(model.provider.name, model.name);
				this.notifyProviderPage({ kind: 'structure', providerName: model.provider.name });
			},
		);
	}

	private notifyProviderPage(change: ProviderPageChange): void {
		if (!this.activeProviderPageListener?.(change)) this.onStructureChanged();
	}

	private openConfirmation(title: string, content: string, action: () => Promise<void>): void {
		new ConfirmationModal(this.app)
			.setTitle(title)
			.setContent(content)
			.addCancelButton()
			.addButton((button) => button
				.setButtonText('Delete')
				.setDestructive()
				.setCta()
				.onClick(async () => {
					try {
						await action();
						return false;
					} catch (error) {
						notifyError("Couldn't delete item", error);
						new Notice(getErrorMessage(error));
						return true;
					}
				}))
			.open();
	}
}
