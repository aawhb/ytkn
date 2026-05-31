import { App, SecretComponent, Setting, setIcon } from 'obsidian';
import { ProviderConfig } from '../../types';
import { SettingsEventHandlers } from '../handlers/SettingsEventHandlers';
import { buildModelId } from '../../utils';
import { DEFAULT_OPENAI_COMPATIBLE_URL } from '../../defaults';

interface AccordionElements {
	accordion: HTMLElement;
	content: HTMLElement;
	header: HTMLElement;
	fetchButton: HTMLElement;
	editButton: HTMLElement;
	deleteButton: HTMLElement;
}

export function createSettingsCard(
	containerEl: HTMLElement,
	title: string,
	render: (body: HTMLElement) => void,
	headingLevel: 'h3' | 'h4' = 'h3',
): HTMLElement {
	const wrapper = containerEl.createDiv({ cls: 'ytkn-card ytkn-settings__group' });
	wrapper.createEl(headingLevel, { cls: 'ytkn-card__title ytkn-settings__group-title', text: title });

	const body = wrapper.createDiv({ cls: 'ytkn-card__body ytkn-settings__group-cards' });
	render(body);
	return wrapper;
}

export class SettingsUIComponents {
	constructor(private app: App) { }

	createProviderAccordion(parent: HTMLElement, provider: ProviderConfig): AccordionElements {
		const accordion = parent.createDiv({ cls: 'ytkn-settings__provider-accordion' });
		accordion.setAttribute('data-provider-name', provider.name);

		const headerSetting = new Setting(accordion)
			.setName(provider.name)
			.setDesc(formatProviderSummary(provider));
		const header = headerSetting.settingEl;
		header.addClass('ytkn-settings__provider-header');
		header.addClass('ytkn-setting-row--fit-control');
		headerSetting.infoEl.addClass('ytkn-settings__provider-info');
		headerSetting.nameEl.addClass('ytkn-settings__provider-title');
		headerSetting.descEl.addClass('ytkn-settings__provider-description');

		const headerControls = headerSetting.controlEl;
		headerControls.addClass('ytkn-settings__provider-controls');
		const fetchButton = headerControls.createEl('button', {
			cls: 'clickable-icon ytkn-settings__provider-fetch',
			attr: { 'aria-label': 'Fetch models' },
		});
		setIcon(fetchButton, 'refresh-cw');

		const editButton = headerControls.createEl('button', {
			cls: 'clickable-icon ytkn-settings__provider-edit',
			attr: { 'aria-label': 'Edit provider' },
		});
		setIcon(editButton, 'pencil');

		const deleteButton = headerControls.createEl('button', {
			cls: 'clickable-icon ytkn-settings__provider-delete',
			attr: { 'aria-label': 'Delete provider' },
		});
		setIcon(deleteButton, 'trash');

		const iconEl = headerControls.createDiv({ cls: 'ytkn-settings__collapse-icon' });
		setIcon(iconEl, 'chevron-down');

		const content = accordion.createDiv({ cls: 'ytkn-settings__provider-content' });
		return { accordion, content, header, fetchButton, editButton, deleteButton };
	}

	createApiKeySetting(container: HTMLElement, provider: ProviderConfig, handlers: SettingsEventHandlers): Setting {
		const setting = new Setting(container)
			.setName('API key')
			.setDesc(`Select the Obsidian secret for ${provider.name}`)
			.addComponent((el) => new SecretComponent(this.app, el)
				.setValue(provider.apiKeySecretId ?? '')
				.onChange(async (value) => {
					await handlers.handleApiKeySecretChange(provider.name, value);
				}));
		setting.settingEl.addClass('ytkn-settings__provider-field');
		return setting;
	}

