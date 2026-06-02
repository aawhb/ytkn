import { describe, expect, it } from 'vitest';
import {
    extractTldr,
    sanitizeModelOutput,
    shiftMarkdownHeadings,
} from '../../src/services/outputNormalizer';

describe('output normalizer', () => {
    it('sanitizes model-owned source/transcript sections and decodes Mermaid entities', () => {
        const input = [
            '## Summary',
            'Body.',
            '',
            '## Mindmap',
            '```mermaid',
            'graph TD',
            'A -&gt; B',
            '```',
            '',
            '## Source',
            'Model source that should be removed.',
        ].join('\n');

        const sanitized = sanitizeModelOutput(input);

        expect(sanitized).toContain('A -> B');
        expect(sanitized).not.toContain('A -&gt; B');
        expect(sanitized).not.toContain('Model source');
    });

    it('decodes common HTML entities inside Mermaid blocks only', () => {
        const input = [
            '## Summary',
            'Body &quot;outside Mermaid&quot; stays encoded.',
            '',
            '## Mindmap',
            '```mermaid',
            'mindmap',
            '  root((&quot;Quoted&quot; &lt;Topic&gt; &amp; &#65;))',
            '```',
        ].join('\n');

        const sanitized = sanitizeModelOutput(input);

        expect(sanitized).toContain('Body &quot;outside Mermaid&quot; stays encoded.');
        expect(sanitized).toContain('root(("Quoted" <Topic> & A))');
        expect(sanitized).not.toContain('&quot;Quoted&quot;');
        expect(sanitized).not.toContain('&lt;Topic&gt;');
        expect(sanitized).not.toContain('&amp; &#65;');
    });

    it('normalizes adjacent memorable quote callouts', () => {
        const sanitized = sanitizeModelOutput([
            '## Summary',
            'Body.',
            '',
            '## Memorable quotes',
            '> [!quote] First.',
            '[!quote] Second.',
        ].join('\n'));

        expect(sanitized).toContain('> [!quote] First.\n\n> [!quote] Second.');
    });

    it('extracts TL;DR sections and removes them from the body', () => {
        const result = extractTldr('## TL;DR\nMain point.\n\n## Details\nMore.');

        expect(result.tldr).toBe('Main point.');
        expect(result.body).toBe('## Details\nMore.');
    });

    it('shifts Markdown headings while leaving code fences intact', () => {
        const shifted = shiftMarkdownHeadings('## Real\n```\n## Code\n```', 1);

        expect(shifted).toContain('### Real');
        expect(shifted).toContain('## Code');
    });
});
