import { describe, expect, it } from 'vitest';
import {
	normalizeMemorableQuotesContent,
	normalizeMindmapContent,
	sanitizeModelOutput,
	shiftMarkdownHeadings,
} from '../../src/rendering/outputNormalizer';

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

	it('does not remove source or transcript headings inside fenced examples', () => {
		const input = [
			'## Example',
			'```markdown',
			'## Transcript',
			'This is example content.',
			'```',
			'',
			'## Summary',
			'Keep this summary.',
		].join('\n');

		expect(sanitizeModelOutput(input)).toBe(input);
	});

	it('removes only model-owned sections and preserves later H2 sections', () => {
		const input = [
			'## Summary',
			'Body.',
			'',
			'## Source',
			'Model source.',
			'',
			'## Appendix',
			'Keep this appendix.',
		].join('\n');

		expect(sanitizeModelOutput(input)).toBe([
			'## Summary',
			'Body.',
			'',
			'## Appendix',
			'Keep this appendix.',
		].join('\n'));
	});

	it('unwraps whole-response Markdown before removing model-owned sections', () => {
		const input = [
			'```markdown',
			'## Summary',
			'Body.',
			'',
			'## Source',
			'Model source.',
			'```',
		].join('\n');

		expect(sanitizeModelOutput(input)).toBe('## Summary\nBody.');
	});

	it('does not remove transcript details or normalize quote examples inside fences', () => {
		const input = [
			'## Example',
			'```markdown',
			'<details><summary>Transcript</summary>',
			'Example transcript.',
			'</details>',
			'## Memorable quotes',
			'[!quote] Example syntax.',
			'```',
			'',
			'## Summary',
			'Keep this summary.',
		].join('\n');

		expect(sanitizeModelOutput(input)).toBe(input);
	});

	it('does not decode entities in model prose, links, inline code, or fenced code', () => {
		const input = [
			'## Summary',
			'Tom &amp; Jerry and [docs](https://example.com/page?id=1&copy=2).',
			'Use `a &amp;&amp; b` in JavaScript.',
			'',
			'## Example',
			'```js',
			'const x = a &amp;&amp; b;',
			'```',
		].join('\n');

		const sanitized = sanitizeModelOutput(input);

		expect(sanitized).toContain('Tom &amp; Jerry and [docs](https://example.com/page?id=1&copy=2).');
		expect(sanitized).toContain('Use `a &amp;&amp; b` in JavaScript.');
		expect(sanitized).toContain('const x = a &amp;&amp; b;');
	});

	it('preserves valid model-authored Mermaid syntax instead of re-rendering it', () => {
		const mermaid = [
			'```mermaid',
			'mindmap',
			'  root((Library))',
			'    Books',
			'      ::icon(fa fa-book)',
			'    Input -> Output',
			'```',
		].join('\n');
		const sanitized = sanitizeModelOutput(`## Mindmap\n${mermaid}`);

		expect(sanitized).toBe(`## Mindmap\n${mermaid}`);
	});

	it('inserts decoded Mermaid entities literally when they contain replacement patterns', () => {
		const sanitized = sanitizeModelOutput([
			'## Mindmap',
			'```mermaid',
			'mindmap',
			'  root(("Budget &dollar;&amp; $$"))',
			'```',
		].join('\n'));

		expect(sanitized).toContain('root(("Budget $& $$"))');
	});

	it('does not decode nested Mermaid examples inside a longer outer fence', () => {
		const input = [
			'````markdown',
			'```mermaid',
			'mindmap',
			'  root(("Budget &dollar;&amp;"))',
			'```',
			'````',
		].join('\n');

		expect(sanitizeModelOutput(input)).toBe(input);
	});

	it('renders a Mindmap outline into a valid-by-construction mermaid block', () => {
		const input = [
			'## Mindmap',
			'- Frequency Count',
			'  - Time Complexity',
			'    - Derive polynomial $F(N)$',
			'    - Square Root Time O(sqrt(n))',
			'  - Design &amp;amp; Architecture',
		].join('\n');

		const sanitized = normalizeMindmapContent(input.replace('## Mindmap\n', ''));

		expect(sanitized).toContain('```mermaid');
		expect(sanitized).toContain('root(("Frequency Count"))');
		expect(sanitized).toContain('node1["Time Complexity"]');
		expect(sanitized).toContain('node2["Derive polynomial F(N)"]');
		expect(sanitized).toContain('node3["Square Root Time O(sqrt(n))"]');
		expect(sanitized).toContain('node4["Design and Architecture"]');
		expect(sanitized).not.toContain('$');
		expect(sanitized).not.toContain('&amp;');
	});

	it('normalizes adjacent memorable quote callouts', () => {
		const normalized = normalizeMemorableQuotesContent([
			'> [!quote] First.',
			'[!quote] Second.',
		].join('\n'));

		expect(normalized).toBe('> [!quote] First.\n\n> [!quote] Second.');
	});

	it('normalizes only quote callouts outside fences and preserves other section content', () => {
		const input = [
			'Context that must remain.',
			'```markdown',
			'[!quote] Example syntax.',
			'```',
			'[!quote] Real quote.',
		].join('\n');

		expect(normalizeMemorableQuotesContent(input)).toBe([
			'Context that must remain.',
			'```markdown',
			'[!quote] Example syntax.',
			'```',
			'> [!quote] Real quote.',
		].join('\n'));
	});

	it('shifts Markdown headings while leaving code fences intact', () => {
		const shifted = shiftMarkdownHeadings('## Real\n```\n## Code\n```', 1);

		expect(shifted).toContain('### Real');
		expect(shifted).toContain('## Code');
	});

	it('leaves headings inside tilde fences unchanged', () => {
		const shifted = shiftMarkdownHeadings('## Real\n~~~markdown\n## Code\n~~~', 1);

		expect(shifted).toBe('### Real\n~~~markdown\n## Code\n~~~');
	});
});
