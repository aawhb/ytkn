import { describe, expect, it } from 'vitest';
import {
	TEMPLATES,
	findTemplateChoice,
	getTemplate,
	isInstructionTemplate,
	listTemplateChoices,
} from '../../src/services/templates';
import type { InstructionTemplate } from '../../src/types';

const ALL_IDS: InstructionTemplate[] = [
	'general',
	'study',
	'implementation',
	'full-extract',
	'deep-dive',
	'research',
];

describe('template registry', () => {
	it('exposes all 6 templates with required identity fields', () => {
		expect(TEMPLATES).toHaveLength(6);
		const ids = TEMPLATES.map((t) => t.id);
		for (const id of ALL_IDS) {
			expect(ids).toContain(id);
		}
		for (const t of TEMPLATES) {
			expect(t.label.length).toBeGreaterThan(0);
			expect(t.subtitle.length).toBeGreaterThan(0);
			expect(t.body.length).toBeGreaterThan(0);
		}
	});

	it('getTemplate returns the matching record and falls back to general', () => {
		expect(getTemplate('research').id).toBe('research');
		expect(getTemplate('deep-dive').id).toBe('deep-dive');
		expect(getTemplate('does-not-exist' as InstructionTemplate).id).toBe('general');
	});

	it('listTemplateChoices preserves registry order and exposes body text', () => {
		const choices = listTemplateChoices();
		expect(choices).toHaveLength(6);
		expect(choices[0].id).toBe('general');
		expect(choices.map((c) => c.id)).toEqual([
			'general',
			'study',
			'implementation',
			'deep-dive',
			'full-extract',
			'research',
		]);
	});

	it('findTemplateChoice returns undefined for unknown ids', () => {
		expect(findTemplateChoice('does-not-exist' as InstructionTemplate)).toBeUndefined();
		expect(findTemplateChoice('general')?.label.length).toBeGreaterThan(0);
	});

	it('validates template ids from the registry', () => {
		for (const id of ALL_IDS) {
			expect(isInstructionTemplate(id)).toBe(true);
		}

		expect(isInstructionTemplate('talk')).toBe(false);
		expect(isInstructionTemplate('')).toBe(false);
		expect(isInstructionTemplate(null)).toBe(false);
	});

	it('implementation declares sections and tags; frontmatter and controls are empty', () => {
		const tpl = getTemplate('implementation');
		expect(tpl.sections).toBeDefined();
		expect(tpl.sections!.length).toBeGreaterThan(0);
		expect(tpl.sections!.find((s) => s.id === 'tldr')?.required).toBe(true);
		expect(tpl.frontmatter).toEqual([]);
		expect(tpl.controls).toEqual([]);
		expect(tpl.tags).toContain('ytkn/implementation');
	});
});

describe('template controls declarations', () => {
	it('research has 2 controls: inquiry (required), strictness (enum)', () => {
		const tpl = getTemplate('research');
		expect(tpl.controls).toHaveLength(2);
		const inquiry = tpl.controls!.find((c) => c.id === 'inquiry');
		const strictness = tpl.controls!.find((c) => c.id === 'strictness');
		expect(inquiry?.required).toBe(true);
		expect(strictness?.type).toBe('enum');
		expect(strictness?.enumValues).toEqual(['lenient', 'standard', 'strict']);
		expect(strictness?.default).toBe('standard');
	});

	it('study has 1 control: learner_level (enum, default intermediate)', () => {
		const tpl = getTemplate('study');
		expect(tpl.controls).toHaveLength(1);
		const ctrl = tpl.controls![0];
		expect(ctrl.id).toBe('learner_level');
		expect(ctrl.type).toBe('enum');
		expect(ctrl.enumValues).toEqual(['intro', 'intermediate', 'advanced']);
		expect(ctrl.default).toBe('intermediate');
	});

	it('full-extract has 1 control: density (enum, default comprehensive)', () => {
		const tpl = getTemplate('full-extract');
		expect(tpl.controls).toHaveLength(1);
		const density = tpl.controls!.find((c) => c.id === 'density');
		expect(density?.type).toBe('enum');
		expect(density?.enumValues).toEqual(['concise', 'comprehensive', 'exhaustive']);
		expect(density?.default).toBe('comprehensive');
	});

	it('deep-dive has 1 control: audience_level (enum, default intermediate)', () => {
		const tpl = getTemplate('deep-dive');
		expect(tpl.controls).toHaveLength(1);
		const audience = tpl.controls!.find((c) => c.id === 'audience_level');
		expect(audience?.type).toBe('enum');
		expect(audience?.enumValues).toEqual(['intro', 'intermediate', 'advanced']);
		expect(audience?.default).toBe('intermediate');
	});

	it('general has no controls', () => {
		expect(getTemplate('general').controls).toBeUndefined();
	});

	it('implementation has 0 controls', () => {
		const tpl = getTemplate('implementation');
		expect(tpl.controls).toEqual([]);
	});
});
