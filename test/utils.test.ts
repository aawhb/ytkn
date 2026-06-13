import { describe, expect, it } from 'vitest';
import {
	decodeHtmlEntities,
	decodeHtmlEntitiesDeep,
	formatSequenceName,
	getErrorMessage,
	normalizeWhitespace,
	normalizeVaultFolderPath,
	resolveUniqueNotePath,
	sanitizeNoteFileName,
} from '../src/utils';

describe('getErrorMessage', () => {
	it('returns the message of an Error', () => {
		expect(getErrorMessage(new Error('boom'))).toBe('boom');
	});

	it('coerces non-Error values to strings', () => {
		expect(getErrorMessage('failed')).toBe('failed');
		expect(getErrorMessage(42)).toBe('42');
		expect(getErrorMessage(undefined)).toBe('undefined');
	});
});

describe('normalizeWhitespace', () => {
	it('collapses repeated whitespace and trims the result', () => {
		expect(normalizeWhitespace('  a\n\t b  ')).toBe('a b');
	});
});

describe('decodeHtmlEntities', () => {
	it('decodes named and numeric HTML entities used by YouTube and model output', () => {
		expect(decodeHtmlEntities('Tom &amp; Jerry &#39;x&#39; &quot;y&quot; &apos;z&apos; &lt;tag&gt; &#65;')).toBe('Tom & Jerry \'x\' "y" \'z\' <tag> A');
	});

	it('decodes broader HTML5 named and hex numeric entities', () => {
		expect(decodeHtmlEntities('Rock&rsquo;n&rsquo;roll &copy; &#x27;quoted&#x27; &nbsp;')).toBe('Rock\u2019n\u2019roll \u00A9 \'quoted\' \u00A0');
	});

	it('requires semicolons for named entities so metadata text is not corrupted', () => {
		expect(decodeHtmlEntities('Copyright &copy 2026')).toBe('Copyright &copy 2026');
		expect(decodeHtmlEntities('Terms&timesheets')).toBe('Terms&timesheets');
		expect(decodeHtmlEntities('Do this&nothing else')).toBe('Do this&nothing else');
		expect(decodeHtmlEntities('?a=1&region=US')).toBe('?a=1&region=US');
	});

	it('leaves unknown entities unchanged', () => {
		expect(decodeHtmlEntities('Unknown &bogus; stays')).toBe('Unknown &bogus; stays');
	});

	it('decodes one layer only', () => {
		expect(decodeHtmlEntities('&amp;lt;div&amp;gt;')).toBe('&lt;div&gt;');
	});
});

describe('decodeHtmlEntitiesDeep', () => {
	it('decodes double-encoded entities all the way down', () => {
		expect(decodeHtmlEntitiesDeep('&amp;lt;div&amp;gt;')).toBe('<div>');
	});

	it('decodes triple-encoded entities all the way down', () => {
		expect(decodeHtmlEntitiesDeep('&amp;amp;amp;')).toBe('&');
	});

	it('decodes single-encoded entities like one pass would', () => {
		expect(decodeHtmlEntitiesDeep('Tom &amp; Jerry &lt;tag&gt;')).toBe('Tom & Jerry <tag>');
	});

	it('does not create a semicolonless entity while decoding nested metadata', () => {
		expect(decodeHtmlEntitiesDeep('Terms&amp;timesheets')).toBe('Terms&timesheets');
		expect(decodeHtmlEntitiesDeep('?a=1&amp;region=US')).toBe('?a=1&region=US');
	});

	it('leaves unknown entities unchanged without looping forever', () => {
		expect(decodeHtmlEntitiesDeep('Unknown &bogus; stays')).toBe('Unknown &bogus; stays');
	});
});

describe('sanitizeNoteFileName', () => {
	it('strips invalid filesystem characters and trims whitespace', () => {
		expect(sanitizeNoteFileName('  My:/\\*?"<>| Video.  ')).toBe('My Video');
	});

	it('returns an empty string when nothing is left after sanitisation', () => {
		expect(sanitizeNoteFileName('   ')).toBe('');
		expect(sanitizeNoteFileName('///')).toBe('');
	});

	it('rewrites Windows reserved device names so the file can be created on NTFS', () => {
		expect(sanitizeNoteFileName('CON')).toBe('CON note');
		expect(sanitizeNoteFileName('aux')).toBe('aux note');
		expect(sanitizeNoteFileName('LPT3')).toBe('LPT3 note');
	});

	it('leaves names containing reserved words alone when they are not exact matches', () => {
		expect(sanitizeNoteFileName('Confidential')).toBe('Confidential');
		expect(sanitizeNoteFileName('NUL bug report')).toBe('NUL bug report');
	});

	it('strips ASCII control characters', () => {
		expect(sanitizeNoteFileName(`Hi${String.fromCharCode(0)}there`)).toBe('Hi there');
		expect(sanitizeNoteFileName(`Tab	here`)).toBe('Tab here');
	});
});

describe('resolveUniqueNotePath', () => {
	it('returns the desired path when nothing exists', () => {
		expect(resolveUniqueNotePath('Notes', 'Video', 'md', '', () => false)).toBe('Notes/Video.md');
	});

	it('returns the current path when the desired title already matches it', () => {
		expect(resolveUniqueNotePath('Notes', 'Video', 'md', 'Notes/Video.md', () => true)).toBe('Notes/Video.md');
	});

	it('adds a numeric suffix when the desired note name already exists', () => {
		const existing = new Set(['Notes/Video.md', 'Notes/Video 2.md']);
		expect(resolveUniqueNotePath('Notes', 'Video', 'md', 'Notes/Current.md', (path) => existing.has(path))).toBe('Notes/Video 3.md');
	});

	it('drops the directory prefix when no folder is given', () => {
		expect(resolveUniqueNotePath('', 'Video', 'md', '', () => false)).toBe('Video.md');
	});

	it('throws after exhausting the suffix cap rather than looping forever', () => {
		expect(() =>
			resolveUniqueNotePath('Notes', 'Video', 'md', '', () => true),
		).toThrow(/Could not find a unique note path/);
	});
});

describe('normalizeVaultFolderPath', () => {
	it('trims whitespace and surrounding slashes', () => {
		expect(normalizeVaultFolderPath('  /YouTube Notes/Nested/  ')).toBe('YouTube Notes/Nested');
	});

	it('normalizes backslashes and repeated slashes', () => {
		expect(normalizeVaultFolderPath('YouTube Notes\\Nested//Deep')).toBe('YouTube Notes/Nested/Deep');
	});

	it('trims non-breaking space around user-entered paths', () => {
		expect(normalizeVaultFolderPath('\u00A0/YouTube Notes/\u00A0')).toBe('YouTube Notes');
	});

	it('returns an empty string when only slashes are present', () => {
		expect(normalizeVaultFolderPath('/')).toBe('');
		expect(normalizeVaultFolderPath('////')).toBe('');
		expect(normalizeVaultFolderPath('\\\\')).toBe('');
	});
});

describe('formatSequenceName', () => {
	it('pads indices to at least two digits', () => {
		expect(formatSequenceName('Playlist Name', 2, 12)).toBe('Playlist Name 02');
	});

	it('uses the wider of total or index when computing pad width', () => {
		expect(formatSequenceName('Playlist Name', 5, 100)).toBe('Playlist Name 005');
		expect(formatSequenceName('Playlist Name', 250, 5)).toBe('Playlist Name 250');
	});
});