	addProviderAccordion(accordionsContainer: HTMLElement, provider: ProviderConfig, handlers: SettingsEventHandlers): void {
		const { accordion, content, header, fetchButton, editButton, deleteButton } =
			this.createProviderAccordion(accordionsContainer, provider);

		header.addEventListener('click', (event) => {
			if (
				!fetchButton.contains(event.target as Node) &&
				!editButton.contains(event.target as Node) &&
				!deleteButton.contains(event.target as Node)
			) {
				handlers.handleAccordionToggle(accordion);
			}
		});

		fetchButton.addEventListener('click', () => {
			void handlers.handleFetchProviderModels(provider);
		});
		editButton.addEventListener('click', () => handlers.handleProviderEditClick(provider));
		deleteButton.addEventListener('click', () => handlers.handleProviderDeleteClick(provider));

		const fields = content.createDiv({ cls: 'ytkn-settings__provider-fields' });
		this.createApiKeySetting(fields, provider, handlers);

		const urlSetting = new Setting(fields)
			.setName('URL')
			.setDesc(provider.type === 'openai-compatible' ? 'Base URL for OpenAI-compatible providers like Ollama.' : 'Optional custom API URL.')
			.addText((text) =>
				text
					.setPlaceholder(provider.type === 'openai-compatible' ? DEFAULT_OPENAI_COMPATIBLE_URL : 'Optional custom URL')
					.setValue(provider.url ?? '')
					.onChange(async (value) => {
						await handlers.handleProviderUrlChange(provider, value);
					}),
			);
		urlSetting.settingEl.addClass('ytkn-settings__provider-field');

		const modelsSection = content.createDiv({ cls: 'ytkn-settings__models-section' });
		const modelsHeader = new Setting(modelsSection)
			.setName('Models')
			.addButton((button) =>
				button
					.setButtonText('Fetch models')
					.onClick(() => {
						void handlers.handleFetchProviderModels(provider);
					}),
			)
			.addButton((button) =>
				button
					.setButtonText('Add model')
					.onClick(() => {
						handlers.handleAddModelClick(provider);
					}),
			);
		modelsHeader.settingEl.addClass('ytkn-settings__models-header');

		const modelsList = modelsSection.createDiv({ cls: 'ytkn-settings__models-list' });
		if (!provider.models?.length) {
			modelsList.createDiv({
				text: 'No models added yet. Fetch them from the provider or add one manually.',
				cls: 'ytkn-settings__empty-state',
			});
		}

		for (const model of provider.models ?? []) {
			const modelItem = modelsList.createDiv({ cls: 'setting-item setting-model ytkn-setting-row--model' });
			modelItem.setAttribute('data-model-id', buildModelId(model));

			const info = modelItem.createDiv({ cls: 'setting-item-info' });
			info.createDiv({ cls: 'setting-item-name' }).createSpan({ text: model.displayName || model.name });

			const control = modelItem.createDiv({ cls: 'setting-item-control' });
			const modelEditButton = control.createEl('button', {
				cls: 'clickable-icon',
				attr: { 'aria-label': 'Edit model' },
			});
			setIcon(modelEditButton, 'pencil');

			const modelDeleteButton = control.createEl('button', {
				cls: 'clickable-icon',
				attr: { 'aria-label': 'Delete model' },
			});
			setIcon(modelDeleteButton, 'trash');

			modelEditButton.addEventListener('click', () => handlers.handleModelEditClick(model));
			modelDeleteButton.addEventListener('click', () => handlers.handleModelDeleteClick(model));
		}
	}
}

function formatProviderSummary(provider: ProviderConfig): string {
	const modelCount = provider.models?.length ?? 0;
	return `${formatProviderTypeLabel(provider.type)} · ${modelCount} model${modelCount === 1 ? '' : 's'}`;
}

function formatProviderTypeLabel(type: ProviderConfig['type']): string {
	switch (type) {
		case 'openai': return 'OpenAI';
		case 'openai-compatible': return 'OpenAI-compatible';
		case 'anthropic': return 'Anthropic';
		case 'gemini': return 'Gemini';
	}
}
