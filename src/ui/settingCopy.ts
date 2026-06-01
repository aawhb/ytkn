import type {
	InstructionMode,
	MediaEmbedMode,
	NoteDestinationMode,
	PlaylistMode,
	RunReportLocation,
	SourceSectionPosition,
	TranscriptFailureMode,
	TranscriptLanguageMode,
	TranscriptMode,
} from '../types';

export type SettingFieldCopy<
	TOptions extends Record<string, string> = Record<string, string>,
> = {
	name: string;
	desc?: string;
	placeholder?: string;
	options?: TOptions;
};

type SharedSettingCopy = {
	aiModel: {
		name: string;
		defaultDesc: string;
		unavailableDesc: string;
		noModelsOption: string;
		pluginDefaultOption: string;
	};
	useAi: SettingFieldCopy;
	aiSummary: SettingFieldCopy;
	instructionStyle: SettingFieldCopy<Record<InstructionMode, string>>;
	contentTemplate: SettingFieldCopy;
	manualInstructions: SettingFieldCopy;
	tldrCallout: SettingFieldCopy;
	mindmap: SettingFieldCopy;
	memorableQuotes: SettingFieldCopy;
	mediaEmbed: SettingFieldCopy<Record<MediaEmbedMode, string>>;
	useVideoTitleAsNoteName: SettingFieldCopy;
	includeFrontmatter: SettingFieldCopy;
	frontmatterTags: SettingFieldCopy;
	frontmatterProperties: SettingFieldCopy;
	sourceMetadataPosition: SettingFieldCopy<Record<SourceSectionPosition, string>>;
	outputDestination: SettingFieldCopy<Record<NoteDestinationMode, string>>;
	destinationFolder: SettingFieldCopy;
	transcriptInNote: SettingFieldCopy<Record<TranscriptMode, string>>;
	linkTimestamps: SettingFieldCopy;
	transcriptLanguage: SettingFieldCopy<Record<TranscriptLanguageMode, string>>;
	preferredLanguageCode: SettingFieldCopy;
	playlistHandling: SettingFieldCopy<Record<PlaylistMode, string>>;
	transcriptFailure: SettingFieldCopy<Record<TranscriptFailureMode, string>>;
	includeRunReport: SettingFieldCopy;
	runReportLocation: SettingFieldCopy<Record<RunReportLocation, string>>;
	temperature: SettingFieldCopy;
	requestTimeout: SettingFieldCopy;
};

