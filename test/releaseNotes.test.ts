import { describe, expect, it } from 'vitest';
import type { ReleaseNote } from '../src/releaseNotes';
import {
	getRecentReleaseNotes,
	resolveReleaseNotesStartupAction,
} from '../src/releaseNotes';

const notes: ReleaseNote[] = [
	{ version: '2.0.0', date: '2026-02-01', showOnUpdate: true, new: ['Two'] },
	{ version: '1.9.0', date: '2026-01-01', showOnUpdate: false, fixed: ['One'] },
	{ version: '1.8.0', date: '2025-12-01', improved: ['Older'] },
];

describe('release notes helpers', () => {
	it('returns every release from the two most recent release lines', () => {
		const releaseHistory: ReleaseNote[] = [
			{ version: '2.1.2', date: '2026-04-05' },
			{ version: '2.1.1', date: '2026-04-04' },
			{ version: '2.0.3', date: '2026-03-03' },
			{ version: '2.0.0', date: '2026-03-01' },
			{ version: '1.9.4', date: '2026-02-01' },
		];

		expect(getRecentReleaseNotes(releaseHistory).map((note) => note.version)).toEqual([
			'2.1.2',
			'2.1.1',
			'2.0.3',
			'2.0.0',
		]);
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

	it('opens the shared release-notes modal for existing installs with no seen version or an older seen version', () => {
		expect(resolveReleaseNotesStartupAction({
			currentVersion: '2.0.0',
			hasSavedSettings: true,
			lastSeenVersion: null,
			notes,
		})).toEqual({ kind: 'show' });

		expect(resolveReleaseNotesStartupAction({
			currentVersion: '2.0.0',
			hasSavedSettings: true,
			lastSeenVersion: '1.0.0',
			notes,
		})).toEqual({ kind: 'show' });
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
