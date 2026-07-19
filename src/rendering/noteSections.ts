// Prompt composition and note assembly share this registry so addon instructions,
// headings, placement, and ordering cannot drift.

type AddonPlacement = 'tldr-callout' | 'section';

export interface AddonFlags {
	includeTldr: boolean;
	includeMindmap: boolean;
	includeMemorableQuotes: boolean;
}

export interface AddonSection {
	id: string;
	heading: string;
	placement: AddonPlacement;
	enabled: (flags: AddonFlags) => boolean;
	promptFragment: string;
}

const TLDR_FRAGMENT = `Add a TL;DR section:

## TL;DR
1-2 sentences (≤ 240 characters total) capturing the single most important takeaway.

TL;DR rules:
- Section heading must be exactly \`## TL;DR\`.
- Keep it grounded in the transcript.
- Do not repeat the title or source metadata.`;

const MINDMAP_FRAGMENT = `Add a Mindmap section that captures the key concepts as a nested bullet list. Use exactly this format:

## Mindmap
- Central idea
  - Branch A
    - Leaf 1
    - Leaf 2
  - Branch B
    - Leaf 3

Mindmap rules:
- Section heading must be exactly \`## Mindmap\`.
- The content must be a nested bullet list (lines starting with \`-\`), indented to show hierarchy. Do not use prose, a code block, or a Mermaid diagram.
- The first bullet is the single central idea; every other bullet nests beneath it.
- Keep labels short: noun phrases or very short clauses, one concept per bullet.
- Do not use LaTeX: no \`$...$\` delimiters and no backslash commands like \`\\le\`, \`\\cdot\`, \`\\sqrt\`, or \`\\Theta\`. Do not use raw double quotes or square brackets.
- For any math, use compact readable notation with plain symbols: \`O(n log n)\`, \`O(√n)\`, \`n²\`, \`2ⁿ\`, \`f(n) ≤ C·g(n)\`. Parentheses are fine.
- Keep full formulas and derivations in the body sections. Mind map nodes are short labels, not a formula sheet.
- Capture only the main ideas, supporting branches, and notable tradeoffs from the transcript.
- Roughly 2–4 levels deep and 8–18 nodes total.
- Do not invent nodes that are not grounded in the transcript.`;

const MEMORABLE_QUOTES_FRAGMENT = `Add a memorable quotes section:

## Memorable quotes
- 3–7 verbatim quotes worth preserving from this source.
- Each quote must be its own callout block. Format every quote line as:
  \`> [!quote] "..." (mm:ss)\`
- Separate consecutive quote callouts with a blank line.
- Append a \`(mm:ss)\` timestamp suffix when the timing is verifiable from the transcript.
- The section heading must be exactly \`## Memorable quotes\`.
- Omit the section entirely if fewer than 3 quote-worthy lines exist in the source.`;

// Order is authoritative: it sets both the order addon instructions appear in the prompt and
// the order their sections are placed in the assembled note (after the summary body).
export const ADDON_SECTIONS: readonly AddonSection[] = [
	{
		id: 'tldr',
		heading: 'TL;DR',
		placement: 'tldr-callout',
		enabled: (flags) => flags.includeTldr,
		promptFragment: TLDR_FRAGMENT,
	},
	{
		id: 'mindmap',
		heading: 'Mindmap',
		placement: 'section',
		enabled: (flags) => flags.includeMindmap,
		promptFragment: MINDMAP_FRAGMENT,
	},
	{
		id: 'memorable-quotes',
		heading: 'Memorable quotes',
		placement: 'section',
		enabled: (flags) => flags.includeMemorableQuotes,
		promptFragment: MEMORABLE_QUOTES_FRAGMENT,
	},
];

export function buildAddonPromptFragments(flags: AddonFlags): string {
	return ADDON_SECTIONS.filter((section) => section.enabled(flags))
		.map((section) => section.promptFragment)
		.join('\n\n');
}
