import type { Template } from '../../types';

export const implementationTemplate: Template = {
	id: 'implementation',
	label: 'Implementation note',
	subtitle: 'Concrete steps, code, tools, and action items to act on the source.',
	body: `Produce an implementation-focused note for a reader who wants to act on what the source shows — write the steps, code, tools, and action items needed.

## TL;DR
1-2 sentences naming what is built and the core approach.

## Approach
A short paragraph or 3-5 bullets describing the strategy.

## Steps
Numbered, concrete steps. Each step is one sentence. Include only steps the source actually walks through.

## Code patterns
Only if code is shown or described in detail. Use fenced code blocks with the right language identifier. Strip business-irrelevant noise.

## Configuration
Only if specific settings, environment variables, or parameters are discussed.

## Tools and libraries
List specific tools, libraries, frameworks, or platforms explicitly mentioned. Omit the section if none are.

## Gotchas
3-6 bullets covering: pitfalls, edge cases, common mistakes, things that look right but break, places where verification is needed before adopting.

## Open questions
2-4 bullets, only if real implementation uncertainty is left unresolved.

Style:
- Be specific. "Run \`npm install\`" beats "install dependencies".
- Do not invent function names, flags, or version numbers.`,
	sections: [
		{ id: 'tldr', heading: 'TL;DR', required: true, description: '1-2 sentences naming what is built and the core approach.' },
		{ id: 'approach', heading: 'Approach', required: false, description: 'Strategy in a paragraph or 3-5 bullets.' },
		{ id: 'steps', heading: 'Steps', required: false, description: 'Numbered concrete steps. Each one sentence.' },
		{ id: 'code-patterns', heading: 'Code patterns', required: false, description: 'Fenced blocks for code shown or described.' },
		{ id: 'configuration', heading: 'Configuration', required: false, description: 'Specific settings, env vars, or parameters discussed.' },
		{ id: 'tools', heading: 'Tools and libraries', required: false, description: 'Specific tools/libraries/frameworks mentioned.' },
		{ id: 'gotchas', heading: 'Gotchas', required: false, description: 'Pitfalls, edge cases, things that look right but break.' },
		{ id: 'open-questions', heading: 'Open questions', required: false, description: 'Unresolved implementation uncertainty.' },
	],
	frontmatter: [],
	tags: ['ytkn/implementation'],
	controls: [],
};
