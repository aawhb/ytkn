import { describe, expect, it, vi } from 'vitest';
import { PromptService } from '../../src/services/prompt';
import * as templates from '../../src/services/templates';
import type { Template, TranscriptResponse } from '../../src/types';

const transcript: TranscriptResponse = {
	url: 'https://youtube.com/watch?v=abc',
	videoId: 'abc',
	title: 'Sample Video',
	author: 'Sample Author',
	channelUrl: 'https://youtube.com/channel/sample',
	lines: [{ text: 'Hello world.', offset: 0 }],
};

describe('prompt directives — declared templates', () => {
	const declaredIds = ['general', 'study', 'full-extract', 'deep-dive', 'research', 'implementation'] as const;

	for (const id of declaredIds) {
		it(`emits section directive for ${id}`, () => {
			const service = new PromptService({ mode: 'template', template: id, manualInstructions: '', includeMindmap: false });
			const prompt = service.buildPrompt(transcript, transcript.url);
			const tpl = templates.getTemplate(id);

			// Frontmatter directive: only present when template has declared frontmatter fields
			const hasFrontmatter = (tpl.frontmatter ?? []).length > 0;
			if (hasFrontmatter) {
				expect(prompt).toContain('<!-- ytkn:frontmatter');
				expect(prompt).toContain('-->');
				for (const fm of tpl.frontmatter!) {
					expect(prompt).toContain(fm.key);
				}
			} else {
				expect(prompt).not.toContain('<!-- ytkn:frontmatter');
			}

			// Section directive
			expect(prompt).toContain('Use exactly these H2 headings, in this order');
			for (const s of tpl.sections ?? []) {
				expect(prompt).toContain(s.heading);
				expect(prompt).toContain(`\`## ${s.heading}\``);
			}
			const requiredCount = (tpl.sections ?? []).filter((s) => s.required).length;
			if (requiredCount > 0) {
				expect(prompt).toMatch(/\(required\)/);
			}
		});
	}

	it('places frontmatter directive before section directive when template has frontmatter', () => {
		const syntheticTemplate: Template = {
			id: 'general',
			label: 'Synthetic test template',
			subtitle: 'For testing only',
			body: 'Produce a note.',
			sections: [
				{ id: 'tldr', heading: 'TL;DR', required: true, description: 'One-liner.' },
			],
			frontmatter: [
				{ key: 'foo', type: 'string', description: 'test frontmatter field' },
			],
			tags: [],
		};
		const spy = vi.spyOn(templates, 'getTemplate').mockReturnValue(syntheticTemplate);

		const service = new PromptService({ mode: 'template', template: 'general', manualInstructions: '', includeMindmap: false });
		const prompt = service.buildPrompt(transcript, transcript.url);

		spy.mockRestore();

		const frontmatterIndex = prompt.indexOf('Frontmatter directive');
		const sectionIndex = prompt.indexOf('Use exactly these H2 headings');

		expect(frontmatterIndex).toBeGreaterThan(-1);
		expect(sectionIndex).toBeGreaterThan(-1);
		expect(frontmatterIndex).toBeLessThan(sectionIndex);
	});
});

describe('prompt directives — manual mode emits none', () => {
	it('skips directive injection in manual mode regardless of selected template', () => {
		const service = new PromptService({
			mode: 'manual',
			template: 'general',
			manualInstructions: 'Custom user instructions.',
			includeMindmap: false,
		});
		const prompt = service.buildPrompt(transcript, transcript.url);

		expect(prompt).toContain('Custom user instructions.');
		expect(prompt).not.toContain('<!-- ytkn:frontmatter');
		expect(prompt).not.toContain('Use exactly these H2 headings, in this order');
	});
});

describe('prompt directives — controls block', () => {
	it('emits a user-supplied-values block when controlValues are populated', () => {
		const service = new PromptService({
			mode: 'template',
			template: 'research',
			manualInstructions: '',
			includeMindmap: false,
			controlValues: { inquiry: 'How does spaced repetition work?', strictness: 'strict' },
		});
		const prompt = service.buildPrompt(transcript, transcript.url);

		expect(prompt).toContain('User-supplied values');
		expect(prompt).toContain('How does spaced repetition work?');
		expect(prompt).toContain('strict');
	});

	it('controls block appears before section directive in prompt', () => {
		const service = new PromptService({
			mode: 'template',
			template: 'research',
			manualInstructions: '',
			includeMindmap: false,
			controlValues: { inquiry: 'Test inquiry' },
		});
		const prompt = service.buildPrompt(transcript, transcript.url);

		const controlsIdx = prompt.indexOf('User-supplied values');
		const sectionIdx = prompt.indexOf('Use exactly these H2 headings');

		expect(controlsIdx).toBeGreaterThan(-1);
		expect(sectionIdx).toBeGreaterThan(-1);
		expect(controlsIdx).toBeLessThan(sectionIdx);
	});

	it('does NOT emit a controls block when controlValues is empty', () => {
		const service = new PromptService({
			mode: 'template',
			template: 'research',
			manualInstructions: '',
			includeMindmap: false,
			controlValues: {},
		});
		const prompt = service.buildPrompt(transcript, transcript.url);

		expect(prompt).not.toContain('User-supplied values');
	});

	it('does NOT emit a controls block when controlValues is undefined', () => {
		const service = new PromptService({
			mode: 'template',
			template: 'research',
			manualInstructions: '',
			includeMindmap: false,
		});
		const prompt = service.buildPrompt(transcript, transcript.url);

		expect(prompt).not.toContain('User-supplied values');
	});

	it('omits controls with empty-string values from the block', () => {
		const service = new PromptService({
			mode: 'template',
			template: 'research',
			manualInstructions: '',
			includeMindmap: false,
			controlValues: { inquiry: 'Real inquiry', strictness: '' },
		});
		const prompt = service.buildPrompt(transcript, transcript.url);

		expect(prompt).toContain('Real inquiry');
		expect(prompt).not.toContain('Epistemic strictness:');
	});

	it('controls block is absent in manual mode regardless of controlValues', () => {
		const service = new PromptService({
			mode: 'manual',
			template: 'research',
			manualInstructions: 'Custom instructions.',
			includeMindmap: false,
			controlValues: { inquiry: 'Irrelevant inquiry' },
		});
		const prompt = service.buildPrompt(transcript, transcript.url);

		expect(prompt).not.toContain('User-supplied values');
	});
});
