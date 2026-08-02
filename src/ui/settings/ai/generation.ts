import type { SettingDefinition, SettingDefinitionItem } from 'obsidian';
import type { InstructionConfig, OutputDefaults, PluginSettings } from '../../../types';
import { findTemplateChoice, getTemplate, listTemplateChoices } from '../../../ai/templates/registry';
import { controlDefaultToString } from '../../shared/templateControls';
import {
	ADDITIONAL_SECTION_IDS,
	GENERATION_OPTIONS_SCHEMA as OPTIONS,
	optionIsVisible,
	type AdditionalSectionId,
	type GenerationOptionVisibilityValues,
} from '../../shared/generationOptionsSchema';
import {
	renderCheckboxGroupControl,
	type CheckboxGroupChange,
} from '../../shared/checkboxGroupControl';
import { sectionInfoButton } from '../sectionInfo';

const outputKey = <K extends keyof OutputDefaults>(key: K): `output.${K}` => `output.${key}`;
const instructionKey = <K extends Exclude<keyof InstructionConfig, 'controlValues'>>(
	key: K,
): `instruction.${K}` => `instruction.${key}`;

interface AiGenerationContext {
	settings: PluginSettings;
	resetAiDefaults(): void;
}

type Definition = SettingDefinition<string>;

export class AiGenerationDefinitions {
	private notePreviewOpen = false;
	private previewHosts = new Set<HTMLElement>();

	constructor(private context: AiGenerationContext) {}

	getDefinitions(): SettingDefinitionItem<string>[] {
		this.previewHosts.clear();
		return [
			{
				type: 'group',
				heading: 'AI-generated content',
				cls: 'ytkn-settings__section-card',
				extraButtons: [sectionInfoButton(
					'Choose which parts of a note AI generates and the instructions used to generate them.',
				)],
				items: this.getAiOutputDefinitions(),
			},
		];
	}

	getRequestDefinitions(): SettingDefinitionItem<string> {
		return {
			type: 'group',
			heading: 'Generation parameters',
			cls: 'ytkn-settings__section-card',
			extraButtons: [sectionInfoButton(
				'Tune response variation and the maximum time allowed for each model request.',
			)],
			items: [
				{
					name: OPTIONS.temperature.name,
					desc: OPTIONS.temperature.desc,
					control: {
						type: OPTIONS.temperature.controlType,
						key: 'temperature',
						defaultValue: OPTIONS.temperature.defaultValue,
						min: 0,
						max: 2,
						step: 0.1,
						validate: OPTIONS.temperature.validate,
					},
				},
				{
					name: OPTIONS.requestTimeout.name,
					desc: OPTIONS.requestTimeout.desc,
					control: {
						type: OPTIONS.requestTimeout.controlType,
						key: 'request-timeout-seconds',
						defaultValue: OPTIONS.requestTimeout.defaultValue,
						min: 5,
						step: 1,
						validate: OPTIONS.requestTimeout.validate,
					},
				},
			],
		};
	}

	getResetDefinition(): SettingDefinitionItem<string> {
		return {
			type: 'group',
			cls: 'ytkn-settings__page-reset',
			items: [{
				name: 'Restore AI defaults',
			desc: 'Restore AI output, instructions, temperature, and timeout. Providers, models, secrets, and model order are preserved.',
				render: (setting) => {
					setting
						.setName('Restore AI defaults')
						.setDesc('Restore AI output, instructions, temperature, and timeout. Providers, models, secrets, and model order are preserved.')
						.addButton((button) => button
							.setButtonText('Restore AI defaults')
							.setDestructive()
							.onClick(() => this.context.resetAiDefaults()));
				},
			}],
		};
	}

	refreshPreview(): void {
		for (const host of this.previewHosts) {
			this.renderNoteStructure(host);
		}
	}

	private getAiOutputDefinitions(): Definition[] {
		const visible = (key: Parameters<typeof optionIsVisible>[0]) => () =>
			optionIsVisible(key, this.getVisibilityValues());
		return [
			{
				name: OPTIONS.useAi.name,
				desc: OPTIONS.useAi.desc,
				aliases: ['artificial intelligence', 'AI output'],
				control: { type: OPTIONS.useAi.controlType, key: outputKey('useAi') },
			},
			{
				name: OPTIONS.aiSummary.name,
				desc: OPTIONS.aiSummary.desc,
				aliases: ['summary', 'main content'],
				control: { type: OPTIONS.aiSummary.controlType, key: outputKey('generateAiSummary') },
				visible: visible('aiSummary'),
			},
			...this.getInstructionDefinitions(),
			{
				name: OPTIONS.additionalSections.name,
				desc: OPTIONS.additionalSections.desc,
				aliases: ['TL;DR', 'Mind Map', 'Memorable Quotes', 'add-ons'],
				visible: visible('additionalSections'),
					render: (setting) => {
						setting
							.setName(OPTIONS.additionalSections.name)
							.setDesc(OPTIONS.additionalSections.desc);
					renderCheckboxGroupControl(setting, {
						value: this.getSelectedAdditionalSections(),
						order: ADDITIONAL_SECTION_IDS,
						labels: OPTIONS.additionalSections.options,
						saveErrorMessage: 'Could not save additional sections.',
						onChange: (_value, change) => this.updateAdditionalSection(change),
					});
				},
			},
			{
				name: OPTIONS.noteStructurePreview.name,
				searchable: false,
				visible: visible('noteStructurePreview'),
				render: (setting) => {
					setting.setName(OPTIONS.noteStructurePreview.name);
					const details = setting.descEl.createEl('details', { cls: 'ytkn-settings__native-preview' });
					details.open = this.notePreviewOpen;
					details.createEl('summary', { text: 'Show preview' });
					details.addEventListener('toggle', () => (this.notePreviewOpen = details.open));
					const host = details.createDiv({ cls: 'ytkn-settings__template-preview' });
					this.previewHosts.add(host);
					this.renderNoteStructure(host);
				},
			},
		];
	}

