import type { Template } from '../../types';

export const studyTemplate: Template = {
	id: 'study',
	label: 'Study notes',
	subtitle: 'Notes for learning a topic: concepts, self-test, things to remember.',
	body: `Produce study notes optimized for re-reading and recall.

## TL;DR
1-2 sentences naming what the learner should walk away knowing.

## Prerequisites
3-6 bullets listing concepts or skills the reader should already know to follow this material. Omit if the source is genuinely beginner-friendly.

## Concepts
For each major concept covered:
- **Concept name** — one-sentence definition. Add a short example only if the source provides one.

Aim for 4-8 concepts; do not pad.

## How it works
Numbered walkthrough of the mental model or process the source teaches. Each step is short and concrete.

## Worked examples
1-3 worked examples drawn directly from the source. Use fenced code blocks, tables, or step lists as the example demands. Skip this section if the source has no concrete examples.

## Self-test
3-5 questions a learner should answer after the video. Render each as a question line followed by a collapsed callout containing the answer:

> [!question]- Question text?
> Answer drawn from the source.

## To remember
5-7 short statements suitable for spaced repetition. Each one is a single recall-friendly fact.

Style:
- Concept names and questions should match the source's vocabulary.
- Do not invent examples that were not in the transcript.`,
	sections: [
		{ id: 'tldr', heading: 'TL;DR', required: true, description: '1-2 sentences naming what the learner walks away knowing.' },
		{ id: 'prerequisites', heading: 'Prerequisites', required: false, description: 'Concepts or skills the reader needs first.' },
		{ id: 'concepts', heading: 'Concepts', required: false, description: '4-8 named concepts with one-sentence definitions.' },
		{ id: 'how-it-works', heading: 'How it works', required: false, description: 'Numbered walkthrough of the mental model.' },
		{ id: 'worked-examples', heading: 'Worked examples', required: false, description: '1-3 worked examples from the source.' },
		{ id: 'self-test', heading: 'Self-test', required: false, description: 'Recall questions with collapsed-callout answers.' },
		{ id: 'to-remember', heading: 'To remember', required: false, description: '5-7 atomic recall-ready bullets.' },
	],
	frontmatter: [],
	tags: ['ytkn/study'],
	controls: [
		{
			id: 'learner_level',
			label: 'Learner level',
			type: 'enum',
			enumValues: ['intro', 'intermediate', 'advanced'],
			required: false,
			default: 'intermediate',
			description: 'Shapes assumed prior knowledge, and self-test difficulty.',
		},
	],
};
