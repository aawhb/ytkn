import { describe, expect, it } from 'vitest';
import { assembleNote } from '../../src/rendering/noteAssembler';
import type { Template } from '../../src/types';

const template = {
	id: 'general',
	label: 'T',
	subtitle: 'T',
	body: '',
	sections: [
		{ id: 'takeaways', heading: 'Key takeaways', required: true, description: '' },
		{ id: 'evidence', heading: 'Evidence', required: false, description: '' },
	],
} as Template;

const allOff = { includeTldr: false, includeMindmap: false, includeMemorableQuotes: false };
const allOn = { includeTldr: true, includeMindmap: true, includeMemorableQuotes: true };

describe('assembleNote: template mode', () => {
	it('preserves free-form preamble content alongside template sections', () => {
		const raw = 'Undeclared preamble.\n\n## Key takeaways\n- A';
		const { body, warnings } = assembleNote(raw, template, allOff);

		expect(body).toBe('Undeclared preamble.\n\n## Key takeaways\n- A');
		expect(warnings.some((warning) => warning.includes('preamble'))).toBe(true);
	});

	it('keeps declared sections in declared order and preserves unknown headings afterward', () => {
		const raw = '## Evidence\nclaim.\n\n## Surprise\n- x\n\n## Key takeaways\n- A';
		const { body, warnings } = assembleNote(raw, template, allOff);
		expect(body).toBe('## Key takeaways\n- A\n\n## Evidence\nclaim.\n\n## Surprise\n- x');
		expect(warnings.some((warning) => warning.includes('Surprise'))).toBe(true);
	});

	it('preserves duplicate declared sections instead of overwriting earlier content', () => {
		const raw = '## Key takeaways\nFirst.\n\n## Key takeaways\nSecond.';
		const { body, warnings } = assembleNote(raw, template, allOff);

		expect(body).toBe('## Key takeaways\nFirst.\n\n## Key takeaways\nSecond.');
		expect(warnings.some((warning) => warning.includes('duplicate'))).toBe(true);
	});

	it('uses the first nonempty duplicate declared section', () => {
		const raw = '## Key takeaways\n\n## Key takeaways\nValid content.';
		const { body, warnings } = assembleNote(raw, template, allOff);

		expect(body).toBe('## Key takeaways\nValid content.');
		expect(warnings.some((warning) => warning.includes('Required section'))).toBe(false);
	});

	it('keeps fenced H2-looking code inside its declared section', () => {
		const codeTemplate = {
			...template,
			sections: [{ id: 'code', heading: 'Code patterns', required: true, description: '' }],
		};
		const raw = '## Code patterns\n```sh\n## install dependencies\nnpm install\n```';

		expect(assembleNote(raw, codeTemplate, allOff).body).toBe(raw);
	});

	it('warns when a required section is missing', () => {
		const { body, warnings } = assembleNote('## Evidence\nclaim.', template, allOff);
		expect(body).toBe('## Evidence\nclaim.');
		expect(warnings.some((w) => w.includes('Key takeaways'))).toBe(true);
	});
});

describe('assembleNote: add-on extraction and placement', () => {
	it('extracts TL;DR to a callout and places addon sections in registry order', () => {
		const raw = [
			'## TL;DR',
			'The gist.',
			'',
			'## Key takeaways',
			'- A',
			'',
			'## Memorable Quotes',
			'> [!quote] "Quote." (0:10)',
			'',
			'## Mind Map',
			'- Root',
			'  - Branch',
		].join('\n');

		const { tldr, body, addonBlocks } = assembleNote(raw, template, allOn);

		expect(tldr).toBe('The gist.');
		expect(body).toBe('## Key takeaways\n- A');
		expect(addonBlocks).toHaveLength(2);
		expect(addonBlocks[0]).toContain('## Mind Map');
		expect(addonBlocks[0]).toContain('```mermaid');
		expect(addonBlocks[0]).toContain('root(("Root"))');
		expect(addonBlocks[1]).toContain('## Memorable Quotes');
	});

	it('preserves disabled add-ons as template extras', () => {
		const raw = '## Key takeaways\n- A\n\n## Mind Map\n- Root';
		const { addonBlocks, body, warnings } = assembleNote(raw, template, allOff);
		expect(addonBlocks).toEqual([]);
		expect(body).toBe('## Key takeaways\n- A\n\n## Mind Map\n- Root');
		expect(warnings.some((warning) => warning.includes('Mind Map'))).toBe(true);
	});

	it('relocates the first enabled add-on and preserves duplicate sections in the body', () => {
		const raw = '## Mind Map\n- First root\n\n## Mind Map\n- Second root';
		const result = assembleNote(raw, null, { ...allOff, includeMindmap: true });

		expect(result.addonBlocks[0]).toContain('First root');
		expect(result.body).toBe('## Mind Map\n- Second root');
	});

	it('uses the first nonempty duplicate add-on section', () => {
		const raw = '## Mind Map\n\n## Mind Map\n- Valid root';
		const result = assembleNote(raw, null, { ...allOff, includeMindmap: true });

		expect(result.addonBlocks[0]).toContain('Valid root');
		expect(result.warnings.some((warning) => warning.includes('Requested section "Mind Map"'))).toBe(false);
	});

	it('keeps a disabled add-on when a template explicitly declares its heading', () => {
		const addonTemplate = {
			...template,
			sections: [
				{ id: 'mindmap', heading: 'Mind Map', required: true, description: '' },
				...(template.sections ?? []),
			],
		};
		const raw = '## Key takeaways\n- A\n\n## Mind Map\n- Root';

		expect(assembleNote(raw, addonTemplate, allOff).body).toBe(
			'## Mind Map\n- Root\n\n## Key takeaways\n- A',
		);
	});
});

