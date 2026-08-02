import type {
	ChannelContentType,
	InstructionMode,
	MediaEmbedMode,
	NoteDestinationMode,
	PlaylistMode,
	ReportLocation,
	SourceSectionPosition,
	TranscriptFailureMode,
	TranscriptLanguageMode,
	TranscriptMode,
} from '../../types';
import {
	DEFAULT_CHANNEL_VIDEO_LIMIT,
	DEFAULT_GENERATE_AI_SUMMARY,
	DEFAULT_INCLUDE_FRONTMATTER,
	DEFAULT_INCLUDE_MEMORABLE_QUOTES,
	DEFAULT_INCLUDE_MINDMAP,
	DEFAULT_INCLUDE_REPORT,
	DEFAULT_LINK_TIMESTAMPS,
	DEFAULT_MEDIA_EMBED_MODE,
	DEFAULT_NOTE_DESTINATION_MODE,
	DEFAULT_OPEN_CREATED_NOTE,
	DEFAULT_OUTPUT_TRANSCRIPT_MODE,
	DEFAULT_PLAYLIST_MODE,
	DEFAULT_REPORT_LOCATION,
	DEFAULT_REQUEST_TIMEOUT_MS,
	DEFAULT_SOURCE_SECTION_POSITION,
	DEFAULT_TEMPERATURE,
	DEFAULT_TLDR_CALLOUT_AT_TOP,
	DEFAULT_TRANSCRIPT_FAILURE_MODE,
	DEFAULT_TRANSCRIPT_LANGUAGE_MODE,
	DEFAULT_USE_AI,
	DEFAULT_USE_VIDEO_TITLE_AS_NOTE_NAME,
} from '../../defaults';

type GenerationOptionControlType =
	| 'toggle'
	| 'dropdown'
	| 'text'
	| 'textarea'
	| 'number'
	| 'folder'
	| 'preview'
	| 'model-list'
	| 'checkbox-group';

export const ADDITIONAL_SECTION_IDS = ['tldr', 'mind-map', 'memorable-quotes'] as const;
export type AdditionalSectionId = typeof ADDITIONAL_SECTION_IDS[number];

export interface GenerationOptionVisibilityValues {
	useAi: boolean;
	generateAiSummary: boolean;
	instructionMode: InstructionMode;
	noteDestinationMode: NoteDestinationMode;
	includeFrontmatter: boolean;
	transcriptMode: TranscriptMode;
	transcriptLanguageMode: TranscriptLanguageMode;
	channelVideoLimit: number | null;
	includeReport: boolean;
}

interface GenerationOptionSchemaItem<
	TOptions extends Record<string, string> = Record<string, string>,
> {
	name: string;
	desc?: string;
	controlType: GenerationOptionControlType;
	placeholder?: string;
	options?: TOptions;
	defaultValue?: unknown;
	validate?: (value: unknown) => string | undefined;
	visible?: (values: GenerationOptionVisibilityValues) => boolean;
	fromStoredValue?: (value: unknown) => unknown;
	toStoredValue?: (value: unknown) => unknown;
}

const isFiniteNumberBetween = (value: unknown, min: number, max: number): boolean =>
	typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const showAi = (values: GenerationOptionVisibilityValues): boolean => values.useAi;
const showInstructions = (values: GenerationOptionVisibilityValues): boolean =>
	values.useAi && values.generateAiSummary;

