import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../../mocks/obsidian');
	return mod;
});

import { renderModelChainRows } from '../../../src/ui/shared/modelChainRows';
import type { ModelConfig } from '../../../src/types';

const modelA: ModelConfig = {
	name: 'claude',
	displayName: 'Claude',
	provider: { name: 'Anthropic', type: 'anthropic', apiKey: 'k' },
};
const modelB: ModelConfig = {
	name: 'gpt-4o',
	displayName: 'GPT-4o',
	provider: { name: 'OpenAI', type: 'openai', apiKey: 'k' },
};
const modelC: ModelConfig = {
	name: 'qwen3:8b',
	displayName: 'Qwen',
	provider: { name: 'Local', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
};

function render(modelIds: string[], onChange = vi.fn()) {
	const containerEl = document.createElement('div');
	renderModelChainRows(containerEl, {
		availableModels: [modelA, modelB, modelC],
		modelIds,
		onChange,
	});
	return { containerEl, onChange };
}

function rowNames(containerEl: HTMLElement): string[] {
	return Array.from(containerEl.querySelectorAll('.setting-item-name')).map((el) => el.textContent ?? '');
}

function rowButton(containerEl: HTMLElement, rowIndex: number, label: string): HTMLButtonElement {
	const rows = Array.from(containerEl.querySelectorAll('.setting-item'));
	const button = Array.from(rows[rowIndex].querySelectorAll('button')).find((b) => b.textContent === label);
	if (!button) throw new Error(`No "${label}" button on row ${rowIndex}`);
	return button as HTMLButtonElement;
}

describe('renderModelChainRows', () => {
	it('renders one ordered row per chain entry with provider and display name', () => {
		const { containerEl } = render(['Anthropic:claude', 'OpenAI:gpt-4o']);

		const names = rowNames(containerEl);
		expect(names[0]).toBe('1. Anthropic / Claude');
		expect(names[1]).toBe('2. OpenAI / GPT-4o');
	});

	it('moves entries up and down and removes them', () => {
		const { containerEl, onChange } = render(['Anthropic:claude', 'OpenAI:gpt-4o']);

		rowButton(containerEl, 1, '↑').click();
		expect(onChange).toHaveBeenLastCalledWith(['OpenAI:gpt-4o', 'Anthropic:claude']);

		rowButton(containerEl, 0, '↓').click();
		expect(onChange).toHaveBeenLastCalledWith(['OpenAI:gpt-4o', 'Anthropic:claude']);

		rowButton(containerEl, 0, '✕').click();
		expect(onChange).toHaveBeenLastCalledWith(['OpenAI:gpt-4o']);
	});

	it('offers only models missing from the chain in the add row and appends the pick', () => {
		const { containerEl, onChange } = render(['Anthropic:claude']);

		const addRowIndex = rowNames(containerEl).findIndex((name) => name === 'Add model');
		expect(addRowIndex).toBeGreaterThan(-1);
		const addRow = Array.from(containerEl.querySelectorAll('.setting-item'))[addRowIndex];
		const select = addRow.querySelector('select') as HTMLSelectElement;
		const optionValues = Array.from(select.options).map((o) => o.value);
		expect(optionValues).toEqual(['OpenAI:gpt-4o', 'Local:qwen3:8b']);

		select.value = 'Local:qwen3:8b';
		select.dispatchEvent(new Event('change'));
		rowButton(containerEl, addRowIndex, 'Add').click();
		expect(onChange).toHaveBeenLastCalledWith(['Anthropic:claude', 'Local:qwen3:8b']);
	});

	it('hides the add row when every model is already chained', () => {
		const { containerEl } = render(['Anthropic:claude', 'OpenAI:gpt-4o', 'Local:qwen3:8b']);

		expect(rowNames(containerEl)).not.toContain('Add model');
	});
});
