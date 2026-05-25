import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { sanitizeNoteFileName } from '../../src/utils';

const INVALID_NOTE_NAME_CHARS = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|']);
const WINDOWS_RESERVED_NAMES = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
] as const;

function applyLetterMask(value: string, mask: boolean[]): string {
    return value
        .split('')
        .map((char, index) => (mask[index] ? char.toLowerCase() : char.toUpperCase()))
        .join('');
}

describe('utils property tests', () => {
    it('keeps sanitized note names idempotent and free of invalid filesystem characters', () => {
        fc.assert(fc.property(fc.string({ maxLength: 250 }), (input) => {
            const sanitized = sanitizeNoteFileName(input);

            expect(sanitizeNoteFileName(sanitized)).toBe(sanitized);
            expect(/[. ]$/.test(sanitized)).toBe(false);

            for (const char of sanitized) {
                expect(INVALID_NOTE_NAME_CHARS.has(char)).toBe(false);
                expect(char.charCodeAt(0)).toBeGreaterThan(31);
            }
        }));
    });

    it('rewrites reserved Windows device names regardless of input casing', () => {
        fc.assert(fc.property(
            fc.constantFrom(...WINDOWS_RESERVED_NAMES),
            fc.array(fc.boolean(), { minLength: 3, maxLength: 4 }),
            (name, shortMask) => {
                const mask = Array.from({ length: name.length }, (_, index) => shortMask[index % shortMask.length] ?? false);
                const mixedCase = applyLetterMask(name, mask);

                expect(sanitizeNoteFileName(mixedCase)).toBe(`${mixedCase} note`);
            },
        ));
    });

    it('returns an empty string when the input is made only of whitespace, invalid chars, and trailing dots', () => {
        fc.assert(fc.property(
            fc.array(fc.constantFrom(' ', '\t', '\n', '\r', '.', '/', '\\', ':', '*', '?', '"', '<', '>', '|'), {
                minLength: 1,
                maxLength: 120,
            }),
            (chars) => {
                const input = chars.join('');

                expect(sanitizeNoteFileName(input)).toBe('');
            },
        ));
    });
});
