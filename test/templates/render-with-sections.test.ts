import { describe, expect, it } from 'vitest';
import { renderVideoNote } from '../../src/services/renderer';
import { getTemplate } from '../../src/services/templates';
import type { GenerationOptions, Template, TranscriptResponse } from '../../src/types';

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
	linkbackStyle: 'inline',
	tldrCalloutAtTop: true,
	transcriptMode: 'none',
	frontmatterTags: '',
	frontmatterPropertyAllowlist: 'title source channel channelUrl videoUrl videoId playlistId generated videoCount',
};

describe('full pipeline — declared templates', () => {
	it('synthetic: extracts frontmatter, reorders sections, sacred fields untouched', () => {
		const syntheticTemplate: Template = {
			id: 'general',
			label: 'Synthetic test template',
			subtitle: 'For testing only',
			body: 'Produce a note.',
			sections: [
				{ id: 'tldr', heading: 'TL;DR', required: true, description: '1-2 sentences.' },
				{ id: 'key-takeaways', heading: 'Key takeaways', required: false, description: 'Bullets.' },
				{ id: 'evidence', heading: 'Evidence', required: false, description: 'Anchors.' },
			],
			frontmatter: [
				{ key: 'topics', type: 'string[]', description: '2-5 topic tags.' },
				{ key: 'key_takeaway', type: 'string', description: 'One-line takeaway.' },
				{ key: 'confidence', type: 'enum', enumValues: ['high', 'medium', 'low'], description: 'Source quality.' },
			],
			tags: ['ytkn/general'],
		};

		const aiBody = `<!-- ytkn:frontmatter
topics: [knowledge, recall]
key_takeaway: Atomic notes beat long ones for recall.
confidence: medium
videoId: should_be_ignored
-->

## Key takeaways
- Bullet 1
- Bullet 2

## TL;DR
Atomic notes beat long ones for recall.

## Evidence
Source mentions a study on recall.`;

		const { content, warnings } = renderVideoNote(transcript, '', transcript.url, aiBody, options, syntheticTemplate);

		expect(content).toContain('videoId: "abc"');
		expect(content).not.toContain('should_be_ignored');
		expect(content).toContain('topics:\n  - "knowledge"\n  - "recall"');
		expect(content).toContain('key_takeaway: "Atomic notes beat long ones for recall."');
		expect(content).toContain('confidence: "medium"');
		const tldrIndex = content.indexOf('## Key takeaways');
		const evidenceIndex = content.indexOf('## Evidence');
		expect(tldrIndex).toBeGreaterThan(0);
		expect(evidenceIndex).toBeGreaterThan(tldrIndex);
		expect(content).toContain('> [!summary] TL;DR');
		expect(content).toContain('Atomic notes beat long ones for recall.');
		expect(warnings.some((w) => w.includes('videoId'))).toBe(true);
	});

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
		// prerequisite should appear BEFORE self-test in declared order
		expect(content.indexOf('## Prerequisites')).toBeLessThan(content.indexOf('## Self-test'));
	});

	it('full-extract: preserves all sections and unknown headings as extras', () => {
		const aiBody = `## TL;DR
Through-line.

## All claims and assertions
- Claim A

## Surprise extra
- Something the AI added

## People referenced
- Alice`;

		const { content } = renderVideoNote(transcript, '', transcript.url, aiBody, options, getTemplate('full-extract'));
		expect(content).toContain('## All claims and assertions');
		expect(content).toContain('## People referenced');
		expect(content).toContain('## Surprise extra');
		const declaredEnd = content.indexOf('## People referenced');
		const extraIndex = content.indexOf('## Surprise extra');
		expect(extraIndex).toBeGreaterThan(declaredEnd);
	});

	it('deep-dive: AI-extracted undeclared keys are dropped (frontmatter is empty)', () => {
		const aiBody = `<!-- ytkn:frontmatter
topic: Spaced repetition
parent_topic: Memory
open_questions_count: 3
-->

## TL;DR
Topic intro.

## Open threads
- Q1
- Q2
- Q3`;

		const { content, warnings } = renderVideoNote(transcript, '', transcript.url, aiBody, options, getTemplate('deep-dive'));
		// deep-dive now has frontmatter: [], so AI-extracted keys are undeclared and dropped
		expect(content).not.toContain('topic:');
		expect(content).not.toContain('parent_topic:');
		expect(content).not.toContain('open_questions_count:');
		expect(warnings.some((w) => w.includes('topic'))).toBe(true);
	});

	it('research: AI-extracted undeclared keys are dropped (frontmatter is empty)', () => {
		const aiBody = `<!-- ytkn:frontmatter
research_project: My project
inquiry: How does X work?
claims_count: 4
evidence_quality: mixed
-->

## TL;DR
Contribution.`;

		const { content, warnings } = renderVideoNote(transcript, '', transcript.url, aiBody, options, getTemplate('research'));
		// research now has frontmatter: [], so all AI-extracted keys are dropped
		expect(content).not.toContain('research_project:');
		expect(content).not.toContain('inquiry:');
		expect(content).not.toContain('claims_count:');
		expect(content).not.toContain('evidence_quality:');
		expect(warnings.some((w) => w.includes('research_project') || w.includes('inquiry') || w.includes('claims_count') || w.includes('evidence_quality'))).toBe(true);
	});

	it('section-less template: passthrough body, no extraction, no merge', () => {
		const sectionlessTemplate: Template = {
			id: 'general',
			label: 'Section-less fixture',
			subtitle: '',
			body: '',
		};
		const aiBody = `## TL;DR
A talk summary.

## Memorable quotes
> [!quote] Speaker
> Quote text.`;

		const { content, warnings } = renderVideoNote(transcript, '', transcript.url, aiBody, options, sectionlessTemplate);
		expect(content).toContain('A talk summary.');
		expect(content).toContain('## Memorable quotes');
		expect(content).toContain('> [!quote]');
		expect(warnings).toEqual([]);
	});

	it('manual mode: no template, no extraction, no merge', () => {
		const aiBody = `## Anything\nuser-defined output`;
		const { content, warnings } = renderVideoNote(transcript, '', transcript.url, aiBody, options, null);
		expect(content).toContain('user-defined output');
		expect(warnings).toEqual([]);
	});

	it('template control values do NOT appear in frontmatter', () => {
		const aiBody = `## TL;DR
Contribution.`;

		const optionsWithControls: GenerationOptions = {
			...options,
			controlValues: { inquiry: 'User-supplied: How does X scale?', strictness: 'strict' },
		};

		const { content } = renderVideoNote(
			transcript,
			'',
			transcript.url,
			aiBody,
			optionsWithControls,
			getTemplate('research'),
		);

		// Template controls shape prompts only — they must not appear in frontmatter.
		expect(content).not.toContain('inquiry:');
		expect(content).not.toContain('strictness:');
	});

	it('audience control values do NOT appear in frontmatter', () => {
		const aiBody = `## TL;DR
Topic intro.`;

		const optionsWithControls: GenerationOptions = {
			...options,
			controlValues: { audience_level: 'advanced' },
		};

		const { content } = renderVideoNote(
			transcript,
			'',
			transcript.url,
			aiBody,
			optionsWithControls,
			getTemplate('deep-dive'),
		);

		// Template controls shape prompts only — they must not appear in frontmatter.
		expect(content).not.toContain('audience_level');
	});

	it('implementation: no frontmatter output from unknown control values', () => {
		const aiBody = `## TL;DR
Build steps.`;

		const optionsWithControls: GenerationOptions = {
			...options,
			controlValues: { language: 'python' },
		};

		const { content } = renderVideoNote(
			transcript,
			'',
			transcript.url,
			aiBody,
			optionsWithControls,
			getTemplate('implementation'),
		);

		// Implementation declares no controls; stray control values should not affect frontmatter.
		expect(content).not.toContain('language:');
	});
});
