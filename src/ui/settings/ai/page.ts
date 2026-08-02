import type { App, SettingDefinitionItem } from 'obsidian';
import type { PluginSettings } from '../../../types';
import { AiGenerationDefinitions } from './generation';
import { getProviderAndModelDefinitions } from './providersAndModels';
import type { ProviderManager } from './providerManager';

interface AiPageContext {
	app: App;
	settings: PluginSettings;
	manager: ProviderManager;
	resetAiDefaults(): void;
}

export class AiSettingsPage {
	readonly generation: AiGenerationDefinitions;

	constructor(private context: AiPageContext) {
		this.generation = new AiGenerationDefinitions(context);
	}

	getDefinitions(): SettingDefinitionItem<string>[] {
		return [
			{
				type: 'group',
				cls: 'ytkn-settings__advisory',
				visible: () => this.context.settings.getOutputDefaults().useAi
					&& !this.context.manager.hasUsableSelectedModel(),
				items: [{
					name: 'AI needs a usable model',
					desc: 'Configure a ready provider, add a model, and include it in model order. AI output remains enabled, but generation cannot start until a usable model is selected.',
					render: (setting) => {
						setting
							.setName('AI needs a usable model')
							.setDesc('Configure a ready provider, add a model, and include it in model order. AI output remains enabled, but generation cannot start until a usable model is selected.');
						setting.settingEl.addClass('ytkn-settings__warning');
					},
				}],
			},
			...this.generation.getDefinitions(),
			...getProviderAndModelDefinitions({
				app: this.context.app,
				settings: this.context.settings,
				manager: this.context.manager,
			}),
			this.generation.getRequestDefinitions(),
			this.generation.getResetDefinition(),
		];
	}
}
