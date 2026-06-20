import type { App } from 'obsidian';
import type { ModelConfig, ProviderConfig } from '../../types';
import { ModelFormModal, type ModelFormActions } from './providerModals/modelFormModal';
import { ProviderFormModal, type ProviderFormActions } from './providerModals/providerFormModal';
import { ConfirmModal } from './confirmModal';

export interface SettingsModalActions extends ModelFormActions, ProviderFormActions {
	handleModelDelete(model: ModelConfig): Promise<void>;
	handleProviderDelete(provider: ProviderConfig): Promise<void>;
}

export class SettingsModalsFactory {
	constructor(private app: App) { }

	createAddProviderModal(handlers: SettingsModalActions): ProviderFormModal {
		return new ProviderFormModal(this.app, { kind: 'add' }, handlers);
	}

	createEditProviderModal(provider: ProviderConfig, handlers: SettingsModalActions): ProviderFormModal {
		return new ProviderFormModal(
			this.app,
			{ kind: 'edit', provider, originalName: provider.name },
			handlers,
		);
	}

	createDeleteProviderModal(provider: ProviderConfig, handlers: SettingsModalActions): ConfirmModal {
		const modelCount = provider.models?.length ?? 0;
		const warning = modelCount > 0
			? ` This provider has ${modelCount} associated model${modelCount === 1 ? '' : 's'}, which will also be deleted.`
			: '';
		return new ConfirmModal(
			this.app,
			'Delete Provider',
			`Are you sure you want to delete the provider "${provider.name}"?${warning}`,
			'Delete',
			async () => {
				try {
					await handlers.handleProviderDelete(provider);
				} catch (error) {
					console.error('Failed to delete provider:', error);
				}
			},
		);
	}

	createAddModelModal(provider: ProviderConfig, handlers: SettingsModalActions): ModelFormModal {
		return new ModelFormModal(this.app, { kind: 'add', provider }, handlers);
	}

	createEditModelModal(model: ModelConfig, handlers: SettingsModalActions): ModelFormModal {
		return new ModelFormModal(this.app, { kind: 'edit', model }, handlers);
	}

	createDeleteModelModal(model: ModelConfig, handlers: SettingsModalActions): ConfirmModal {
		const displayName = model.displayName || model.name;
		return new ConfirmModal(
			this.app,
			'Delete Model',
			`Are you sure you want to delete the model "${displayName}"?`,
			'Delete',
			async () => {
				try {
					await handlers.handleModelDelete(model);
				} catch (error) {
					console.error('Failed to delete model:', error);
				}
			},
		);
	}
}
