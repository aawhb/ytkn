import type { Template } from '../../types';

export const researchTemplate: Template = {
	id: 'research',
	label: 'Research dossier',
	subtitle: 'Inquiry-shaped: claims, evidence quality, gaps, sources to chase next.',
	body: `Produce a research dossier. The reader is investigating a question; this video is one data point. Be epistemically rigorous: distinguish strong claims from assertions, surface gaps the speaker glosses over, and flag what is missing as carefully as what is present.

## TL;DR
1-2 sentences naming this video's contribution to the inquiry.

## Inquiry
Restate the research question this video helps answer. If the user supplied an inquiry, use that wording. Otherwise, infer the most likely inquiry the reader had in mind.

## Claims made
Every distinct claim the speaker makes. For each, prefix with strength:
- **(strong)** — directly demonstrated, cited, or measured.
- **(supported)** — argued with evidence the speaker provides.
- **(asserted)** — stated without supporting evidence.
- **(weak)** — speculative or based on weak reasoning.

Write as: \`- **(strength)** Claim text — brief support or note.\`

## Evidence offered
Concrete evidence the speaker brings: data, citations, demonstrations, named experiments, anecdotes that carry real signal. One bullet per piece.

## What's missing / counter-evidence
3-6 bullets. What evidence would strengthen the strongest claims? What counter-evidence does the speaker not address? What would a skeptical expert push back on?

## Sources the speaker cites
Every book, paper, URL, person, or institution the speaker invokes. One per bullet.

## Implications for my research
2-5 bullets on what to do with this material in the broader inquiry: which claims to follow up on, which to discard, which to file as background.

## Next sources to find
2-5 bullets naming specific further sources to chase. Be concrete enough to search for.

Style:
- Be epistemically rigorous. Do not upgrade an assertion to a claim with strong evidence just because it sounds confident.
- Skeptic-first orientation: every assertion is suspect until evidence appears.`,
	sections: [
		{ id: 'tldr', heading: 'TL;DR', required: true, description: 'This video\'s contribution to the inquiry.' },
		{ id: 'inquiry', heading: 'Inquiry', required: false, description: 'The research question this video helps answer.' },
		{ id: 'claims', heading: 'Claims made', required: false, description: 'Every claim with explicit strength tag.' },
		{ id: 'evidence', heading: 'Evidence offered', required: false, description: 'Concrete evidence the speaker brings.' },
		{ id: 'whats-missing', heading: "What's missing / counter-evidence", required: false, description: 'Gaps the speaker does not address.' },
		{ id: 'sources', heading: 'Sources the speaker cites', required: false, description: 'Books, papers, URLs invoked.' },
		{ id: 'implications', heading: 'Implications for my research', required: false, description: 'What to do with this material.' },
		{ id: 'next-sources', heading: 'Next sources to find', required: false, description: 'Concrete further sources to chase.' },
	],
	frontmatter: [],
	tags: ['ytkn/research'],
	controls: [
		{
			id: 'inquiry',
			label: 'Research inquiry',
			type: 'string',
			required: true,
			description: 'The specific question you are investigating.',
			multiline: true,
		},
		{
			id: 'strictness',
			label: 'Epistemic strictness',
			type: 'enum',
			enumValues: ['lenient', 'standard', 'strict'],
			required: false,
			default: 'standard',
			description: 'How aggressively the AI distinguishes asserted from supported claims.',
		},
	],
};
