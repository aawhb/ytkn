import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
    extractTldr,
    sanitizeModelOutput,
    shiftMarkdownHeadings,
} from '../../src/services/outputNormalizer';
import { safeLineArbitrary, safeParagraphArbitrary } from './generators';

describe('output normalizer property tests', () => {
    it('keeps sanitizeModelOutput idempotent for arbitrary input', () => {
        fc.assert(fc.property(fc.string({ maxLength: 250 }), (input) => {
            const sanitized = sanitizeModelOutput(input);

            expect(sanitizeModelOutput(sanitized)).toBe(sanitized);
        }));
    });

    it('extracts an explicit TL;DR block and leaves the remaining section body intact', () => {
        fc.assert(fc.property(safeLineArbitrary, safeParagraphArbitrary, (tldr, details) => {
            const input = `## TL;DR\n${tldr}\n\n## Details\n${details}`;
            const result = extractTldr(input);

            expect(result.tldr).toBe(tldr.trim());
            expect(result.body).toBe(`## Details\n${details}`);
        }));
    });

    it('falls back to the first paragraph when no TL;DR heading exists', () => {
        fc.assert(fc.property(safeLineArbitrary, safeParagraphArbitrary, (intro, details) => {
            const input = `${intro}\n\n## Details\n${details}`;
            const result = extractTldr(input);

            expect(result.tldr).toBe(intro.trim());
            expect(result.body).toBe(`## Details\n${details}`);
        }));
    });

    it('only shifts headings outside fenced code blocks', () => {
        fc.assert(fc.property(
            safeLineArbitrary,
            safeLineArbitrary,
            fc.integer({ min: 1, max: 3 }),
            (heading, codeHeading, levels) => {
                const input = [
                    `## ${heading}`,
                    '```',
                    `## ${codeHeading}`,
                    '```',
                    `### ${heading} trailing`,
                ].join('\n');
                const shifted = shiftMarkdownHeadings(input, levels);
                const lines = shifted.split('\n');

                expect(lines[0]).toBe(`${'#'.repeat(levels + 2)} ${heading}`);
                expect(lines[1]).toBe('```');
                expect(lines[2]).toBe(`## ${codeHeading}`);
                expect(lines[3]).toBe('```');
                expect(lines[4]).toBe(`${'#'.repeat(levels + 3)} ${heading} trailing`);
            },
        ));
    });
});
