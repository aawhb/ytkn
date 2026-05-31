import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
    const mod = await import('../mocks/obsidian');
    return mod;
});

import { App } from 'obsidian';
import { ConfirmModal } from '../../src/ui/modals/ConfirmModal';
import { ModelFormModal } from '../../src/ui/modals/ModelFormModal';
import { ProviderFormModal } from '../../src/ui/modals/ProviderFormModal';
import { SettingsModalsFactory } from '../../src/ui/modals/SettingsModalsFactory';
import type { ModelConfig, ProviderConfig } from '../../src/types';

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

function makeHandlers() {
    return {
        handleModelAdd: vi.fn(async () => undefined),
        handleModelEdit: vi.fn(async () => undefined),
        handleModelDelete: vi.fn(async () => undefined),
        handleProviderAdd: vi.fn(async () => undefined),
        handleProviderEdit: vi.fn(async () => undefined),
        handleProviderDelete: vi.fn(async () => undefined),
    } as any;
}

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

function changeSelect(select: HTMLSelectElement, value: string): void {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('settings modals', () => {
    it('confirm modal runs confirmation and always closes', async () => {
        const onConfirm = vi.fn(async () => undefined);
        const modal = new ConfirmModal(new App(), 'Delete item?', 'This cannot be undone.', 'Delete', onConfirm);
        modal.open();

        expect(modal.contentEl.querySelector('h2')?.textContent).toBe('Delete item?');
        expect(modal.contentEl.textContent).toContain('This cannot be undone.');

        button(modal, 'Delete').click();
        await Promise.resolve();

        expect(onConfirm).toHaveBeenCalledOnce();
        expect(modal.contentEl.children.length).toBe(0);
    });

    it('confirm modal cancel closes without confirmation', () => {
        const onConfirm = vi.fn();
        const modal = new ConfirmModal(new App(), 'Delete item?', 'This cannot be undone.', 'Delete', onConfirm);
        modal.open();

        button(modal, 'Cancel').click();

        expect(onConfirm).not.toHaveBeenCalled();
        expect(modal.contentEl.children.length).toBe(0);
    });

    it('model form adds and edits models through handlers', async () => {
        const handlers = makeHandlers();
        const addModal = new ModelFormModal(new App(), { kind: 'add', provider }, handlers);
        addModal.open();

        changeInput(inputByLabel(addModal, 'Model name'), ' mistral ');
        changeInput(inputByLabel(addModal, 'Display name'), ' Mistral Large ');
        button(addModal, 'Save').click();
        await Promise.resolve();

        expect(handlers.handleModelAdd).toHaveBeenCalledWith({
            name: 'mistral',
            displayName: 'Mistral Large',
            provider: {
                name: provider.name,
                type: provider.type,
                apiKey: provider.apiKey,
                apiKeySecretId: provider.apiKeySecretId,
                url: provider.url,
            },
        });

        const editModal = new ModelFormModal(new App(), { kind: 'edit', model }, handlers);
        editModal.open();
        expect(inputByLabel(editModal, 'Model name').disabled).toBe(true);
        changeInput(inputByLabel(editModal, 'Display name'), 'Llama 3.1');
        button(editModal, 'Save').click();
        await Promise.resolve();

        expect(handlers.handleModelEdit).toHaveBeenCalledWith({
            ...model,
            displayName: 'Llama 3.1',
        });
    });

    it('provider form adds and edits providers through handlers', async () => {
        const handlers = makeHandlers();
        const addModal = new ProviderFormModal(new App(), { kind: 'add' }, handlers);
        addModal.open();

        changeInput(inputByLabel(addModal, 'Provider name'), ' Local LLM ');
        changeSelect(addModal.contentEl.querySelector('select')!, 'openai-compatible');
        changeInput(inputByLabel(addModal, 'URL'), ' http://localhost:11434/v1 ');
        button(addModal, 'Save').click();
        await Promise.resolve();

        expect(handlers.handleProviderAdd).toHaveBeenCalledWith({
            name: 'Local LLM',
            type: 'openai-compatible',
            apiKey: '',
            apiKeySecretId: undefined,
            url: 'http://localhost:11434/v1',
            models: [],
        });

        const editModal = new ProviderFormModal(new App(), { kind: 'edit', provider, originalName: provider.name }, handlers);
        editModal.open();
        changeInput(inputByLabel(editModal, 'Provider name'), ' Local Updated ');
        button(editModal, 'Save').click();
        await Promise.resolve();

        expect(handlers.handleProviderEdit).toHaveBeenCalledWith({
            ...provider,
            name: 'Local Updated',
            apiKeySecretId: provider.apiKeySecretId,
            url: provider.url,
        }, provider.name);
    });

    it('factory returns the expected modal types and delete confirmations call handlers', async () => {
        const handlers = makeHandlers();
        const factory = new SettingsModalsFactory(new App());

        expect(factory.createAddProviderModal(handlers)).toBeInstanceOf(ProviderFormModal);
        expect(factory.createEditProviderModal(provider, handlers)).toBeInstanceOf(ProviderFormModal);
        expect(factory.createAddModelModal(provider, handlers)).toBeInstanceOf(ModelFormModal);
        expect(factory.createEditModelModal(model, handlers)).toBeInstanceOf(ModelFormModal);

        const deleteProvider = factory.createDeleteProviderModal({ ...provider, models: [model] }, handlers);
        deleteProvider.open();
        expect(deleteProvider.contentEl.textContent).toContain('1 associated model');
        button(deleteProvider, 'Delete').click();
        await Promise.resolve();
        expect(handlers.handleProviderDelete).toHaveBeenCalledWith({ ...provider, models: [model] });

        const deleteModel = factory.createDeleteModelModal(model, handlers);
        deleteModel.open();
        button(deleteModel, 'Delete').click();
        await Promise.resolve();
        expect(handlers.handleModelDelete).toHaveBeenCalledWith(model);
    });
});
