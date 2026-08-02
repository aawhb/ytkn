import type {
	App,
	ButtonComponent,
	SettingDefinitionItem,
	SettingDefinitionList,
	SettingDefinitionPage,
} from 'obsidian';
import { SecretComponent, SettingGroup, SettingPage } from 'obsidian';
import type { PluginSettings, ProviderConfig, ProviderType } from '../../../types';
import { DEFAULT_OPENAI_COMPATIBLE_URL } from '../../../defaults';
import { buildModelId } from '../../../modelId';
import { GENERATION_OPTIONS_SCHEMA as OPTIONS } from '../../shared/generationOptionsSchema';
import type { ProviderManager } from './providerManager';
import { sectionInfoButton } from '../sectionInfo';

const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
	'openai-compatible': 'OpenAI-compatible',
	anthropic: 'Anthropic',
	gemini: 'Google Gemini',
	openai: 'OpenAI',
};

interface AiProvidersContext {
	app: App;
	settings: PluginSettings;
	manager: ProviderManager;
}

export function getProviderAndModelDefinitions(
	context: AiProvidersContext,
): SettingDefinitionItem<string>[] {
	return [
		getProvidersDefinition(context),
		getModelOrderDefinition(context),
	];
}

function getProvidersDefinition(context: AiProvidersContext): SettingDefinitionList<string> {
	const providers = context.settings.getProviders();
	return {
		type: 'list',
		heading: 'Providers',
		cls: 'ytkn-settings__section-card ytkn-settings__native-list',
		extraButtons: [sectionInfoButton(
			'Connect the cloud services or local servers that make AI models available.',
		)],
		emptyState: 'No AI providers yet.',
		addItem: {
			name: 'Add provider',
			action: () => context.manager.openAddProvider(),
		},
		items: providers.map((provider) => getProviderPage(context, provider)),
		onDelete: (index) => {
			const provider = context.settings.getProviders()[index];
			if (provider) context.manager.confirmDeleteProvider(provider);
		},
	};
}

function getProviderPage(
	context: AiProvidersContext,
	provider: ProviderConfig,
): SettingDefinitionPage<string> {
	const readiness = () => context.manager.getReadiness(
		context.manager.getProvider(provider.name) ?? provider,
	);

	return {
		type: 'page',
		name: provider.name,
		desc: formatProviderSummary(provider),
		status: () => readiness().ready ? null : 'warning',
		page: () => new ProviderSettingsPage(context, provider.name),
	};
}

class ProviderSettingsPage extends SettingPage {
	constructor(
		private context: AiProvidersContext,
		private currentName: string,
	) {
		super();
		this.title = currentName;
	}

	display(): void {
		this.containerEl.empty();
		const provider = this.context.manager.getProvider(this.currentName);
		if (!provider) {
			new SettingGroup(this.containerEl)
				.addClass('ytkn-settings__advisory')
				.addSetting((setting) => {
					setting
						.setName('Provider no longer exists')
						.setDesc('Return to AI settings and select another provider.');
				});
			return;
		}

		this.title = provider.name;
		this.renderConnection(provider);
		this.renderModels(provider);
	}

