import { describe, expect, it } from 'vitest';
import { extractFrontmatterBlock } from '../../src/services/templates/extract-template-output';
import type { Template } from '../../src/types';
import { extractTemplateOutput } from '../../src/services/templates/extract-template-output';

const generalLikeTemplate: Template = {
	id: 'general',
	label: 'Test',
	subtitle: 'Test',
	group: 'Summaries & references',
	body: '',
	sections: [
		{ id: 'tldr', heading: 'TL;DR', required: true, description: 'TL;DR' },
		{ id: 'takeaways', heading: 'Key takeaways', required: false, description: 'takeaways' },
		{ id: 'evidence', heading: 'Evidence', required: false, description: 'evidence' },
	],
};

describe('extractFrontmatterBlock', () => {
	it('returns null when no marker block is present', () => {
		const result = extractFrontmatterBlock('## TL;DR\nHello world');
		expect(result.frontmatter).toBeNull();
		expect(result.bodyWithoutBlock).toBe('## TL;DR\nHello world');
		expect(result.warnings).toEqual([]);
	});

	it('parses a simple scalar block', () => {
		const input = '<!-- ytkn:frontmatter\nkey_takeaway: A short line.\nconfidence: high\n-->\n\n## TL;DR\nHello.';
		const result = extractFrontmatterBlock(input);
		expect(result.frontmatter).toEqual({ key_takeaway: 'A short line.', confidence: 'high' });
		expect(result.bodyWithoutBlock).toBe('## TL;DR\nHello.');
		expect(result.warnings).toEqual([]);
	});

	it('parses inline arrays', () => {
		const input = '<!-- ytkn:frontmatter\ntopics: [knowledge, recall]\n-->\n\nbody';
		const result = extractFrontmatterBlock(input);
		expect(result.frontmatter).toEqual({ topics: ['knowledge', 'recall'] });
	});

	it('parses quoted strings (single and double)', () => {
		const input = '<!-- ytkn:frontmatter\na: "with: colon"\nb: \'with: colon\'\n-->\n\nbody';
		const result = extractFrontmatterBlock(input);
		expect(result.frontmatter).toEqual({ a: 'with: colon', b: 'with: colon' });
	});

	it('parses numbers and booleans and null', () => {
		const input = '<!-- ytkn:frontmatter\nclaims_count: 5\nactive: true\nrejected: false\nlast_reviewed: null\n-->\n\nbody';
		const result = extractFrontmatterBlock(input);
		expect(result.frontmatter).toEqual({ claims_count: 5, active: true, rejected: false, last_reviewed: null });
	});

	it('warns and continues on malformed lines', () => {
		const input = '<!-- ytkn:frontmatter\nvalid: ok\n!!! garbage line\nalso_valid: yes\n-->\n\nbody';
		const result = extractFrontmatterBlock(input);
		expect(result.frontmatter).toEqual({ valid: 'ok', also_valid: 'yes' });
		expect(result.warnings.length).toBeGreaterThan(0);
		expect(result.warnings[0]).toContain('garbage');
	});

	it('strips the marker block from the body', () => {
		const input = 'leading\n\n<!-- ytkn:frontmatter\nkey: value\n-->\n\n## TL;DR\nNote body.';
		const result = extractFrontmatterBlock(input);
		expect(result.bodyWithoutBlock).toBe('leading\n\n## TL;DR\nNote body.');
	});

	it('returns null and warns when block is malformed (no closing marker)', () => {
		const input = '<!-- ytkn:frontmatter\nkey: value\n## TL;DR\nbody';
		const result = extractFrontmatterBlock(input);
		expect(result.frontmatter).toBeNull();
		expect(result.warnings.length).toBeGreaterThan(0);
		expect(result.warnings[0]).toContain('marker');
	});
});

describe('extractTemplateOutput — section splitting', () => {
	it('matches declared sections in declared order with body content preserved', () => {
		const ai = '## TL;DR\nThe gist.\n\n## Key takeaways\n- A\n- B\n\n## Evidence\nClear support.';
		const result = extractTemplateOutput(ai, generalLikeTemplate);
		expect(result.sections.get('tldr')).toBe('The gist.');
		expect(result.sections.get('takeaways')).toBe('- A\n- B');
		expect(result.sections.get('evidence')).toBe('Clear support.');
		expect(result.extras).toEqual([]);
		expect(result.warnings).toEqual([]);
	});

	it('falls back to case-insensitive heading match', () => {
		const ai = '## TL;DR\nThe gist.\n\n## key takeaways\n- A';
		const result = extractTemplateOutput(ai, generalLikeTemplate);
		expect(result.sections.get('tldr')).toBe('The gist.');
		expect(result.sections.get('takeaways')).toBe('- A');
	});

	it('warns when a required section is missing', () => {
		const ai = '## Key takeaways\n- A';
		const result = extractTemplateOutput(ai, generalLikeTemplate);
		expect(result.sections.has('tldr')).toBe(false);
		expect(result.warnings.some((w) => w.toLowerCase().includes('tl;dr'))).toBe(true);
	});

	it('preserves unknown headings as extras in original order', () => {
		const ai = '## TL;DR\nGist.\n\n## Surprise topic\n- something\n\n## Evidence\nclaim.';
		const result = extractTemplateOutput(ai, generalLikeTemplate);
		expect(result.extras).toEqual([{ heading: 'Surprise topic', body: '- something' }]);
		expect(result.sections.get('tldr')).toBe('Gist.');
		expect(result.sections.get('evidence')).toBe('claim.');
	});

	it('handles bodies without any H2 headings (empty sections)', () => {
		const ai = 'just a paragraph, no headings.';
		const result = extractTemplateOutput(ai, generalLikeTemplate);
		expect(result.sections.size).toBe(0);
		expect(result.extras).toEqual([]);
		expect(result.warnings.some((w) => w.toLowerCase().includes('tl;dr'))).toBe(true);
	});

	it('extracts frontmatter block alongside sections', () => {
		const ai = '<!-- ytkn:frontmatter\ntopics: [a, b]\n-->\n\n## TL;DR\nGist.';
		const result = extractTemplateOutput(ai, generalLikeTemplate);
		expect(result.frontmatter).toEqual({ topics: ['a', 'b'] });
		expect(result.sections.get('tldr')).toBe('Gist.');
	});

	it('returns empty extracted output for templates without sections (legacy)', () => {
		const legacyTemplate: Template = {
			id: 'talk',
			label: 'Talk',
			subtitle: 'Talk',
			group: 'Summaries & references',
			body: '',
		};
		const ai = '## Anything\ngoes here';
		const result = extractTemplateOutput(ai, legacyTemplate);
		expect(result.sections.size).toBe(0);
		expect(result.extras).toEqual([]);
		expect(result.warnings).toEqual([]);
		expect(result.frontmatter).toBeNull();
	});
});
