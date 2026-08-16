import type { App, SettingDefinition, SettingDefinitionItem, SettingDefinitionPage } from 'obsidian';
import { Notice } from 'obsidian';
import type { OutputDefaults, PluginSettings } from '../../types';
import { DEFAULT_CHANNEL_VIDEO_LIMIT } from '../../defaults';
import {
	BUILT_IN_FRONTMATTER_PROPERTIES,
	isBuiltInFrontmatterProperty,
} from '../../frontmatterProperties';
import {
	GENERATION_OPTIONS_SCHEMA as OPTIONS,
	optionIsVisible,
	type GenerationOptionVisibilityValues,
} from '../shared/generationOptionsSchema';
import { renderChannelContentControl } from '../shared/checkboxGroupControl';
import { sectionInfoButton } from './sectionInfo';
import { FrontmatterPropertyModal } from './frontmatterPropertyModal';

const outputKey = <K extends keyof OutputDefaults>(key: K): `output.${K}` => `output.${key}`;

interface GeneralPageContext {
	app: App;
	settings: PluginSettings;
	onStructureChanged(): void;
	resetGeneralDefaults(): void;
}

type Definition = SettingDefinition<string>;

function visibilityValues(settings: PluginSettings): GenerationOptionVisibilityValues {
	const output = settings.getOutputDefaults();
	return {
		useAi: output.useAi,
		generateAiSummary: output.generateAiSummary,
		instructionMode: settings.getInstructionConfig().mode,
		noteDestinationMode: output.noteDestinationMode,
		includeFrontmatter: output.includeFrontmatter,
		transcriptMode: output.transcriptMode,
		transcriptLanguageMode: output.transcriptLanguageMode,
		channelVideoLimit: output.channelVideoLimit,
		includeReport: output.includeReport,
	};
}

const optionVisible = (
	context: GeneralPageContext,
	key: Parameters<typeof optionIsVisible>[0],
): (() => boolean) => () => optionIsVisible(key, visibilityValues(context.settings));

