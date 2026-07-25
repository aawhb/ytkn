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

type SettingFieldCopy<
	TOptions extends Record<string, string> = Record<string, string>,
> = {
	name: string;
	desc?: string;
	placeholder?: string;
	options?: TOptions;
};

type SharedSettingCopy = {
	aiModels: {
		name: string;
		desc: string;
		unavailableDesc: string;
		addLabel: string;
	};
	useAi: SettingFieldCopy;
	aiSummary: SettingFieldCopy;
	instructionStyle: SettingFieldCopy<Record<InstructionMode, string>>;
	contentTemplate: SettingFieldCopy;
	manualInstructions: SettingFieldCopy;
	tldrCallout: SettingFieldCopy;
	mindmap: SettingFieldCopy;
	memorableQuotes: SettingFieldCopy;
	noteStructurePreview: SettingFieldCopy;
	mediaEmbed: SettingFieldCopy<Record<MediaEmbedMode, string>>;
	useVideoTitleAsNoteName: SettingFieldCopy;
	includeFrontmatter: SettingFieldCopy;
	frontmatterTags: SettingFieldCopy;
	frontmatterProperties: SettingFieldCopy;
	sourceMetadataPosition: SettingFieldCopy<Record<SourceSectionPosition, string>>;
	outputDestination: SettingFieldCopy<Record<NoteDestinationMode, string>>;
	destinationFolder: SettingFieldCopy;
	openCreatedNote: SettingFieldCopy;
	transcriptInNote: SettingFieldCopy<Record<TranscriptMode, string>>;
	linkTimestamps: SettingFieldCopy;
	transcriptLanguage: SettingFieldCopy<Record<TranscriptLanguageMode, string>>;
	preferredLanguageCode: SettingFieldCopy;
	playlistHandling: SettingFieldCopy<Record<PlaylistMode, string>>;
	channelContent: SettingFieldCopy<Record<ChannelContentType, string>>;
	channelItemsPerType: SettingFieldCopy<Record<'limited' | 'all', string>>;
	transcriptFailure: SettingFieldCopy<Record<TranscriptFailureMode, string>>;
	includeReport: SettingFieldCopy;
	reportLocation: SettingFieldCopy<Record<ReportLocation, string>>;
	temperature: SettingFieldCopy;
	requestTimeout: SettingFieldCopy;
};

export const SETTING_COPY: SharedSettingCopy = {
	aiModels: {
		name: 'AI models',
		desc: 'Tried in order. If any AI request fails, the next model retries it and becomes the starting model for the rest of the run.',
		unavailableDesc: 'Add a provider and at least one model to enable AI generation.',
		addLabel: 'Add model',
	},
	useAi: {
		name: 'AI',
		desc: 'Enable or disable all AI-generated note content.',
	},
	aiSummary: {
		name: 'Generate note body',
		desc: 'Use the selected template or custom instructions to generate the main note body.',
	},
	instructionStyle: {
		name: 'AI instructions',
		desc: 'Pick a built-in template or write your own instructions for the AI.',
		options: {
			template: 'Built-in template',
			manual: 'Custom instructions',
		},
	},
	contentTemplate: {
		name: 'Content template',
	},
	manualInstructions: {
		name: 'Custom instructions',
		desc: 'These instructions control the AI-generated note content. Source metadata is added automatically.',
		placeholder: 'Describe the note you want…',
	},
	tldrCallout: {
		name: 'Add TL;DR callout',
		desc: 'Add a brief TL;DR callout near the top of the note.',
	},
	mindmap: {
		name: 'Add mind map',
		desc: 'Add a Mermaid mind map in addition to the selected template.',
	},
	memorableQuotes: {
		name: 'Add memorable quotes',
		desc: 'Ask the AI to select 3–7 memorable quotes from the transcript. Verify wording against the source before quoting.',
	},
	noteStructurePreview: {
		name: 'Preview note structure',
	},
	mediaEmbed: {
		name: 'Media embed',
		desc: 'Embed a video or thumbnail near the top of the note, or turn media off. Combined playlist and channel notes use the first available video.',
		options: {
			video: 'Video',
			thumbnail: 'Thumbnail',
			none: 'Off',
		},
	},
	useVideoTitleAsNoteName: {
		name: 'Use source title as note name',
		desc: 'Use the video, playlist, or channel title when naming created notes. A single-URL run can also rename the current note; append and multi-URL runs do not.',
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
		desc: 'Space- or comma-separated property names to include. Leave blank to omit these properties. Available: title, aliases, source, channel, channelUrl, channelId, videoUrl, playlistUrl, videoId, playlistId, thumbnailUrl, videoDescription, uploadDate, videoCategory, durationSeconds, keywords, generated, videoCount.',
		placeholder: 'title channel channelUrl videoId …',
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
		desc: 'Replace the selection (or insert at the cursor) in the active note, append to the end of the active note, or create notes in a folder.',
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
	openCreatedNote: {
		name: 'Open created note',
		desc: 'Open the first note created by a Folder run in a new tab. For playlists, channels, and multi-URL batches, only the first note opens.',
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
		desc: 'When the transcript is timestamped, link each timestamp to that point in the YouTube video.',
	},
	transcriptLanguage: {
		name: 'Transcript language',
		desc: "YouTube default uses the first available transcript. Preferred tries the requested language first, then falls back to YouTube's default.",
		options: {
			auto: 'YouTube default',
			preferred: 'Preferred language, then default',
		},
	},
	preferredLanguageCode: {
		name: 'Preferred language code',
		desc: 'Used when transcript language is set to preferred. Example: en, fr, ar.',
		placeholder: 'en',
	},
	playlistHandling: {
		name: 'Playlist and channel output',
		desc: 'Create one note per video, or one combined note for the entire playlist or selected channel content.',
		options: {
			'per-video': 'One note per video',
			combined: 'One combined note',
		},
	},
	channelContent: {
		name: 'Channel',
		desc: 'Choose which channel content to include. Live and upcoming streams are skipped; completed streams are included as replays.',
		options: {
			videos: 'Videos',
			shorts: 'Shorts',
			streams: 'Streams',
		},
	},
	channelItemsPerType: {
		name: 'Items per selected type',
		desc: 'Latest applies the number separately to each selected type. All available processes everything YouTube exposes.',
		placeholder: '10',
		options: {
			limited: 'Latest',
			all: 'All available',
		},
	},
	transcriptFailure: {
		name: "When a transcript can't be fetched",
		desc: 'For playlists and channels, skip that video and continue or stop the current run.',
		options: {
			skip: 'Skip video and continue',
			fail: 'Stop current run',
		},
	},
	includeReport: {
		name: 'Include report',
		desc: 'Add a collapsible report listing completed, skipped, failed, and canceled items after each batch.',
	},
	reportLocation: {
		name: 'Run report location',
		desc: 'Choose where to save the report after the batch finishes.',
		options: {
			'generated-note': 'First generated note',
			'separate-note': 'Separate report note',
		},
	},
	temperature: {
		name: 'Temperature',
		desc: 'Controls response variation when supported by the provider. Lower values are more consistent; higher values are more varied. Default: 0.3.',
		placeholder: '0.3',
	},
	requestTimeout: {
		name: 'Request timeout (seconds)',
		desc: 'Maximum time for each AI request. Increase it for slow local models or long inputs. Default: 300 seconds (5 minutes).',
		placeholder: '300',
	},
};
