import { Setting, setIcon } from 'obsidian';
import { ProviderConfig } from '../../types';
import { SettingsEventHandlers } from '../handlers/SettingsEventHandlers';
import { buildModelId } from '../../utils';

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
	const wrapper = containerEl.createDiv({ cls: 'ytkn-settings__group' });
	wrapper.createEl(headingLevel, { cls: 'ytkn-settings__group-title', text: title });

	const body = wrapper.createDiv({ cls: 'ytkn-settings__group-cards' });
	render(body);
	return wrapper;
}

export class SettingsUIComponents {
	createProviderAccordion(parent: HTMLElement, provider: ProviderConfig): AccordionElements {
		const accordion = parent.createDiv({ cls: 'ytkn-settings__provider-accordion' });
		accordion.setAttribute('data-provider-name', provider.name);

		const header = accordion.createDiv({ cls: 'ytkn-settings__provider-header' });
		const headerInfo = header.createDiv({ cls: 'ytkn-settings__provider-info' });
		headerInfo.createEl('h3', {
			text: provider.name,
			cls: 'ytkn-settings__provider-title',
		});

		const meta = headerInfo.createDiv({ cls: 'ytkn-settings__provider-meta' });
		meta.createSpan({
			text: provider.type === 'openai'
				? 'OpenAI'
				: provider.type === 'openai-compatible'
					? 'OpenAI compatible'
					: provider.type,
			cls: 'ytkn-settings__provider-badge',
		});

		const modelCount = provider.models?.length ?? 0;
		meta.createSpan({
			text: modelCount === 0 ? '0 models - Fetch Now' : `${modelCount} model${modelCount === 1 ? '' : 's'}`,
			cls: `ytkn-settings__provider-count ${modelCount === 0 ? 'is-warning' : 'is-active'}`,
		});

		const headerControls = header.createDiv({ cls: 'ytkn-settings__provider-controls' });
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
		return new Setting(container)
			.setName('API key')
			.setDesc(`Enter your ${provider.name} API key`)
			.addText((text) => {
				text
					.setPlaceholder('Enter API key')
					.setValue(provider.apiKey)
					.onChange(async (value) => {
						await handlers.handleApiKeyChange(provider.name, value);
					});
				text.inputEl.type = 'password';
				return text;
			});
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

		const apiKeySetting = this.createApiKeySetting(content, provider, handlers);
		apiKeySetting.addExtraButton((button) => {
			button
				.setIcon('eye')
				.setTooltip('Show API key')
				.onClick(() => {
					const input = apiKeySetting.controlEl.querySelector('input');
					if (!input) {
						return;
					}

					const isPassword = input.type === 'password';
					input.type = isPassword ? 'text' : 'password';
					button.setIcon(isPassword ? 'eye-off' : 'eye');
					button.setTooltip(isPassword ? 'Hide API key' : 'Show API key');
				});
		});

		new Setting(content)
			.setName('URL')
			.setDesc(provider.type === 'openai-compatible' ? 'Base URL for OpenAI-compatible providers like Ollama.' : 'Optional custom API URL.')
			.addText((text) =>
				text
					.setPlaceholder(provider.type === 'openai-compatible' ? 'http://localhost:11434/v1' : 'Optional custom URL')
					.setValue(provider.url ?? '')
					.onChange(async (value) => {
						await handlers.handleProviderUrlChange(provider, value);
					}),
			);

		const modelsSection = content.createDiv({ cls: 'ytkn-settings__models-section' });
		modelsSection.createEl('h4', { text: 'Models', cls: 'ytkn-settings__models-header' });

		const modelsList = modelsSection.createDiv({ cls: 'ytkn-settings__models-list' });
		if (!provider.models?.length) {
			modelsList.createDiv({
				text: 'No models added yet. Fetch them from the provider or add one manually.',
				cls: 'ytkn-settings__empty-state',
			});
		}

		for (const model of provider.models ?? []) {
			const modelItem = modelsList.createDiv({ cls: 'setting-item setting-model' });
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

		const actionRow = modelsSection.createDiv({ cls: 'ytkn-settings__model-actions' });

		new Setting(actionRow)
			.addButton((button) =>
				button.setButtonText('Fetch models').onClick(() => {
					void handlers.handleFetchProviderModels(provider);
				}),
			)
			.settingEl.addClass('ytkn-settings__add-button');

		new Setting(actionRow)
			.addButton((button) =>
				button.setButtonText('Add model').onClick(() => {
					handlers.handleAddModelClick(provider);
				}),
			)
			.settingEl.addClass('ytkn-settings__add-button');
	}
}
