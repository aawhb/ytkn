export interface ReleaseNote {
	version: string;
	date: string;
	showOnUpdate?: boolean;
	summary?: string;
	new?: string[];
	improved?: string[];
	fixed?: string[];
	changed?: string[];
}

export interface ReleaseNotesStartupInput {
	currentVersion: string;
	hasSavedSettings: boolean;
	lastSeenVersion: string | null;
	notes?: readonly ReleaseNote[];
}

export type ReleaseNotesStartupAction =
	| { kind: 'none' }
	| { kind: 'mark-seen' }
	| { kind: 'show'; notes: ReleaseNote[] };

export const SUPPORT_LINKS = {
	githubSponsors: 'https://github.com/sponsors/aawhb',
	buyMeACoffee: 'https://buymeacoffee.com/aawhb',
} as const;

export const DOCUMENTATION_LINK = 'https://github.com/aawhb/ytkn/blob/main/docs/getting-started.md';

const RELEASE_NOTES: ReleaseNote[] = [
	{
		version: '1.8.1',
		date: '2026-07-20',
		showOnUpdate: true,
		summary: 'Improved phone layouts and generation modal behavior.',
		improved: [
			'Phone layouts give generation controls more room and keep settings controls usable at narrow widths.',
			'Channel filters and run reports use the shorter Streams label.',
		],
		fixed: [
			'The generation modal opens at the top on phones and keeps its header clear of the close button.',
		],
	},
	{
		version: '1.8.0',
		date: '2026-07-19',
		showOnUpdate: true,
		summary: 'Entire YT Channel link support, AI model automatic fallbacks, and automatic opening of generated note',
		new: [
			'Support for Youtube channels. Create notes from videos, Shorts, and stream replays by providing a channel link and selecting one or more channel content type.',
			'AI requests can now switch automatically between models using an ordered list that keeps the successful fallback for the rest of the run.',
			'A toggle for Folder runs that opens the generated note in a new tab and the first generated note for a playlist run.',
		],
		improved: [
			'The generation queue now has clearer status cards, accessible controls, and bounded recent history.',
			'Clearer Settings and generation copy.',
		],
		fixed: [
			'AI requests now use mobile-safe native transport.',
			'Queued writes to the current note now stop safely if the note changed while the run was waiting.',
			'A run-report write failure no longer prevents later queued runs from starting.',
			'Provider errors shown in note progress blocks are bounded and escaped before Markdown rendering.',
		],
	},
	{
		version: '1.7.2',
		date: '2026-06-02',
		showOnUpdate: true,
		summary: 'Independent TL;DR generation, richer video metadata, and better combined playlist handling.',
		new: [
			'TL;DR callouts can now be generated independently from the full AI summary, including TL;DR-only notes.',
			'Combined playlist mode now supports transcript-only notes without AI.',
			'Video frontmatter can include `uploadDate` and `videoCategory` when available from YouTube metadata.',
		],
		improved: [
			'Combined playlist source lists now link video channel names when YouTube provides channel metadata.',
		],
		fixed: [
			'Combined playlist video embeds now use the first playlist video instead of rendering a broken playlist URL embed.',
			'Combined playlist thumbnail mode now uses the first video thumbnail instead of omitting media.',
			'Transcript text is now escaped before Markdown rendering so caption tokens like `<unk>` no longer break transcript callouts.',
		],
	},
	{
		version: '1.7.1',
		date: '2026-06-01',
		showOnUpdate: true,
		summary: 'Bug fixes',
		fixed: [
			'Fix for playlists generation on mobile devices',
			'Fix mobile branding'
		],
	},
	{
		version: '1.7.0',
		date: '2026-05-31',
		showOnUpdate: true,
		summary: 'Better long-playlist runs, richer video metadata, AI-optional notes, and clearer provider/queue UI.',
		new: [
			'Existing installs now get an in-plugin recent updates modal for this release.',
			'The generation modal and settings tab now include quick access to the queue for long-running batches.',
			'Metadata-only notes can now be generated with AI off and transcript inclusion off.',
			'Video frontmatter can include thumbnailUrl, videoDescription, channelId, durationSeconds, and keywords.',
			'A new AI master switch to turn off AI summary, mindmap, and memorable quote generation.',
		],
		improved: [
			'Run reports now count videos inside playlists instead of only the submitted playlist URL.',
			'Captionless videos can still produce useful source and metadata notes in metadata-only mode.',
			'AI provider settings now use simpler provider cards with plain provider/model summaries and standard model action buttons.',
			'Settings and generation-modal copy now share one source of truth for more consistent labels, descriptions, and dropdown options.',
			'Plugin commands use shorter labels: Generate and Cancel all queued.',
		],
		fixed: [
			'Playlists with more than 100 videos now continue through nested YouTube continuation tokens.',
			'Turning off AI no longer applies AI template tags or hidden AI section warnings.',
		],
		changed: [
			'Added coverage reporting, focused provider/notification helper tests, and maintainer development conventions for safer future releases.',
		],
	},
];

export function getReleaseNote(version: string, notes: readonly ReleaseNote[] = RELEASE_NOTES): ReleaseNote | null {
	return notes.find((note) => note.version === version) ?? null;
}

export function getRecentReleaseNotes(limit = 3, notes: readonly ReleaseNote[] = RELEASE_NOTES): ReleaseNote[] {
	return notes.slice(0, Math.max(0, limit));
}

export function resolveReleaseNotesStartupAction(input: ReleaseNotesStartupInput): ReleaseNotesStartupAction {
	const currentNote = getReleaseNote(input.currentVersion, input.notes);

	if (!input.hasSavedSettings) {
		return { kind: 'mark-seen' };
	}

	if (input.lastSeenVersion === input.currentVersion) {
		return { kind: 'none' };
	}

	if (!currentNote || currentNote.showOnUpdate === false) {
		return { kind: 'mark-seen' };
	}

	return { kind: 'show', notes: [currentNote] };
}
