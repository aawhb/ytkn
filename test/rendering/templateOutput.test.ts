import { describe, expect, it } from 'vitest';
import { splitBodyByH2 } from '../../src/rendering/templateOutput';

describe('splitBodyByH2', () => {
	it('unwraps a whole-response Markdown fence before finding sections', () => {
		const result = splitBodyByH2([
			'```markdown',
			'## Code patterns',
			'- Keep this section.',
			'',
			'## Gotchas',
			'- Keep this one too.',
			'```',
		].join('\n'));

		expect(result).toEqual({
			preamble: '',
			sections: [
				{ heading: 'Code patterns', body: '- Keep this section.' },
				{ heading: 'Gotchas', body: '- Keep this one too.' },
			],
		});
	});

	it('preserves a whole-response code fence without a Markdown language tag', () => {
		const input = [
			'```',
			'## install dependencies',
			'npm install',
			'```',
		].join('\n');

		expect(splitBodyByH2(input)).toEqual({
			preamble: input,
			sections: [],
		});
	});

	it('ignores H2-looking lines inside fenced code blocks', () => {
		const result = splitBodyByH2([
			'## Code patterns',
			'```sh',
			'## install dependencies',
			'npm install',
			'```',
			'',
			'## Gotchas',
			'- Keep the fence intact.',
		].join('\n'));

		expect(result.sections).toEqual([
			{
				heading: 'Code patterns',
				body: '```sh\n## install dependencies\nnpm install\n```',
			},
			{ heading: 'Gotchas', body: '- Keep the fence intact.' },
		]);
	});

	it('does not close a fence when a marker-like code line has trailing content', () => {
		const result = splitBodyByH2([
			'## Code patterns',
			'```md',
			'```not-a-closing-fence',
			'## still code',
			'```',
			'## Evidence',
			'Outside.',
		].join('\n'));

		expect(result.sections).toEqual([
			{
				heading: 'Code patterns',
				body: '```md\n```not-a-closing-fence\n## still code\n```',
			},
			{ heading: 'Evidence', body: 'Outside.' },
		]);
	});
});
