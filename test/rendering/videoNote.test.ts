import { describe, expect, it } from 'vitest';
import { getTemplate } from '../../src/ai/templates/registry';
import { renderVideoNote } from '../../src/rendering/videoNote';
import type { GenerationOptions, TranscriptResponse } from '../../src/types';

const transcript: TranscriptResponse = {
	url: 'https://youtube.com/watch?v=abc',
	videoId: 'abc',
	title: 'Sample',
	author: 'Author',
	channelUrl: 'https://youtube.com/channel/x',
	lines: [{ text: 'Sample line.', offset: 0 }],
};

const options: GenerationOptions = {
	includeFrontmatter: true,
	mediaEmbedMode: 'none',
	sourceSectionPosition: 'bottom',
	tldrCalloutAtTop: true,
	transcriptMode: 'none',
	frontmatterTags: '',
	frontmatterPropertyAllowlist: 'title source channel channelUrl videoUrl videoId playlistId generated videoCount',
};

describe('video note template rendering', () => {
	it('study: handles collapsed Q&A callouts and prerequisites', () => {
		const aiBody = `## TL;DR
You will learn X.

## Prerequisites
- Knowledge of Y

## Self-test
> [!question]- What is X?
> X is the answer.`;

		const { content } = renderVideoNote(transcript, '', transcript.url, aiBody, options, getTemplate('study'));
		expect(content).toContain('## Prerequisites');
		expect(content).toContain('## Self-test');
		expect(content).toContain('> [!question]-');
		expect(content).toContain('> [!summary] TL;DR');
		expect(content).toContain('You will learn X.');
		expect(content.indexOf('## Prerequisites')).toBeLessThan(content.indexOf('## Self-test'));
	});

	it('full-extract: keeps declared sections in order and preserves unknown headings afterward', () => {
		const aiBody = `## All claims and assertions
- Claim A

## Surprise extra
- Something the AI added

## People referenced
- Alice`;

		const { content } = renderVideoNote(transcript, '', transcript.url, aiBody, options, getTemplate('full-extract'));
		expect(content).toContain('## All claims and assertions');
		expect(content).toContain('## People referenced');
		expect(content).toContain('## Surprise extra');
		const claimsIndex = content.indexOf('## All claims and assertions');
		const peopleIndex = content.indexOf('## People referenced');
		expect(peopleIndex).toBeGreaterThan(claimsIndex);
	});

	it('preserves unmatched output when an add-ons-only response contains no requested add-on', () => {
		const { content, warnings } = renderVideoNote(
			transcript,
			'',
			transcript.url,
			'## Concept map\n- Near-miss output that would otherwise be lost.',
			{
				...options,
				includeFrontmatter: false,
				generateAiSummary: false,
				includeMindmap: true,
			},
			null,
		);

		expect(content).toContain('## Concept map');
		expect(warnings.some((warning) => warning.includes('preserved'))).toBe(true);
	});

	it('preserves unmatched output when an add-ons-only response contains one requested add-on', () => {
		const { content, warnings } = renderVideoNote(
			transcript,
			'',
			transcript.url,
			'## TL;DR\nThe gist.\n\n## Concept map\n- Near-miss content.',
			{
				...options,
				includeFrontmatter: false,
				generateAiSummary: false,
				includeMindmap: true,
			},
			null,
		);

		expect(content).toContain('> The gist.');
		expect(content).toContain('## Concept map\n- Near-miss content.');
		expect(warnings.some((warning) => warning.includes('preserved'))).toBe(true);
	});

	it('preserves user-defined output in manual mode', () => {
		const aiBody = `## Anything\nuser-defined output`;
		const { content, warnings } = renderVideoNote(transcript, '', transcript.url, aiBody, options, null);
		expect(content).toContain('user-defined output');
		expect(warnings.some((warning) => warning.includes('TL;DR'))).toBe(true);
	});
});
