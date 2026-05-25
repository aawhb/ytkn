import { Notice } from 'obsidian';
import { ModelConfig, ProviderConfig } from '../../types';
import { YTKN } from '../../main';
import { discoverProviderModels } from '../../services/providers/discovery';
import { SettingsModalsFactory } from '../modals/SettingsModalsFactory';
import { notifyError } from '../notifications';

export interface UICallbacks {
	onModelAdded?: (model: ModelConfig) => void;
	onModelDeleted?: (model: ModelConfig) => void;
	onModelUpdated?: (model: ModelConfig) => void;
	onProviderAdded?: (provider: ProviderConfig) => void;
	onProviderDeleted?: (provider: ProviderConfig) => void;
	onProviderUpdated?: (provider: ProviderConfig, originalName: string) => void;
	onProviderModelsFetched?: (provider: ProviderConfig) => void;
	onSettingsReset?: () => void;
	onActiveModelChanged?: () => void;
}

export class SettingsEventHandlers {
	constructor(
		private plugin: YTKN,
		private settingsModalsFactory: SettingsModalsFactory,
		private callbacks: UICallbacks = {},
	) { }

	async handleModelSelection(value: string): Promise<void> {
		try {
			if (!this.plugin.settings.validateModelId(value)) {
				console.error('Could not save active model:', value, 'Invalid model ID');
				return;
			}

			await this.plugin.settings.updateActiveModel(value);
			this.callbacks.onActiveModelChanged?.();
		} catch (error) {
			notifyError('Failed to set active model', error, 'Selected model:', value);
		}
	}

	handleAccordionToggle(accordion: HTMLElement): void {
		const content = accordion.querySelector('.ytkn-settings__provider-content');
		const icon = accordion.querySelector('.ytkn-settings__collapse-icon');

		if (!content || !icon) {
			return;
		}

		const isExpanded = accordion.hasClass('is-expanded');
		accordion.toggleClass('is-expanded', !isExpanded);

		const siblingAccordions = accordion.parentElement?.querySelectorAll('.ytkn-settings__provider-accordion') ?? [];
		siblingAccordions.forEach((otherAccordion) => {
			if (otherAccordion !== accordion) {
				otherAccordion.removeClass('is-expanded');
			}
		});
	}

	async handleProviderAdd(provider: ProviderConfig): Promise<void> {
		try {
			await this.plugin.settings.addProvider(provider);
			this.callbacks.onProviderAdded?.(provider);
		} catch (error) {
			notifyError('Failed to add provider', error);
			throw error;
		}
	}

	async handleProviderEdit(provider: ProviderConfig, originalName: string): Promise<void> {
		try {
			await this.plugin.settings.updateProvider(provider, originalName);
			this.callbacks.onProviderUpdated?.(provider, originalName);
			new Notice(`Provider ${provider.name} updated successfully`);
		} catch (error) {
			notifyError('Failed to update provider', error);
			throw error;
		}
	}

	handleProviderDeleteClick(provider: ProviderConfig): void {
		this.settingsModalsFactory.createDeleteProviderModal(provider, this).open();
	}

	async handleProviderDelete(provider: ProviderConfig): Promise<void> {
		try {
			await this.plugin.settings.deleteProvider(provider);
			this.callbacks.onProviderDeleted?.(provider);
			new Notice(`Provider ${provider.name} deleted successfully`);
		} catch (error) {
			notifyError('Failed to delete provider', error);
			throw error;
		}
	}

	async handleProviderUrlChange(provider: ProviderConfig, url: string): Promise<void> {
		const currentProvider = this.getCurrentProvider(provider.name);
		if (!currentProvider) {
			return;
		}

		const normalizedUrl = url.trim() || undefined;
		if ((currentProvider.url ?? undefined) === normalizedUrl) {
			return;
		}

		try {
			await this.plugin.settings.updateProvider({
				...currentProvider,
				url: normalizedUrl,
			}, currentProvider.name);
		} catch (error) {
			console.error('Failed to save provider URL:', error);
		}
	}

	async handleFetchProviderModels(provider: ProviderConfig): Promise<void> {
		const currentProvider = this.getCurrentProvider(provider.name);
		if (!currentProvider) {
			new Notice(`Provider ${provider.name} no longer exists.`);
			return;
		}

		try {
			const discoveredModels = await discoverProviderModels(currentProvider);
			const addedCount = await this.plugin.settings.mergeProviderModels(currentProvider.name, discoveredModels);

			if (!discoveredModels.length) {
				new Notice(`No models found for ${currentProvider.name}.`);
			} else if (!addedCount) {
				new Notice(`No new models found for ${currentProvider.name}.`);
			} else {
				new Notice(`Added ${addedCount} model${addedCount === 1 ? '' : 's'} to ${currentProvider.name}.`);
			}

			this.callbacks.onProviderModelsFetched?.(currentProvider);
		} catch (error) {
			notifyError('Failed to fetch models', error);
		}
	}

	async handleModelAdd(model: ModelConfig): Promise<void> {
		try {
			await this.plugin.settings.addModel(model);
			this.callbacks.onModelAdded?.(model);
		} catch (error) {
			notifyError('Failed to add model', error);
			throw error;
		}
	}

	async handleModelEdit(model: ModelConfig): Promise<void> {
		try {
			await this.plugin.settings.updateModel(
				model.name,
				model.displayName || model.name,
				model.provider.name,
			);
			this.callbacks.onModelUpdated?.(model);
		} catch (error) {
			notifyError('Failed to update model', error);
			throw error;
		}
	}

	async handleModelDelete(model: ModelConfig): Promise<void> {
		try {
			await this.plugin.settings.deleteModel(model.provider.name, model.name);
			this.callbacks.onModelDeleted?.(model);
		} catch (error) {
			notifyError('Failed to delete model', error);
			throw error;
		}
	}

	async handleResetSettings(): Promise<void> {
		try {
			await this.plugin.settings.resetSettings();
			this.callbacks.onSettingsReset?.();
		} catch (error) {
			console.error('Failed to reset settings:', error);
			throw error;
		}
	}

	handleModelEditClick(model: ModelConfig): void {
		this.settingsModalsFactory.createEditModelModal(model, this).open();
	}

	handleModelDeleteClick(model: ModelConfig): void {
		this.settingsModalsFactory.createDeleteModelModal(model, this).open();
	}

	handleProviderEditClick(provider: ProviderConfig): void {
		this.settingsModalsFactory.createEditProviderModal(provider, this).open();
	}

	handleAddModelClick(provider: ProviderConfig): void {
		this.settingsModalsFactory.createAddModelModal(provider, this).open();
	}

	async handleApiKeySecretChange(providerName: string, apiKeySecretId: string): Promise<void> {
		try {
			await this.plugin.settings.saveProviderSecretId(providerName, apiKeySecretId);
		} catch (error) {
			console.error('Failed to save API key secret:', error);
		}
	}

	private getCurrentProvider(providerName: string): ProviderConfig | null {
		return this.plugin.settings.getProviders().find((provider) => provider.name === providerName) ?? null;
	}
}