	private renderConnection(provider: ProviderConfig): void {
		const group = new SettingGroup(this.containerEl)
			.setHeading('Connection')
			.addClass('ytkn-settings__section-card');
		let fetchButton: ButtonComponent | undefined;
		let readinessDescription: HTMLElement | undefined;
		const refreshReadiness = () => {
			const current = this.context.manager.getProvider(this.currentName) ?? provider;
			const readiness = this.context.manager.getReadiness(current);
			fetchButton?.setDisabled(!readiness.ready);
			if (readinessDescription) {
				readinessDescription.setText(readiness.message);
				readinessDescription.toggleClass('ytkn-settings__warning-text', !readiness.ready);
			}
		};

		group.addSetting((setting) => {
			let nextName = provider.name;
			setting
				.setName('Provider name')
				.setDesc('The provider name is also used as its model identity prefix.')
				.addText((text) => text
					.setValue(provider.name)
					.onChange((value) => (nextName = value)))
				.addButton((button) => button
					.setButtonText('Rename')
					.onClick(() => {
						void this.context.manager.renameProvider(this.currentName, nextName);
					}));
		});
		group.addSetting((setting) => {
			setting
				.setName('Provider type')
				.setDesc('Choose how the plugin connects to this provider. Changes save automatically.')
				.addDropdown((dropdown) => dropdown
					.addOptions(PROVIDER_TYPE_LABELS)
					.setValue(provider.type)
					.onChange((type) => {
						void this.context.manager.updateProviderType(
							this.currentName,
							type as ProviderType,
						);
					}));
		});
		group.addSetting((setting) => {
			setting
				.setName('API key')
				.setDesc(provider.type === 'openai-compatible'
					? 'Optional for local endpoints. Select an Obsidian secret when authentication is required.'
					: `Select the Obsidian secret for ${provider.name}.`)
				.addComponent((element) => new SecretComponent(this.context.app, element)
					.setValue(provider.apiKeySecretId ?? '')
					.onChange((value) => {
						void this.context.manager.updateProviderSecret(this.currentName, value)
							.then(refreshReadiness);
					}));
		});
		if (provider.type === 'openai-compatible') {
			group.addSetting((setting) => {
				setting
					.setName('Base URL')
					.setDesc('Base URL of the OpenAI-compatible endpoint. Changes save automatically.')
					.addText((text) => text
						.setPlaceholder(DEFAULT_OPENAI_COMPATIBLE_URL)
						.setValue(provider.url ?? '')
						.onChange((value) => {
							void this.context.manager.updateProviderUrl(this.currentName, value)
								.then(refreshReadiness);
						}));
			});
		}
		group.addSetting((setting) => {
			setting.setName('Fetch models');
			readinessDescription = setting.descEl;
			setting.addButton((button) => {
				fetchButton = button;
				button
					.setButtonText('Fetch models')
					.onClick(() => {
						void this.context.manager.fetchModels(this.currentName, button);
					});
			});
			refreshReadiness();
		});
	}

	private renderModels(provider: ProviderConfig): void {
		const group = new SettingGroup(this.containerEl)
			.setHeading('Models')
			.addClass('ytkn-settings__section-card', 'ytkn-settings__native-list')
			.addExtraButton((button) => button
				.setIcon('plus')
				.setTooltip('Add model')
				.onClick(() => this.context.manager.openAddModel(provider)));
		if (!provider.models?.length) {
			group.addSetting((setting) => {
				setting
					.setName('No models added yet')
					.setDesc('Fetch models from the provider or add one manually.');
			});
			return;
		}
		for (const model of provider.models) {
			group.addSetting((setting) => {
				setting
					.setName(model.displayName || model.name)
					.setDesc(model.name)
					.addExtraButton((button) => button
						.setIcon('pencil')
						.setTooltip('Edit model')
						.onClick(() => this.context.manager.openEditModel(model)))
					.addExtraButton((button) => button
						.setIcon('trash-2')
						.setTooltip('Delete model')
						.onClick(() => this.context.manager.confirmDeleteModel(model)));
			});
		}
	}
}

function getModelOrderDefinition(
	context: AiProvidersContext,
): SettingDefinitionList<string> {
	const modelsById = new Map(
		context.settings.getModels().map((model) => [buildModelId(model), model]),
	);
	const selectedIds = context.settings.getModelIds();
	return {
		type: 'list',
		heading: 'Model order',
		cls: 'ytkn-settings__section-card ytkn-settings__native-list',
		extraButtons: [sectionInfoButton(
			'Choose the first model to try and the fallback order used when a request fails.',
		)],
		emptyState: context.settings.getModels().length
			? 'No models selected.'
			: OPTIONS.modelOrder.unavailableDesc,
		addItem: {
			name: OPTIONS.modelOrder.addLabel,
			action: () => context.manager.openModelPicker(),
		},
		items: selectedIds.flatMap((modelId) => {
			const model = modelsById.get(modelId);
			return model ? [{
				name: model.displayName || model.name,
				desc: model.provider.name,
				action: () => context.manager.openEditModel(model),
			}] : [];
		}),
		onReorder: (oldIndex, newIndex) => {
			const next = context.settings.getModelIds();
			const [moved] = next.splice(oldIndex, 1);
			if (moved !== undefined) {
				next.splice(newIndex, 0, moved);
				void context.manager.updateModelOrder(next);
			}
		},
		onDelete: (index) => {
			const next = context.settings.getModelIds();
			next.splice(index, 1);
			void context.manager.updateModelOrder(next);
		},
	};
}

function formatProviderSummary(provider: ProviderConfig): string {
	const modelCount = provider.models?.length ?? 0;
	return `${PROVIDER_TYPE_LABELS[provider.type]} · ${modelCount} model${modelCount === 1 ? '' : 's'}`;
}
