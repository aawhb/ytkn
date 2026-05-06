export const VIDEO_ID_REGEX = /(?:v=|\/)([a-zA-Z0-9_-]{11})/;

export const DEFAULT_INSTRUCTION_MODE = 'template';
export const DEFAULT_INSTRUCTION_TEMPLATE = 'general';
export const DEFAULT_MANUAL_INSTRUCTIONS = '';
export const DEFAULT_INCLUDE_MINDMAP = false;
export const DEFAULT_INCLUDE_MEMORABLE_QUOTES = false;

export const DEFAULT_GENERATE_AI_SUMMARY = true;
export const DEFAULT_OUTPUT_TRANSCRIPT_MODE = 'none';
export const DEFAULT_PLAYLIST_MODE = 'per-video';
export const DEFAULT_TRANSCRIPT_LANGUAGE_MODE = 'auto';
export const DEFAULT_PREFERRED_TRANSCRIPT_LANGUAGE = '';
export const DEFAULT_TRANSCRIPT_FAILURE_MODE = 'skip';
export const DEFAULT_INCLUDE_THUMBNAIL = true;
export const DEFAULT_INCLUDE_RUN_REPORT = true;
export const DEFAULT_RUN_REPORT_LOCATION = 'first-note';
export const DEFAULT_USE_VIDEO_TITLE_AS_NOTE_NAME = true;
export const DEFAULT_NOTE_DESTINATION_MODE = 'current-note';
export const DEFAULT_NOTE_DESTINATION_FOLDER = '';
export const DEFAULT_INCLUDE_FRONTMATTER = true;
export const DEFAULT_FRONTMATTER_TAGS = '';
export const DEFAULT_SOURCE_SECTION_POSITION = 'bottom';
export const DEFAULT_LINK_TIMESTAMPS = false;
export const DEFAULT_TLDR_CALLOUT_AT_TOP = true;
export const DEFAULT_REASONING_MODE = 'off';
export const DEFAULT_REQUEST_TIMEOUT_MS = 300000;
export const DEFAULT_OPENAI_COMPATIBLE_URL = 'http://localhost:11434/v1';
export const TRUNCATION_NOTICE = '\n\n[Summary truncated due to output limit.]';
export const ACTIVE_MODEL_SELECT_CLASS = 'ytkn-settings__active-model-select';

export const DEFAULT_TEMPERATURE = 0.3;
export const DEFAULT_FRONTMATTER_PROPERTY_ALLOWLIST = 'title aliases source channel channelUrl videoUrl playlistUrl videoId playlistId generated videoCount';

export const DEFAULT_ANTHROPIC_MAX_TOKENS = 256000;
export const DEFAULT_THINKING_BUDGET_TOKENS = 8192;
export const FALLBACK_CONTEXT_WINDOW_TOKENS: Record<string, number> = {
	anthropic: 200000,
	gemini: 128000,
	openai: 64000,
	'openai-compatible': 64000,
	ollama: 32768,
};