export function getGeneralDefinitions(context: GeneralPageContext): SettingDefinitionItem<string>[] {
	return [
		{
			type: 'group',
			heading: 'Output destination',
			cls: 'ytkn-settings__section-card',
			extraButtons: [sectionInfoButton(
				'Choose whether output updates the active note or creates notes in a folder, and whether newly created notes open automatically.',
			)],
			items: [
				{
					name: OPTIONS.outputDestination.name,
					desc: OPTIONS.outputDestination.desc,
					aliases: ['current note', 'append', 'folder'],
					control: {
						type: OPTIONS.outputDestination.controlType,
						key: outputKey('noteDestinationMode'),
						options: OPTIONS.outputDestination.options,
					},
				},
				{
					name: OPTIONS.destinationFolder.name,
					desc: OPTIONS.destinationFolder.desc,
					control: {
						type: OPTIONS.destinationFolder.controlType,
						key: outputKey('noteDestinationFolder'),
						placeholder: OPTIONS.destinationFolder.placeholder,
						includeRoot: true,
					},
					visible: optionVisible(context, 'destinationFolder'),
				},
				{
					name: OPTIONS.openCreatedNote.name,
					desc: OPTIONS.openCreatedNote.desc,
					aliases: ['open note', 'new tab'],
					control: {
						type: OPTIONS.openCreatedNote.controlType,
						key: outputKey('openCreatedNote'),
					},
					visible: optionVisible(context, 'openCreatedNote'),
				},
			],
		},
		{
			type: 'group',
			heading: 'Note format',
			cls: 'ytkn-settings__section-card',
			extraButtons: [sectionInfoButton(
				'Define the media, naming, frontmatter, and source metadata shared by generated notes.',
			)],
			items: [
				{
					name: OPTIONS.mediaEmbed.name,
					desc: OPTIONS.mediaEmbed.desc,
					control: {
						type: OPTIONS.mediaEmbed.controlType,
						key: outputKey('mediaEmbedMode'),
						options: OPTIONS.mediaEmbed.options,
					},
				},
				{
					name: OPTIONS.useVideoTitleAsNoteName.name,
					desc: OPTIONS.useVideoTitleAsNoteName.desc,
					control: { type: OPTIONS.useVideoTitleAsNoteName.controlType, key: outputKey('useVideoTitleAsNoteName') },
				},
				{
					name: OPTIONS.includeFrontmatter.name,
					desc: OPTIONS.includeFrontmatter.desc,
					aliases: ['properties', 'yaml'],
					control: { type: OPTIONS.includeFrontmatter.controlType, key: outputKey('includeFrontmatter') },
				},
				{
					name: OPTIONS.frontmatterTags.name,
					desc: OPTIONS.frontmatterTags.desc,
					control: {
						type: OPTIONS.frontmatterTags.controlType,
						key: outputKey('frontmatterTags'),
						placeholder: OPTIONS.frontmatterTags.placeholder,
					},
					visible: optionVisible(context, 'frontmatterTags'),
				},
				getFrontmatterPropertiesPage(context),
				{
					name: OPTIONS.sourceMetadataPosition.name,
					desc: OPTIONS.sourceMetadataPosition.desc,
					control: {
						type: OPTIONS.sourceMetadataPosition.controlType,
						key: outputKey('sourceSectionPosition'),
						options: OPTIONS.sourceMetadataPosition.options,
					},
				},
			],
		},
		{
			type: 'group',
			heading: 'Transcript',
			cls: 'ytkn-settings__section-card',
			extraButtons: [sectionInfoButton(
				'Choose which transcript YouTube supplies and how it appears in generated notes.',
			)],
			items: [
				{
					name: OPTIONS.transcriptInNote.name,
					desc: OPTIONS.transcriptInNote.desc,
					control: {
						type: OPTIONS.transcriptInNote.controlType,
						key: outputKey('transcriptMode'),
						options: OPTIONS.transcriptInNote.options,
					},
				},
				{
					name: OPTIONS.linkTimestamps.name,
					desc: OPTIONS.linkTimestamps.desc,
					control: { type: OPTIONS.linkTimestamps.controlType, key: outputKey('linkTimestamps') },
					visible: optionVisible(context, 'linkTimestamps'),
				},
				{
					name: OPTIONS.transcriptLanguage.name,
					desc: OPTIONS.transcriptLanguage.desc,
					control: {
						type: OPTIONS.transcriptLanguage.controlType,
						key: outputKey('transcriptLanguageMode'),
						options: OPTIONS.transcriptLanguage.options,
					},
				},
				{
					name: OPTIONS.preferredLanguageCode.name,
					desc: OPTIONS.preferredLanguageCode.desc,
					control: {
						type: OPTIONS.preferredLanguageCode.controlType,
						key: outputKey('preferredTranscriptLanguage'),
						placeholder: OPTIONS.preferredLanguageCode.placeholder,
					},
					visible: optionVisible(context, 'preferredLanguageCode'),
				},
			],
		},
		{
			type: 'group',
			heading: 'Playlists and channels',
			cls: 'ytkn-settings__section-card',
			extraButtons: [sectionInfoButton(
				'Control how multi-video sources are split, filtered, limited, and handled when transcripts are unavailable.',
			)],
			items: getCollectionDefinitions(context),
		},
		{
			type: 'group',
			heading: 'Reports',
			cls: 'ytkn-settings__section-card',
			extraButtons: [sectionInfoButton(
				'Keep a record of batch outcomes and choose where that record is written.',
			)],
			items: [
				{
					name: OPTIONS.includeReport.name,
					desc: OPTIONS.includeReport.desc,
					aliases: ['batch report', 'results'],
					control: { type: OPTIONS.includeReport.controlType, key: outputKey('includeReport') },
				},
				{
					name: OPTIONS.reportLocation.name,
					desc: OPTIONS.reportLocation.desc,
					control: {
						type: OPTIONS.reportLocation.controlType,
						key: outputKey('reportLocation'),
						options: OPTIONS.reportLocation.options,
					},
					visible: optionVisible(context, 'reportLocation'),
				},
			],
		},
		{
			type: 'group',
			cls: 'ytkn-settings__page-reset',
			items: [{
				name: 'Restore general defaults',
				desc: 'Restore destination, note format, transcript, playlist, channel, and report settings. AI settings are preserved.',
				render: (setting) => {
					setting
						.setName('Restore general defaults')
						.setDesc('Restore destination, note format, transcript, playlist, channel, and report settings. AI settings are preserved.')
						.addButton((button) => button
							.setButtonText('Restore general defaults')
							.setDestructive()
							.onClick(() => context.resetGeneralDefaults()));
				},
			}],
		},
	];
}

function getCollectionDefinitions(context: GeneralPageContext): Definition[] {
	return [
		{
			name: OPTIONS.playlistHandling.name,
			desc: OPTIONS.playlistHandling.desc,
			control: {
				type: OPTIONS.playlistHandling.controlType,
				key: outputKey('playlistMode'),
				options: OPTIONS.playlistHandling.options,
			},
		},
		{
			name: OPTIONS.channelContent.name,
			desc: OPTIONS.channelContent.desc,
			render: (setting) => {
				setting
					.setName(OPTIONS.channelContent.name)
					.setDesc(OPTIONS.channelContent.desc);
				renderChannelContentControl(setting, {
					value: context.settings.getOutputDefaults().channelContentTypes,
					labels: OPTIONS.channelContent.options,
					onChange: async (channelContentTypes) => {
						await context.settings.updateOutputDefaults({
							...context.settings.getOutputDefaults(),
							channelContentTypes,
						});
					},
				});
			},
		},
		{
			name: OPTIONS.channelItemsPerType.name,
			desc: OPTIONS.channelItemsPerType.desc,
			control: {
				type: OPTIONS.channelItemsPerType.controlType,
				key: 'channel-limit-mode',
				options: OPTIONS.channelItemsPerType.options,
			},
		},
		{
			name: OPTIONS.channelItemLimit.name,
			desc: OPTIONS.channelItemLimit.desc,
			control: {
				type: OPTIONS.channelItemLimit.controlType,
				key: outputKey('channelVideoLimit'),
				defaultValue: DEFAULT_CHANNEL_VIDEO_LIMIT,
				min: 1,
				step: 1,
				validate: OPTIONS.channelItemLimit.validate,
			},
			visible: optionVisible(context, 'channelItemLimit'),
		},
		{
			name: OPTIONS.transcriptFailure.name,
			desc: OPTIONS.transcriptFailure.desc,
			control: {
				type: OPTIONS.transcriptFailure.controlType,
				key: outputKey('transcriptFailureMode'),
				options: OPTIONS.transcriptFailure.options,
			},
		},
	];
}

