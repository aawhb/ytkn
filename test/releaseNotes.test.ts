import { describe, expect, it } from 'vitest';
import {
	getRecentReleaseNotes,
	getReleaseNote,
	ReleaseNote,
	resolveReleaseNotesStartupAction,
} from '../src/releaseNotes';

const notes: ReleaseNote[] = [
	{ version: '2.0.0', date: '2026-02-01', showOnUpdate: true, new: ['Two'] },
	{ version: '1.9.0', date: '2026-01-01', showOnUpdate: false, fixed: ['One'] },
	{ version: '1.8.0', date: '2025-12-01', improved: ['Older'] },
];

describe('release notes helpers', () => {
	it('finds notes by exact version', () => {
		expect(getReleaseNote('2.0.0', notes)?.new).toEqual(['Two']);
		expect(getReleaseNote('missing', notes)).toBeNull();
	});

	it('returns the most recent notes up to the requested limit', () => {
		expect(getRecentReleaseNotes(2, notes).map((note) => note.version)).toEqual(['2.0.0', '1.9.0']);
		expect(getRecentReleaseNotes(0, notes)).toEqual([]);
	});

	it('marks fresh installs as seen without opening the update modal', () => {
		expect(resolveReleaseNotesStartupAction({
			currentVersion: '2.0.0',
			hasSavedSettings: false,
			lastSeenVersion: null,
			notes,
		})).toEqual({ kind: 'mark-seen' });
	});

	it('does nothing when the current version has already been seen', () => {
		expect(resolveReleaseNotesStartupAction({
			currentVersion: '2.0.0',
			hasSavedSettings: true,
			lastSeenVersion: '2.0.0',
			notes,
		})).toEqual({ kind: 'none' });
	});

	it('shows the current release note for existing installs with no seen version or an older seen version', () => {
		expect(resolveReleaseNotesStartupAction({
			currentVersion: '2.0.0',
			hasSavedSettings: true,
			lastSeenVersion: null,
			notes,
		})).toEqual({ kind: 'show', notes: [notes[0]] });

		expect(resolveReleaseNotesStartupAction({
			currentVersion: '2.0.0',
			hasSavedSettings: true,
			lastSeenVersion: '1.0.0',
			notes,
		})).toEqual({ kind: 'show', notes: [notes[0]] });
	});

	it('marks the version as seen without opening when notes are missing or opted out', () => {
		expect(resolveReleaseNotesStartupAction({
			currentVersion: '3.0.0',
			hasSavedSettings: true,
			lastSeenVersion: '2.0.0',
			notes,
		})).toEqual({ kind: 'mark-seen' });

		expect(resolveReleaseNotesStartupAction({
			currentVersion: '1.9.0',
			hasSavedSettings: true,
			lastSeenVersion: '1.8.0',
			notes,
		})).toEqual({ kind: 'mark-seen' });
	});
});
