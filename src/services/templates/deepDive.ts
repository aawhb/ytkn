import type { Template } from '../../types';

export const deepDiveTemplate: Template = {
	id: 'deep-dive',
	label: 'Deep dive (topic reference)',
	subtitle: 'Topic reference, canonical concept, mental model, gaps to learn.',
	body: `Produce a deep-dive note that belongs to the topic, not just to this video. Future videos on the same topic should be able to add to this note. Define terms canonically and surface what is missing as much as what is present.

## TL;DR
1-2 sentences naming the topic and the central insight.

## Core concept
The canonical definition of the topic. Lead with a one-paragraph definition the reader could quote. Then, in 2-4 sentences or bullets, give the intuition: how to think about it informally.

## Mental model
A short, transferable mental model the reader can hold in their head. Diagrams in Mermaid are welcome if the source supports them.

## Components / sub-topics
The pieces this topic decomposes into. For each:
- **Component name** — one-sentence role inside the larger topic.

## How it works
Mechanics: how the components interact, what the dynamics are, what makes the topic behave the way it does. Numbered if sequential, bulleted if not.

## Why it matters
2-4 bullets on practical implications. Skip if the source is purely theoretical.

## Common confusions
3-5 bullets. Pitfalls, near-synonyms that aren't actually synonyms, places where the obvious intuition is wrong.

## Adjacent topics
3-6 bullets linking out to related topics. Wrap each adjacent topic in \`[[double brackets]]\` so Obsidian can link it.

## Open threads
2-5 bullets naming what this video does NOT cover that the reader should learn next. This is mandatory rigor: every deep-dive note has gaps.

Style:
- Define terms canonically; the reader will reference this for years.
- Surface gaps explicitly rather than hide them.`,
	sections: [
		{ id: 'tldr', heading: 'TL;DR', required: true, description: '1-2 sentences naming the topic and central insight.' },
		{ id: 'core-concept', heading: 'Core concept', required: false, description: 'Canonical definition + intuition.' },
		{ id: 'mental-model', heading: 'Mental model', required: false, description: 'Transferable mental model.' },
		{ id: 'components', heading: 'Components / sub-topics', required: false, description: 'Decomposition into named parts.' },
		{ id: 'how-it-works', heading: 'How it works', required: false, description: 'Mechanics and dynamics.' },
		{ id: 'why-it-matters', heading: 'Why it matters', required: false, description: 'Practical implications.' },
		{ id: 'common-confusions', heading: 'Common confusions', required: false, description: 'Pitfalls and false synonyms.' },
		{ id: 'adjacent-topics', heading: 'Adjacent topics', required: false, description: '[[Linked]] adjacent topics.' },
		{ id: 'open-threads', heading: 'Open threads', required: false, description: 'What is NOT covered, to learn next.' },
	],
	frontmatter: [],
	tags: ['ytkn/deep-dive'],
	controls: [
		{
			id: 'audience_level',
			label: 'Audience level',
			type: 'enum',
			enumValues: ['intro', 'intermediate', 'advanced'],
			required: false,
			default: 'intermediate',
			description: 'Shapes analogies, and depth of explanation.',
		},
	],
};