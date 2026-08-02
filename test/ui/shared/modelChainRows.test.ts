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

function rowButton(containerEl: HTMLElement, rowIndex: number, icon: string): HTMLButtonElement {
	const rows = Array.from(containerEl.querySelectorAll('.setting-item'));
	const button = rows[rowIndex].querySelector<HTMLButtonElement>(`button[data-icon="${icon}"]`);
	if (!button) throw new Error(`No "${icon}" button on row ${rowIndex}`);
	return button as HTMLButtonElement;
}

describe('renderModelChainRows', () => {
	it('renders one ordered row per chain entry with provider and display name', () => {
		const { containerEl } = render(['Anthropic:claude', 'OpenAI:gpt-4o']);

		const names = rowNames(containerEl);
		const descriptions = Array.from(containerEl.querySelectorAll('.setting-item-description'))
			.map((el) => el.textContent ?? '');
		expect(names).toEqual(['Claude', 'GPT-4o']);
		expect(descriptions).toEqual(['Anthropic', 'OpenAI']);
	});

	it('moves entries up and down and removes them', () => {
		const { containerEl, onChange } = render(['Anthropic:claude', 'OpenAI:gpt-4o']);

		rowButton(containerEl, 1, 'arrow-up').click();
		expect(onChange).toHaveBeenLastCalledWith(['OpenAI:gpt-4o', 'Anthropic:claude']);

		rowButton(containerEl, 0, 'arrow-down').click();
		expect(onChange).toHaveBeenLastCalledWith(['OpenAI:gpt-4o', 'Anthropic:claude']);

		rowButton(containerEl, 0, 'x').click();
		expect(onChange).toHaveBeenLastCalledWith(['OpenAI:gpt-4o']);
	});

	it('uses compact icon actions with disabled boundary controls', () => {
		const { containerEl } = render(['Anthropic:claude', 'OpenAI:gpt-4o']);

		expect(rowButton(containerEl, 0, 'arrow-up').disabled).toBe(true);
		expect(rowButton(containerEl, 0, 'arrow-down').disabled).toBe(false);
		expect(rowButton(containerEl, 1, 'arrow-up').disabled).toBe(false);
		expect(rowButton(containerEl, 1, 'arrow-down').disabled).toBe(true);
		expect(rowButton(containerEl, 0, 'x').title).toBe('Remove');
	});
});
