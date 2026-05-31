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

export const RELEASE_NOTES: ReleaseNote[] = [
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
			'A new "Use AI" master switch to turn off AI summary, mindmap, and memorable quote generation.',
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