describe('assembleNote: manual mode (no template)', () => {
	it('preserves a free-form body without H2 headings', () => {
		const raw = '- First insight\n- Second insight\n- Third insight';
		const { body, addonBlocks } = assembleNote(raw, null, allOff);

		expect(body).toBe(raw);
		expect(addonBlocks).toEqual([]);
	});

	it('preserves free-form content before extracting reserved addon sections', () => {
		const raw = [
			'A short introduction.',
			'',
			'- First insight',
			'- Second insight',
			'',
			'## TL;DR',
			'The gist.',
			'',
			'## Mind Map',
			'- Root',
			'  - Branch',
		].join('\n');
		const { tldr, body, addonBlocks } = assembleNote(raw, null, {
			...allOff,
			includeTldr: true,
			includeMindmap: true,
		});

		expect(tldr).toBe('The gist.');
		expect(body).toBe('A short introduction.\n\n- First insight\n- Second insight');
		expect(addonBlocks).toHaveLength(1);
		expect(addonBlocks[0]).toContain('## Mind Map');
	});

	it('keeps all non-addon sections as the body and still extracts enabled addons', () => {
		const raw = '## Notes\nfree-form body.\n\n## Mind Map\n- Root\n  - Branch';
		const { body, addonBlocks } = assembleNote(raw, null, { ...allOff, includeMindmap: true });
		expect(body).toBe('## Notes\nfree-form body.');
		expect(addonBlocks).toHaveLength(1);
		expect(addonBlocks[0]).toContain('## Mind Map');
	});

	it('preserves disabled section add-ons requested by manual instructions', () => {
		const raw = [
			'## Summary',
			'Some prose.',
			'',
			'## TL;DR',
			'Custom gist.',
			'',
			'## Memorable Quotes',
			'Custom quotes.',
			'',
			'## Mind Map',
			'Custom map.',
		].join('\n');

		expect(assembleNote(raw, null, allOff).body).toBe(raw);
	});

	it('does not transform a manual Mindmap section when the add-on is disabled', () => {
		const raw = '## Mind Map\n- user_id\n  - max_heap';

		expect(assembleNote(raw, null, allOff).body).toBe(raw);
	});

	it('does not normalize a manual Memorable quotes section when the add-on is disabled', () => {
		const raw = '## Memorable Quotes\n[!quote] User-owned syntax.';

		expect(assembleNote(raw, null, allOff).body).toBe(raw);
	});

	it('uses a manual-mode first paragraph as the TL;DR fallback', () => {
		const raw = 'Opening takeaway.\n\n## Details\nSupporting material.';
		const result = assembleNote(raw, null, { ...allOff, includeTldr: true });

		expect(result.tldr).toBe('Opening takeaway.');
		expect(result.body).toBe('## Details\nSupporting material.');
		expect(result.warnings).toEqual([]);
	});

	it('uses the manual first-paragraph TL;DR fallback when other add-ons are requested', () => {
		const raw = [
			'Opening takeaway.',
			'',
			'## Mind Map',
			'- Root',
			'',
			'## Memorable Quotes',
			'[!quote] A grounded quote.',
		].join('\n');
		const result = assembleNote(raw, null, {
			includeTldr: true,
			includeMindmap: true,
			includeMemorableQuotes: true,
		});

		expect(result.tldr).toBe('Opening takeaway.');
		expect(result.body).toBe('');
		expect(result.addonBlocks).toHaveLength(2);
		expect(result.warnings.some((warning) => warning.includes('Requested section "TL;DR"'))).toBe(false);
	});

	it('extracts an explicit TL;DR fallback when another add-on is requested', () => {
		const raw = [
			'### TL;DR',
			'Explicit fallback.',
			'',
			'## Mind Map',
			'- Root',
			'  - Branch',
		].join('\n');
		const result = assembleNote(raw, null, {
			...allOff,
			includeTldr: true,
			includeMindmap: true,
		});

		expect(result.tldr).toBe('Explicit fallback.');
		expect(result.body).toBe('');
		expect(result.addonBlocks).toHaveLength(1);
		expect(result.addonBlocks[0]).toContain('## Mind Map');
		expect(result.warnings).toEqual([]);
	});

	it('extracts a multiline explicit TL;DR after a blank line', () => {
		const raw = [
			'### TL;DR',
			'',
			'First line.',
			'Second line.',
			'',
			'## Mind Map',
			'- Root',
		].join('\n');
		const result = assembleNote(raw, null, {
			...allOff,
			includeTldr: true,
			includeMindmap: true,
		});

		expect(result.tldr).toBe('First line.\nSecond line.');
		expect(result.body).toBe('');
	});

	it('extracts a bold TL;DR label followed by a blank line', () => {
		const result = assembleNote(
			'**TL;DR**\n\nTakeaway after the blank line.\n\n## Details\nKeep this.',
			null,
			{ ...allOff, includeTldr: true },
		);

		expect(result.tldr).toBe('Takeaway after the blank line.');
		expect(result.body).toBe('## Details\nKeep this.');
	});

	it.each([
		['H3', '### TL;DR\nTemplate fallback.'],
		['bold', '**TL;DR** Template fallback.'],
	])('uses an explicit %s TL;DR fallback in template mode', (_label, prefix) => {
		const result = assembleNote(`${prefix}\n\n## Key takeaways\n- A`, template, { ...allOff, includeTldr: true });

		expect(result.tldr).toBe('Template fallback.');
		expect(result.body).toBe('## Key takeaways\n- A');
		expect(result.warnings.some((warning) => warning.includes('preamble'))).toBe(false);
	});

	it('stops a fallback TL;DR at the next peer heading', () => {
		const raw = [
			'### TL;DR',
			'Fallback gist.',
			'',
			'### Details',
			'Keep this in the body.',
		].join('\n');
		const result = assembleNote(raw, null, { ...allOff, includeTldr: true });

		expect(result.tldr).toBe('Fallback gist.');
		expect(result.body).toBe('### Details\nKeep this in the body.');
	});

	it('does not extract a TL;DR heading from fenced example content', () => {
		const raw = [
			'```markdown',
			'### TL;DR',
			'Example only.',
			'```',
			'',
			'## Mind Map',
			'- Root',
		].join('\n');
		const result = assembleNote(raw, null, {
			...allOff,
			includeTldr: true,
			includeMindmap: true,
		});

		expect(result.tldr).toBeNull();
		expect(result.body).toContain('### TL;DR\nExample only.');
		expect(result.warnings.some((warning) => warning.includes('TL;DR'))).toBe(true);
	});

	it('warns when a template run omits a requested TL;DR', () => {
		const result = assembleNote('## Key takeaways\n- A', template, { ...allOff, includeTldr: true });

		expect(result.tldr).toBeNull();
		expect(result.warnings.some((warning) => warning.includes('TL;DR'))).toBe(true);
	});

	it('warns consistently for every requested add-on omitted by the model', () => {
		const result = assembleNote('## Key takeaways\n- A', template, allOn);

		expect(result.warnings.some((warning) => warning.includes('TL;DR'))).toBe(true);
		expect(result.warnings.some((warning) => warning.includes('Mind Map'))).toBe(true);
		expect(result.warnings.some((warning) => warning.includes('Memorable Quotes'))).toBe(true);
	});

	it('warns when a provided model response is empty', () => {
		const result = assembleNote('', null, { ...allOff, includeMindmap: true });

		expect(result.warnings.some((warning) => warning.includes('Mind Map'))).toBe(true);
	});
});