function getFrontmatterPropertiesPage(context: GeneralPageContext): SettingDefinitionPage<string> {
	const definitions = new Map(BUILT_IN_FRONTMATTER_PROPERTIES.map((property) => [property.key, property]));
	const getPreferences = () => context.settings.getOutputDefaults().frontmatterProperties;
	return {
		type: 'page',
		name: OPTIONS.frontmatterProperties.name,
		desc: 'Choose which properties appear in generated notes and arrange their order.',
		displayValue: () => {
			const preferences = getPreferences();
			return `${preferences.filter((preference) => preference.enabled).length} enabled`;
		},
		visible: optionVisible(context, 'frontmatterProperties'),
		items: [{
			type: 'list',
			heading: 'Properties',
			cls: 'ytkn-settings__section-card ytkn-settings__native-list',
			addItem: {
				name: 'Add custom property',
				action: () => openCustomPropertyModal(context),
			},
			search: {
				placeholder: 'Search properties',
				match: (definition, query) => {
					const description = typeof definition.desc === 'string'
						? definition.desc
						: definition.desc?.textContent ?? '';
					const text = `${definition.name} ${description} ${(definition.aliases ?? []).join(' ')}`;
					return text.toLowerCase().includes(query.trim().toLowerCase());
				},
			},
			items: getPreferences().map((preference) => {
				const property = definitions.get(preference.key);
				return {
					name: preference.key,
					desc: property?.description ?? 'Added blank to generated notes.',
					aliases: property?.aliases,
					render: (setting) => {
						setting
							.setName(preference.key)
							.setDesc(property?.description ?? 'Added blank to generated notes.')
							.addToggle((toggle) => toggle
								.setValue(preference.enabled)
								.onChange((enabled) => {
									void updateFrontmatterProperty(
										context,
										preference.key,
										{ enabled },
									).catch(showPropertySaveError);
								}));
						if (!property) {
							setting
								.addExtraButton((button) => button
									.setIcon('pencil')
									.setTooltip('Rename custom property')
									.onClick(() => openCustomPropertyModal(context, preference.key)))
								.addExtraButton((button) => button
									.setIcon('trash-2')
									.setTooltip('Delete custom property')
									.onClick(() => deleteCustomProperty(context, preference.key)));
						}
					},
				};
			}),
			onReorder: (oldIndex, newIndex) => {
				const next = [...getPreferences()];
				const [moved] = next.splice(oldIndex, 1);
				if (moved === undefined) return;
				next.splice(newIndex, 0, moved);
				void saveFrontmatterProperties(context, next).catch(showPropertySaveError);
			},
		}],
	};
}

function openCustomPropertyModal(context: GeneralPageContext, originalName?: string): void {
	const customKeys = context.settings.getOutputDefaults().frontmatterProperties
		.filter((preference) => !isBuiltInFrontmatterProperty(preference.key))
		.map((preference) => preference.key);
	new FrontmatterPropertyModal(context.app, {
		existing: customKeys,
		originalName,
		onSubmit: async (key) => {
			if (originalName) {
				await updateFrontmatterProperty(context, originalName, { key });
			} else {
				await saveFrontmatterProperties(context, [
					...context.settings.getOutputDefaults().frontmatterProperties,
					{ key, enabled: true },
				]);
			}
		},
	}).open();
}

async function updateFrontmatterProperty(
	context: GeneralPageContext,
	key: string,
	patch: Partial<OutputDefaults['frontmatterProperties'][number]>,
): Promise<void> {
	await saveFrontmatterProperties(
		context,
		context.settings.getOutputDefaults().frontmatterProperties.map((preference) =>
			preference.key === key ? { ...preference, ...patch } : preference),
	);
}

function deleteCustomProperty(context: GeneralPageContext, key: string): void {
	void saveFrontmatterProperties(
		context,
		context.settings.getOutputDefaults().frontmatterProperties
			.filter((preference) => preference.key !== key),
	).catch(showPropertySaveError);
}

async function saveFrontmatterProperties(
	context: GeneralPageContext,
	frontmatterProperties: OutputDefaults['frontmatterProperties'],
): Promise<void> {
	await context.settings.updateOutputDefaults({
		...context.settings.getOutputDefaults(),
		frontmatterProperties,
	});
	context.onStructureChanged();
}

function showPropertySaveError(): void {
	new Notice("Couldn't save frontmatter properties.");
}
