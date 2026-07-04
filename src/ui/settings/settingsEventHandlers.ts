import { Notice } from 'obsidian';
import type { ModelConfig, PluginSettings, ProviderConfig } from '../../types';
import { discoverProviderModels } from '../../ai/providers/discovery';
import type { SettingsModalsFactory } from './settingsModalsFactory';
import { notifyError } from '../shared/notifications';

export class SettingsEventHandlers {
	constructor(
		private settings: PluginSettings,
		private settingsModalsFactory: SettingsModalsFactory,
		private onChanged: () => void = () => undefined,
	) { }

	async handleModelChainChange(modelIds: string[]): Promise<void> {
		try {
			await this.settings.updateModelIds(modelIds);
			this.onChanged();
		} catch (error) {
			notifyError('Failed to update the AI model list', error, 'Models:', modelIds.join(', '));
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
			await this.settings.addProvider(provider);
			this.onChanged();
		} catch (error) {
			notifyError('Failed to add provider', error);
			throw error;
		}
	}

	async handleProviderEdit(provider: ProviderConfig, originalName: string): Promise<void> {
		try {
			await this.settings.updateProvider(provider, originalName);
			this.onChanged();
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
			await this.settings.deleteProvider(provider);
			this.onChanged();
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
			await this.settings.updateProvider({
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
			const addedCount = await this.settings.mergeProviderModels(currentProvider.name, discoveredModels);

			if (!discoveredModels.length) {
				new Notice(`No models found for ${currentProvider.name}.`);
			} else if (!addedCount) {
				new Notice(`No new models found for ${currentProvider.name}.`);
			} else {
				new Notice(`Added ${addedCount} model${addedCount === 1 ? '' : 's'} to ${currentProvider.name}.`);
			}

			this.onChanged();
		} catch (error) {
			notifyError('Failed to fetch models', error);
		}
	}

	async handleModelAdd(model: ModelConfig): Promise<void> {
		try {
			await this.settings.addModel(model);
			this.onChanged();
		} catch (error) {
			notifyError('Failed to add model', error);
			throw error;
		}
	}

	async handleModelEdit(model: ModelConfig): Promise<void> {
		try {
			await this.settings.updateModel(
				model.name,
				model.displayName || model.name,
				model.provider.name,
			);
			this.onChanged();
		} catch (error) {
			notifyError('Failed to update model', error);
			throw error;
		}
	}

	async handleModelDelete(model: ModelConfig): Promise<void> {
		try {
			await this.settings.deleteModel(model.provider.name, model.name);
			this.onChanged();
		} catch (error) {
			notifyError('Failed to delete model', error);
			throw error;
		}
	}

	async handleResetSettings(): Promise<void> {
		try {
			await this.settings.resetSettings();
			this.onChanged();
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
			await this.settings.saveProviderSecretId(providerName, apiKeySecretId);
		} catch (error) {
			console.error('Failed to save API key secret:', error);
		}
	}

	private getCurrentProvider(providerName: string): ProviderConfig | null {
		return this.settings.getProviders().find((provider) => provider.name === providerName) ?? null;
	}
}
