import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => import('../../mocks/obsidian'));

import { App } from 'obsidian';
import { ModelFormModal } from '../../../src/ui/settings/ai/modals/modelForm';
import { ProviderFormModal } from '../../../src/ui/settings/ai/modals/providerForm';
import { ModelPickerModal } from '../../../src/ui/shared/modelPickerModal';
import type { ModelConfig, ProviderConfig } from '../../../src/types';

const provider: ProviderConfig = {
	name: 'Local',
	type: 'openai-compatible',
	apiKey: '',
	apiKeySecretId: 'local-key',
	url: 'http://localhost:11434/v1',
	models: [],
};

const model: ModelConfig = {
	name: 'llama3',
	displayName: 'Llama 3',
	provider: { name: 'Local', type: 'openai-compatible', apiKey: '' },
};

function button(modal: { contentEl: HTMLElement }, label: string): HTMLButtonElement {
	const found = Array.from(modal.contentEl.querySelectorAll('button'))
		.find((candidate) => candidate.textContent === label);
	expect(found).toBeTruthy();
	return found as HTMLButtonElement;
}

function inputByLabel(modal: { contentEl: HTMLElement }, label: string): HTMLInputElement {
	const row = Array.from(modal.contentEl.querySelectorAll('.setting-item'))
		.find((candidate) => candidate.querySelector('.setting-item-name')?.textContent === label);
	const input = row?.querySelector('input');
	expect(input).toBeTruthy();
	return input as HTMLInputElement;
}

function changeInput(input: HTMLInputElement, value: string): void {
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('settings modals', () => {
	it('uses the provider form only to create providers', async () => {
		const actions = { addProvider: vi.fn(async () => undefined) };
		const modal = new ProviderFormModal(new App(), actions);
		modal.open();

		changeInput(inputByLabel(modal, 'Provider name'), ' Local LLM ');
		changeInput(inputByLabel(modal, 'Base URL'), ' http://localhost:11434/v1 ');
		button(modal, 'Add provider').click();
		await vi.waitFor(() => expect(actions.addProvider).toHaveBeenCalledWith({
			name: 'Local LLM',
			type: 'openai-compatible',
			apiKey: '',
			apiKeySecretId: undefined,
			url: 'http://localhost:11434/v1',
			models: [],
		}));
	});

	it('adds and edits models through the shared model form', async () => {
		const actions = {
			addModel: vi.fn(async () => undefined),
			editModel: vi.fn(async () => undefined),
		};
		const addModal = new ModelFormModal(new App(), { kind: 'add', provider }, actions);
		addModal.open();
		changeInput(inputByLabel(addModal, 'Model ID'), ' mistral ');
		changeInput(inputByLabel(addModal, 'Display name'), ' Mistral Large ');
		button(addModal, 'Save').click();

		await vi.waitFor(() => expect(actions.addModel).toHaveBeenCalledWith({
			name: 'mistral',
			displayName: 'Mistral Large',
			provider: {
				name: provider.name,
				type: provider.type,
				apiKey: provider.apiKey,
				apiKeySecretId: provider.apiKeySecretId,
				url: provider.url,
			},
		}));

		const editModal = new ModelFormModal(new App(), { kind: 'edit', model }, actions);
		editModal.open();
		expect(inputByLabel(editModal, 'Model ID').disabled).toBe(true);
		changeInput(inputByLabel(editModal, 'Display name'), 'Llama 3.1');
		button(editModal, 'Save').click();
		await vi.waitFor(() => expect(actions.editModel).toHaveBeenCalledWith({
			...model,
			displayName: 'Llama 3.1',
		}));
	});

	it('uses a compact picker to add an unselected model-order entry', async () => {
		const onSelect = vi.fn(async () => undefined);
		const modal = new ModelPickerModal(new App(), [model], onSelect);
		modal.open();

		button(modal, 'Add').click();
		await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith('Local:llama3'));
	});

});