export const GENERATION_OPTIONS_SCHEMA = {
	modelOrder: {
		name: 'Model order',
		desc: 'Models are tried in order. If one request fails, the next model retries it and becomes the starting model for the rest of the run.',
		unavailableDesc: 'Add a provider and at least one model to enable AI generation.',
		addLabel: 'Add model',
		controlType: 'model-list',
	},
	useAi: {
		name: 'AI',
		desc: 'Enable or disable all AI-generated note content.',
		controlType: 'toggle',
		defaultValue: DEFAULT_USE_AI,
	},
	aiSummary: {
		name: 'Generate note body',
		desc: 'Use the selected template or custom instructions to generate the main note body.',
		controlType: 'toggle',
		defaultValue: DEFAULT_GENERATE_AI_SUMMARY,
		visible: showAi,
	},
	instructionStyle: {
		name: 'AI instructions',
		desc: 'Pick a built-in template or write your own instructions for the AI.',
		controlType: 'dropdown',
		options: {
			template: 'Built-in template',
			manual: 'Custom instructions',
		} satisfies Record<InstructionMode, string>,
		visible: showInstructions,
	},
	contentTemplate: {
		name: 'Content template',
		controlType: 'dropdown',
		visible: (values: GenerationOptionVisibilityValues) =>
			showInstructions(values) && values.instructionMode === 'template',
	},
	manualInstructions: {
		name: 'Custom instructions',
		desc: 'These instructions control the AI-generated note content. Source metadata is added automatically.',
		controlType: 'textarea',
		placeholder: 'Describe the note you want…',
		visible: (values: GenerationOptionVisibilityValues) =>
			showInstructions(values) && values.instructionMode === 'manual',
	},
	additionalSections: {
		name: 'Additional sections',
		desc: 'Add optional AI-generated sections to the note. Verify memorable quotes against the source before quoting.',
		controlType: 'checkbox-group',
		options: {
			tldr: 'TL;DR',
			'mind-map': 'Mind Map',
			'memorable-quotes': 'Memorable Quotes',
		} satisfies Record<AdditionalSectionId, string>,
		defaultValue: {
			tldr: DEFAULT_TLDR_CALLOUT_AT_TOP,
			'mind-map': DEFAULT_INCLUDE_MINDMAP,
			'memorable-quotes': DEFAULT_INCLUDE_MEMORABLE_QUOTES,
		},
		visible: showAi,
	},
	noteStructurePreview: {
		name: 'Preview note structure',
		controlType: 'preview',
		visible: showAi,
	},
	mediaEmbed: {
		name: 'Media embed',
		desc: 'Embed a video or thumbnail near the top of the note, or turn media off. Combined playlist and channel notes use the first available video.',
		controlType: 'dropdown',
		options: {
			video: 'Video',
			thumbnail: 'Thumbnail',
			none: 'Off',
		} satisfies Record<MediaEmbedMode, string>,
		defaultValue: DEFAULT_MEDIA_EMBED_MODE,
	},
	useVideoTitleAsNoteName: {
		name: 'Use source title as note name',
		desc: 'Use the video, playlist, or channel title when naming created notes. A single-URL run can also rename the current note; append and multi-URL runs do not.',
		controlType: 'toggle',
		defaultValue: DEFAULT_USE_VIDEO_TITLE_AS_NOTE_NAME,
	},
	includeFrontmatter: {
		name: 'Include frontmatter',
		desc: 'Add a YAML frontmatter block. Useful for note properties, Dataview, and search.',
		controlType: 'toggle',
		defaultValue: DEFAULT_INCLUDE_FRONTMATTER,
	},
	frontmatterTags: {
		name: 'Frontmatter tags',
		desc: 'Comma- or space-separated tags added to the frontmatter. Example: YouTube, AI/summary.',
		controlType: 'text',
		placeholder: 'YouTube, AI/summary',
		visible: (values: GenerationOptionVisibilityValues) => values.includeFrontmatter,
	},
	frontmatterProperties: {
		name: 'Frontmatter properties',
		desc: 'Choose built-in properties or add custom property names. Custom properties are added blank.',
		controlType: 'text',
		placeholder: 'title channel channelUrl videoId topic',
		visible: (values: GenerationOptionVisibilityValues) => values.includeFrontmatter,
	},
	sourceMetadataPosition: {
		name: 'Source metadata position',
		desc: 'Render the source block (title, channel, URL) at top or bottom.',
		controlType: 'dropdown',
		options: {
			top: 'Top',
			bottom: 'Bottom',
		} satisfies Record<SourceSectionPosition, string>,
		defaultValue: DEFAULT_SOURCE_SECTION_POSITION,
	},
	outputDestination: {
		name: 'Output destination',
		desc: 'Replace the selection (or insert at the cursor) in the active note, append to the end of the active note, or create notes in a folder.',
		controlType: 'dropdown',
		options: {
			'current-note': 'Current note',
			'append-to-active-note': 'Append to active note',
			folder: 'Folder',
		} satisfies Record<NoteDestinationMode, string>,
		defaultValue: DEFAULT_NOTE_DESTINATION_MODE,
	},
	destinationFolder: {
		name: 'Destination folder',
		desc: 'Created automatically if it does not exist.',
		controlType: 'folder',
		placeholder: 'YouTube notes',
		visible: (values: GenerationOptionVisibilityValues) => values.noteDestinationMode === 'folder',
	},
	openCreatedNote: {
		name: 'Open created note',
		desc: 'Open the first note created by a Folder run in a new tab. For playlists, channels, and multi-URL batches, only the first note opens.',
		controlType: 'toggle',
		defaultValue: DEFAULT_OPEN_CREATED_NOTE,
		visible: (values: GenerationOptionVisibilityValues) => values.noteDestinationMode === 'folder',
	},
	transcriptInNote: {
		name: 'Transcript in note',
		desc: 'How transcript content appears in the generated note.',
		controlType: 'dropdown',
		options: {
			none: 'Off',
			readable: 'Readable',
			timestamped: 'Timestamped',
		} satisfies Record<TranscriptMode, string>,
		defaultValue: DEFAULT_OUTPUT_TRANSCRIPT_MODE,
	},
	linkTimestamps: {
		name: 'Link timestamps to YouTube',
		desc: 'When the transcript is timestamped, link each timestamp to that point in the YouTube video.',
		controlType: 'toggle',
		defaultValue: DEFAULT_LINK_TIMESTAMPS,
		visible: (values: GenerationOptionVisibilityValues) => values.transcriptMode === 'timestamped',
	},
	transcriptLanguage: {
		name: 'Transcript language',
		desc: "YouTube default uses the first available transcript. Preferred tries the requested language first, then falls back to YouTube's default.",
		controlType: 'dropdown',
		options: {
			auto: 'YouTube default',
			preferred: 'Preferred language, then default',
		} satisfies Record<TranscriptLanguageMode, string>,
		defaultValue: DEFAULT_TRANSCRIPT_LANGUAGE_MODE,
	},
	preferredLanguageCode: {
		name: 'Preferred language code',
		desc: 'Used when transcript language is set to preferred. Example: en, fr, ar.',
		controlType: 'text',
		placeholder: 'en',
		visible: (values: GenerationOptionVisibilityValues) => values.transcriptLanguageMode === 'preferred',
	},
	playlistHandling: {
		name: 'Playlist and channel output',
		desc: 'Create one note per video, or one combined note for the entire playlist or selected channel content.',
		controlType: 'dropdown',
		options: {
			'per-video': 'One note per video',
			combined: 'One combined note',
		} satisfies Record<PlaylistMode, string>,
		defaultValue: DEFAULT_PLAYLIST_MODE,
	},
	channelContent: {
		name: 'Channel',
		desc: 'Choose which channel content to include.',
		controlType: 'checkbox-group',
		options: {
			videos: 'Videos',
			shorts: 'Shorts',
			streams: 'Streams',
		} satisfies Record<ChannelContentType, string>,
	},
	channelItemsPerType: {
		name: 'Items per selected type',
		desc: 'Latest applies the number separately to each selected type. All available processes everything YouTube exposes.',
		controlType: 'dropdown',
		placeholder: '10',
		options: {
			limited: 'Latest',
			all: 'All available',
		},
	},
	channelItemLimit: {
		name: 'Latest items per selected type',
		desc: 'Number of recent videos, Shorts, or streams to process for each selected type.',
		controlType: 'number',
		defaultValue: DEFAULT_CHANNEL_VIDEO_LIMIT,
		validate: (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 1
			? undefined
			: 'Enter a whole number of at least 1.',
		visible: (values: GenerationOptionVisibilityValues) => values.channelVideoLimit !== null,
	},
	transcriptFailure: {
		name: "When a transcript can't be fetched",
		desc: 'For playlists and channels, skip that video and continue or stop the current run.',
		controlType: 'dropdown',
		options: {
			skip: 'Skip video and continue',
			fail: 'Stop current run',
		} satisfies Record<TranscriptFailureMode, string>,
		defaultValue: DEFAULT_TRANSCRIPT_FAILURE_MODE,
	},
	includeReport: {
		name: 'Include report',
		desc: 'Add a collapsible report listing completed, skipped, failed, and canceled items after each batch.',
		controlType: 'toggle',
		defaultValue: DEFAULT_INCLUDE_REPORT,
	},
	reportLocation: {
		name: 'Report location',
		desc: 'Choose where to save the report after the batch finishes.',
		controlType: 'dropdown',
		options: {
			'generated-note': 'First generated note',
			'separate-note': 'Separate report note',
		} satisfies Record<ReportLocation, string>,
		defaultValue: DEFAULT_REPORT_LOCATION,
		visible: (values: GenerationOptionVisibilityValues) => values.includeReport,
	},
	temperature: {
		name: 'Temperature',
		desc: 'Controls response variation when supported by the provider.',
		controlType: 'number',
		placeholder: '0.3',
		defaultValue: DEFAULT_TEMPERATURE,
		validate: (value: unknown) => isFiniteNumberBetween(value, 0, 2)
			? undefined
			: 'Enter a number from 0 to 2.',
	},
	requestTimeout: {
		name: 'Request timeout (seconds)',
		desc: 'Maximum time for each AI request. Increase it for slow local models or long inputs.',
		controlType: 'number',
		placeholder: '300',
		defaultValue: DEFAULT_REQUEST_TIMEOUT_MS / 1000,
		validate: (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 5
			? undefined
			: 'Enter at least 5 seconds.',
		fromStoredValue: (value: unknown) => typeof value === 'number' ? Math.round(value / 1000) : value,
		toStoredValue: (value: unknown) => typeof value === 'number' ? Math.round(value * 1000) : value,
	},
} as const;

type GenerationOptionSchemaKey = keyof typeof GENERATION_OPTIONS_SCHEMA;

export function optionIsVisible(
	key: GenerationOptionSchemaKey,
	values: GenerationOptionVisibilityValues,
): boolean {
	const option = GENERATION_OPTIONS_SCHEMA[key] as GenerationOptionSchemaItem;
	return option.visible?.(values) ?? true;
}

export function optionFromStoredValue(key: GenerationOptionSchemaKey, value: unknown): unknown {
	const option = GENERATION_OPTIONS_SCHEMA[key] as GenerationOptionSchemaItem;
	return option.fromStoredValue?.(value) ?? value;
}

export function optionToStoredValue(key: GenerationOptionSchemaKey, value: unknown): unknown {
	const option = GENERATION_OPTIONS_SCHEMA[key] as GenerationOptionSchemaItem;
	return option.toStoredValue?.(value) ?? value;
}
