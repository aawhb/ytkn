import type { Template } from '../../types';

export const fullExtractTemplate: Template = {
	id: 'full-extract',
	label: 'Full extract',
	subtitle: 'Extract every claim, tool, person, source, and quote worth keeping.',
	body: `Produce an exhaustive extraction note. The reader will use this note as a ctrl-F-friendly archive and never re-watch the video. Optimize for density, not narrative.

## TL;DR
1-2 sentences naming the through-line of the video.

## All claims and assertions
Every distinct claim or assertion the speaker makes, one per bullet, with a short support phrase. Do not compress. If unsure whether a fact is worth keeping, keep it.

## Examples and anecdotes
Every example, story, or anecdote, one per bullet. Preserve names, dates, and specifics.

## Tools, products, libraries
Every tool, product, library, framework, or service mentioned, one per bullet. Include a short description if the speaker gave one.

## People referenced
Every person the speaker references, one per bullet, with their role or relevance.

## Sources cited
Every book, paper, URL, or other source the speaker invokes, one per bullet.

## Numbers and statistics
Every number, percentage, dollar amount, or quantitative claim, one per bullet, with the context the speaker provided.

Style:
- Density first. Do not summarize. Do not collapse three specifics into one.
- Skip empty sections rather than write filler like "no examples".`,
	sections: [
		{ id: 'tldr', heading: 'TL;DR', required: true, description: '1-2 sentences naming the through-line.' },
		{ id: 'claims', heading: 'All claims and assertions', required: false, description: 'Every distinct claim with brief support.' },
		{ id: 'examples', heading: 'Examples and anecdotes', required: false, description: 'Every example or story.' },
		{ id: 'tools', heading: 'Tools, products, libraries', required: false, description: 'Every product/library/service mentioned.' },
		{ id: 'people', heading: 'People referenced', required: false, description: 'Every person referenced with role.' },
		{ id: 'sources', heading: 'Sources cited', required: false, description: 'Every book/paper/URL invoked.' },
		{ id: 'numbers', heading: 'Numbers and statistics', required: false, description: 'Every quantitative claim with context.' },
	],
	frontmatter: [],
	tags: ['ytkn/full-extract'],
	controls: [
		{
			id: 'density',
			label: 'Extraction density',
			type: 'enum',
			enumValues: ['concise', 'comprehensive', 'exhaustive'],
			required: false,
			default: 'comprehensive',
			description: 'Shapes the level of detail preservation.',
		},
	],
};
