import type { ControlDeclaration, InstructionTemplate, Template } from '../../types';
import { generalTemplate } from './general';
import { studyTemplate } from './study';
import { fullExtractTemplate } from './fullExtract';
import { deepDiveTemplate } from './deepDive';
import { researchTemplate } from './research';
import { implementationTemplate } from './implementation';

export const TEMPLATES: Template[] = [
	generalTemplate,
	studyTemplate,
	implementationTemplate,
	deepDiveTemplate,
	fullExtractTemplate,
	researchTemplate,
];

export interface TemplateChoice {
	id: InstructionTemplate;
	label: string;
	subtitle: string;
	body: string;
	controls?: ControlDeclaration[];
}

const TEMPLATE_IDS: ReadonlySet<InstructionTemplate> = new Set(
	TEMPLATES.map((template) => template.id),
);

export function isInstructionTemplate(value: unknown): value is InstructionTemplate {
	return typeof value === 'string' && TEMPLATE_IDS.has(value as InstructionTemplate);
}

export function getTemplate(id: InstructionTemplate): Template {
	const found = TEMPLATES.find((t) => t.id === id);
	if (found) {
		return found;
	}
	const fallback = TEMPLATES.find((t) => t.id === 'general');
	if (!fallback) {
		throw new Error('Template registry has no fallback (\'general\' missing).');
	}
	return fallback;
}

export function findTemplateChoice(id: InstructionTemplate): TemplateChoice | undefined {
	const found = TEMPLATES.find((t) => t.id === id);
	if (!found) {
		return undefined;
	}
	return { id: found.id, label: found.label, subtitle: found.subtitle, body: found.body, controls: found.controls };
}

export function listTemplateChoices(): TemplateChoice[] {
	return TEMPLATES.map((t) => ({ id: t.id, label: t.label, subtitle: t.subtitle, body: t.body, controls: t.controls }));
}

export function populateTemplateDropdown(selectEl: HTMLSelectElement): void {
	selectEl.empty();
	for (const choice of listTemplateChoices()) {
		const option = selectEl.createEl('option', { value: choice.id, text: choice.label });
		option.title = choice.subtitle;
	}
}