	private getInstructionDefinitions(): Definition[] {
		const config = this.context.settings.getInstructionConfig();
		const choice = findTemplateChoice(config.template);
		const templateOptions = Object.fromEntries(
			listTemplateChoices().map((item) => [item.id, item.label]),
		);
		const visible = (key: Parameters<typeof optionIsVisible>[0]) => () =>
			optionIsVisible(key, this.getVisibilityValues());

		return [
			{
				name: OPTIONS.instructionStyle.name,
				desc: OPTIONS.instructionStyle.desc,
				control: {
					type: OPTIONS.instructionStyle.controlType,
					key: instructionKey('mode'),
					options: OPTIONS.instructionStyle.options,
				},
				visible: visible('instructionStyle'),
			},
			{
				name: OPTIONS.contentTemplate.name,
				desc: choice?.subtitle,
				control: {
					type: OPTIONS.contentTemplate.controlType,
					key: instructionKey('template'),
					options: templateOptions,
				},
				visible: visible('contentTemplate'),
			},
			...this.getTemplateControlDefinitions(),
			{
				name: OPTIONS.manualInstructions.name,
				desc: OPTIONS.manualInstructions.desc,
				control: {
					type: OPTIONS.manualInstructions.controlType,
					key: instructionKey('manualInstructions'),
					placeholder: OPTIONS.manualInstructions.placeholder,
					rows: 6,
				},
				visible: visible('manualInstructions'),
			},
		];
	}

	private getSelectedAdditionalSections(): AdditionalSectionId[] {
		const output = this.context.settings.getOutputDefaults();
		const instruction = this.context.settings.getInstructionConfig();
		return ADDITIONAL_SECTION_IDS.filter((section) => {
			switch (section) {
				case 'tldr': return output.tldrCalloutAtTop;
				case 'mind-map': return instruction.includeMindmap;
				case 'memorable-quotes': return instruction.includeMemorableQuotes;
			}
		});
	}

	private async updateAdditionalSection(change: CheckboxGroupChange<AdditionalSectionId>): Promise<void> {
		switch (change.value) {
			case 'tldr':
				await this.context.settings.updateOutputDefaults({
					...this.context.settings.getOutputDefaults(),
					tldrCalloutAtTop: change.checked,
				});
				break;
			case 'mind-map':
				await this.context.settings.updateInstructionConfig({ includeMindmap: change.checked });
				break;
			case 'memorable-quotes':
				await this.context.settings.updateInstructionConfig({ includeMemorableQuotes: change.checked });
				break;
		}
		this.refreshPreview();
	}

	private getTemplateControlDefinitions(): Definition[] {
		const config = this.context.settings.getInstructionConfig();
		return (getTemplate(config.template).controls ?? []).map((control) => {
			const key = `instruction.control.${control.id}`;
			const name = `${control.label}${control.required ? ' *' : ''}`;
			const validate = control.required
				? (value: string) => value.trim() ? undefined : `${control.label} is required.`
				: undefined;
			const visible = () => optionIsVisible('contentTemplate', this.getVisibilityValues());

			if (control.type === 'enum') {
				return {
					name,
					desc: control.description,
					control: {
						type: 'dropdown',
						key,
						defaultValue: controlDefaultToString(control.default),
						options: {
							'': 'Not set',
							...Object.fromEntries((control.enumValues ?? []).map((value) => [
								value,
								formatOptionLabel(value),
							])),
						},
						validate,
					},
					visible,
				};
			}

			return {
				name,
				desc: control.description,
				control: control.multiline
					? {
						type: 'textarea',
						key,
						defaultValue: controlDefaultToString(control.default),
						placeholder: control.description.slice(0, 60),
						rows: 4,
						validate,
					}
					: {
						type: 'text',
						key,
						defaultValue: controlDefaultToString(control.default),
						placeholder: control.description.slice(0, 60),
						validate,
					},
				visible,
			};
		});
	}

	private getVisibilityValues(): GenerationOptionVisibilityValues {
		const output = this.context.settings.getOutputDefaults();
		return {
			useAi: output.useAi,
			generateAiSummary: output.generateAiSummary,
			instructionMode: this.context.settings.getInstructionConfig().mode,
			noteDestinationMode: output.noteDestinationMode,
			includeFrontmatter: output.includeFrontmatter,
			transcriptMode: output.transcriptMode,
			transcriptLanguageMode: output.transcriptLanguageMode,
			channelVideoLimit: output.channelVideoLimit,
			includeReport: output.includeReport,
		};
	}

	private renderNoteStructure(host: HTMLElement): void {
		host.empty();
		const instruction = this.context.settings.getInstructionConfig();
		const output = this.context.settings.getOutputDefaults();
		const addHeading = (text: string) => host.createDiv({
			cls: 'ytkn-settings__template-preview-h2',
			text,
		});

		if (output.tldrCalloutAtTop) addHeading('TL;DR');
		if (output.generateAiSummary) {
			if (instruction.mode === 'manual') {
				addHeading('Summary');
			} else {
				for (const section of getTemplate(instruction.template).sections ?? []) {
					addHeading(section.heading);
				}
			}
		}
		if (instruction.includeMindmap) addHeading('Mind Map');
		if (instruction.includeMemorableQuotes) addHeading('Memorable Quotes');
	}
}

function formatOptionLabel(value: string): string {
	return `${value[0]?.toUpperCase() ?? ''}${value.slice(1).replace(/-/g, ' ')}`;
}
