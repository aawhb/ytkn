import { App } from 'obsidian';
import { ModelConfig, ProviderConfig } from '../../types';
import { ModelFormModal } from './ModelFormModal';
import { ProviderFormModal } from './ProviderFormModal';
import { ConfirmModal } from './ConfirmModal';
import { SettingsEventHandlers } from '../handlers/SettingsEventHandlers';

export class SettingsModalsFactory {
	constructor(private app: App) { }

	createAddProviderModal(handlers: SettingsEventHandlers): ProviderFormModal {
		return new ProviderFormModal(this.app, { kind: 'add' }, handlers);
	}

	createEditProviderModal(provider: ProviderConfig, handlers: SettingsEventHandlers): ProviderFormModal {
		return new ProviderFormModal(
			this.app,
			{ kind: 'edit', provider, originalName: provider.name },
			handlers,
		);
	}

	createDeleteProviderModal(provider: ProviderConfig, handlers: SettingsEventHandlers): ConfirmModal {
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

	createAddModelModal(provider: ProviderConfig, handlers: SettingsEventHandlers): ModelFormModal {
		return new ModelFormModal(this.app, { kind: 'add', provider }, handlers);
	}

	createEditModelModal(model: ModelConfig, handlers: SettingsEventHandlers): ModelFormModal {
		return new ModelFormModal(this.app, { kind: 'edit', model }, handlers);
	}

	createDeleteModelModal(model: ModelConfig, handlers: SettingsEventHandlers): ConfirmModal {
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