export const SETTING_COPY: SharedSettingCopy = {
	aiModel: {
		name: 'AI model',
		defaultDesc: 'Used by every generation unless overridden per run.',
		unavailableDesc: 'Add a provider and at least one model to enable AI generation.',
		noModelsOption: 'No models available',
		pluginDefaultOption: 'Plugin default',
	},
	useAi: {
		name: 'Use AI',
		desc: 'Master switch for all AI features.',
	},
	aiSummary: {
		name: 'AI summary',
		desc: 'Create an AI-generated note body from a template or manual instructions.',
	},
	instructionStyle: {
		name: 'Instruction style',
		desc: 'Pick a built-in template or write your own instructions for the AI.',
		options: {
			template: 'Built-in template',
			manual: 'Manual instructions',
		},
	},
	contentTemplate: {
		name: 'Content template',
	},
	manualInstructions: {
		name: 'Manual instructions',
		desc: 'Custom prompt. The video metadata block is still added automatically.',
		placeholder: 'Provide specific instructions for the note...',
	},
	tldrCallout: {
		name: 'Add summary callout',
		desc: 'Add a TL;DR section in a summary callout.',
	},
	mindmap: {
		name: 'Add mindmap',
		desc: 'Add a Mermaid mindmap, independent of the selected template.',
	},
	memorableQuotes: {
		name: 'Add memorable quotes',
		desc: 'Add 3-7 verbatim quotes, independent of the selected template.',
	},
	mediaEmbed: {
		name: 'Media embed',
		desc: 'Embed the YouTube video, thumbnail, or no media near the top of the note.',
		options: {
			video: 'Video',
			thumbnail: 'Thumbnail',
			none: 'Off',
		},
	},
	useVideoTitleAsNoteName: {
		name: 'Use video title as note title',
		desc: 'Rename the destination note to the video or playlist title. Not applicable for multiple videos in one note.',
	},
	includeFrontmatter: {
		name: 'Include frontmatter',
		desc: 'Add a YAML frontmatter block. Useful for note properties, Dataview, and search.',
	},
	frontmatterTags: {
		name: 'Frontmatter tags',
		desc: 'Comma- or space-separated tags added to the frontmatter. Example: YouTube, AI/summary.',
		placeholder: 'YouTube, AI/summary',
	},
	frontmatterProperties: {
		name: 'Frontmatter properties',
		desc: 'Space- or comma-separated list. Allowed keys: title, aliases, source, channel, channelUrl, channelId, videoUrl, playlistUrl, videoId, playlistId, thumbnailUrl, videoDescription, uploadDate, videoCategory, durationSeconds, keywords, generated, videoCount.',
		placeholder: 'Title channel channelUrl videoId …',
	},
	sourceMetadataPosition: {
		name: 'Source metadata position',
		desc: 'Render the source block (title, channel, URL) at top or bottom.',
		options: {
			top: 'Top',
			bottom: 'Bottom',
		},
	},
	outputDestination: {
		name: 'Output destination',
		desc: 'Use the current note, append to the active note, or create notes in a folder.',
		options: {
			'current-note': 'Current note',
			'append-to-active-note': 'Append to active note',
			folder: 'Folder',
		},
	},
	destinationFolder: {
		name: 'Destination folder',
		desc: 'Created automatically if it does not exist.',
		placeholder: 'YouTube notes',
	},
	transcriptInNote: {
		name: 'Transcript in note',
		desc: 'How transcript content appears in the generated note.',
		options: {
			none: 'Off',
			readable: 'Readable',
			timestamped: 'Timestamped',
		},
	},
	linkTimestamps: {
		name: 'Link timestamps to YouTube',
		desc: 'When using the timestamped transcript, deep-link to the video at that time.',
	},
	transcriptLanguage: {
		name: 'Transcript language',
		desc: 'Auto picks any available transcript. Preferred tries your language first, then falls back.',
		options: {
			auto: 'Auto-detect best available',
			preferred: 'Preferred language with fallback',
		},
	},
	preferredLanguageCode: {
		name: 'Preferred language code',
		desc: 'Used when transcript language is set to preferred. Example: en, fr, ar.',
		placeholder: 'en',
	},
	playlistHandling: {
		name: 'Playlist handling',
		desc: 'Create a single combined note for the whole playlist, or one note per video.',
		options: {
			'per-video': 'Per video: multiple individual notes',
			combined: 'Combined: single aggregated note',
		},
	},
	transcriptFailure: {
		name: 'When a transcript fails',
		desc: 'Skip the video with a missing transcript, or stop the entire run.',
		options: {
			skip: 'Skip and keep going',
			fail: 'Stop the whole run',
		},
	},
	includeRunReport: {
		name: 'Include run report',
		desc: 'Add a collapsible batch report showing completed, skipped, failed, and canceled runs.',
	},
	runReportLocation: {
		name: 'Run report location',
		desc: 'Where to put the run report after all generations in a batch complete.',
		options: {
			'generated-note': 'Generated note',
			'separate-note': 'Separate report note',
		},
	},
	temperature: {
		name: 'Temperature',
		desc: 'If supported by the provider; 0 = deterministic. 0.3 (default) = focused. 1 = more varied.',
		placeholder: '0.3',
	},
	requestTimeout: {
		name: 'Request timeout (seconds)',
		desc: 'Increase for slow local models or long runs. 300 = 5 minutes.',
		placeholder: '300',
	},
};

export type SettingCopyKey = keyof typeof SETTING_COPY;
