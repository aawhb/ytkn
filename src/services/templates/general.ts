import type { Template } from '../../types';

export const generalTemplate: Template = {
	id: 'general',
	label: 'General knowledge note',
	subtitle: 'Balanced summary, takeaways, where it applies, and limits. Best default.',
	body: `Produce a balanced knowledge note for a general-purpose vault.

## TL;DR
1-2 sentences capturing the single most important takeaway.

## Key takeaways
5-7 bullets. Durable, reusable ideas — not minor details.

## When this applies
3-5 bullets phrased as concrete reuse guidance:
- Use this when…
- Prefer this over X when…
- Best fit for…

## Limits and pushback
3-5 bullets. Tradeoffs, exceptions, scope limits, claims that look strong but rest on weak evidence, sponsor content if relevant.

## Evidence
3-5 bullets with concrete anchors from the source: notable mechanisms, specific examples, memorable claims, useful one-liners.

Style:
- Prefer reusable ideas over transcript-level detail.
- Compact, not chatty.`,
	sections: [
		{ id: 'tldr', heading: 'TL;DR', required: true, description: '1-2 sentences capturing the single most important takeaway.' },
		{ id: 'key-takeaways', heading: 'Key takeaways', required: false, description: '5-7 bullets of durable, reusable ideas.' },
		{ id: 'when-this-applies', heading: 'When this applies', required: false, description: '3-5 bullets of concrete reuse guidance.' },
		{ id: 'limits-and-pushback', heading: 'Limits and pushback', required: false, description: '3-5 bullets covering tradeoffs and weak claims.' },
		{ id: 'evidence', heading: 'Evidence', required: false, description: '3-5 bullets with concrete anchors from the source.' },
	],
	frontmatter: [],
	tags: ['ytkn/general'],
};
