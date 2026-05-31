import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
    const mod = await import('../mocks/obsidian');
    return {
        ...mod,
        setIcon: vi.fn((el: HTMLElement, icon: string) => {
            el.setAttribute('data-icon', icon);
        }),
    };
});

import { App, Setting } from 'obsidian';
import { createSettingsCard, SettingsUIComponents } from '../../src/ui/components/SettingsUIComponents';
import { renderBrandActions } from '../../src/ui/components/BrandActions';
import { TabGroup } from '../../src/ui/components/Tabs';
import { stampSettingRowClasses } from '../../src/ui/settingRows';
import type { ProviderConfig } from '../../src/types';

function makeHandlers() {
    return {
        handleAccordionToggle: vi.fn((accordion: HTMLElement) => accordion.toggleClass('is-expanded', true)),
        handleFetchProviderModels: vi.fn(async () => undefined),
        handleProviderEditClick: vi.fn(),
        handleProviderDeleteClick: vi.fn(),
        handleApiKeySecretChange: vi.fn(async () => undefined),
        handleProviderUrlChange: vi.fn(async () => undefined),
        handleModelEditClick: vi.fn(),
        handleModelDeleteClick: vi.fn(),
        handleAddModelClick: vi.fn(),
    } as any;
}

const provider: ProviderConfig = {
    name: 'Local',
    type: 'openai-compatible',
    apiKey: '',
    apiKeySecretId: 'local-key',
    url: 'http://localhost:11434/v1',
    models: [
        {
            name: 'llama3',
            displayName: 'Llama 3',
            provider: { name: 'Local', type: 'openai-compatible', apiKey: '' },
        },
    ],
};

function makeProvider(type: ProviderConfig['type'], modelCount: number): ProviderConfig {
    const testProvider: ProviderConfig = {
        name: type,
        type,
        apiKey: '',
        models: [],
    };
    testProvider.models = Array.from({ length: modelCount }, (_, index) => ({
        name: `model-${index}`,
        displayName: `Model ${index}`,
        provider: testProvider,
    }));
    return testProvider;
}

describe('settings UI helpers', () => {
    it('creates a settings card with shared card and legacy settings classes', () => {
        const host = document.createElement('div');
        const card = createSettingsCard(host, 'Card title', (body) => {
            body.createDiv({ text: 'Body content' });
        }, 'h4');

        expect(card.className).toContain('ytkn-card');
        expect(card.className).toContain('ytkn-settings__group');
        expect(card.querySelector('h4')?.textContent).toBe('Card title');
        expect(card.querySelector('.ytkn-card__body')?.textContent).toBe('Body content');
    });

    it('renders provider accordions and wires header/action clicks to handlers', () => {
        const host = document.createElement('div');
        const handlers = makeHandlers();
        new SettingsUIComponents(new App()).addProviderAccordion(host, provider, handlers);

        const accordion = host.querySelector<HTMLElement>('.ytkn-settings__provider-accordion')!;
        const header = host.querySelector<HTMLElement>('.ytkn-settings__provider-header')!;
        const providerInfo = host.querySelector<HTMLElement>('.ytkn-settings__provider-info')!;
        const title = host.querySelector<HTMLElement>('.ytkn-settings__provider-title')!;
        const description = host.querySelector<HTMLElement>('.ytkn-settings__provider-description')!;
        const providerControls = host.querySelector<HTMLElement>('.ytkn-settings__provider-controls')!;
        const fetchButton = host.querySelector<HTMLButtonElement>('.ytkn-settings__provider-fetch')!;
        const editButton = host.querySelector<HTMLButtonElement>('.ytkn-settings__provider-edit')!;
        const deleteButton = host.querySelector<HTMLButtonElement>('.ytkn-settings__provider-delete')!;
        const providerFields = host.querySelector<HTMLElement>('.ytkn-settings__provider-fields')!;
        const modelsHeader = host.querySelector<HTMLElement>('.ytkn-settings__models-header')!;
        const modelsHeaderInfo = modelsHeader.querySelector<HTMLElement>(':scope > .setting-item-info')!;
        const modelsHeaderControl = modelsHeader.querySelector<HTMLElement>(':scope > .setting-item-control')!;
        const modelActionButtons = Array.from(
            modelsHeaderControl.querySelectorAll<HTMLButtonElement>(':scope > button'),
        );
        const modelItem = host.querySelector<HTMLElement>('.setting-model')!;
        const modelEditButton = modelItem.querySelector<HTMLButtonElement>('[aria-label="Edit model"]')!;
        const modelDeleteButton = modelItem.querySelector<HTMLButtonElement>('[aria-label="Delete model"]')!;

        expect(accordion.getAttribute('data-provider-name')).toBe('Local');
        expect(header.classList.contains('setting-item')).toBe(true);
        expect(header.classList.contains('ytkn-setting-row--fit-control')).toBe(true);
        expect(providerInfo.classList.contains('setting-item-info')).toBe(true);
        expect(providerControls.classList.contains('setting-item-control')).toBe(true);
        expect(title.classList.contains('setting-item-name')).toBe(true);
        expect(description.classList.contains('setting-item-description')).toBe(true);
        expect(providerInfo.children[0]).toBe(title);
        expect(providerInfo.children[1]).toBe(description);
        expect(providerInfo.children).toHaveLength(2);
        expect(title.textContent).toBe('Local');
        expect(description.textContent).toBe('OpenAI-compatible · 1 model');
        expect(host.querySelector('.ytkn-settings__provider-meta')).toBeNull();
        expect(host.querySelector('.ytkn-settings__provider-badge')).toBeNull();
        expect(host.querySelector('.ytkn-settings__provider-count')).toBeNull();
        expect(providerFields.querySelectorAll('.ytkn-settings__provider-field')).toHaveLength(2);
        expect(modelsHeader.classList.contains('setting-item')).toBe(true);
        expect(modelsHeaderInfo.querySelector('.setting-item-name')?.textContent).toBe('Models');
        expect(modelActionButtons.map((button) => button.textContent)).toEqual(['Fetch models', 'Add model']);
        expect(modelActionButtons.every((button) => button.closest('.setting-item') === modelsHeader)).toBe(true);
        expect(modelItem.getAttribute('data-model-id')).toBe('Local:llama3');
        expect(modelItem.classList.contains('ytkn-setting-row--model')).toBe(true);

        header.click();
        fetchButton.click();
        editButton.click();
        deleteButton.click();
        modelActionButtons[0].click();
        modelActionButtons[1].click();
        modelEditButton.click();
        modelDeleteButton.click();

        expect(handlers.handleAccordionToggle).toHaveBeenCalledWith(accordion);
        expect(handlers.handleFetchProviderModels).toHaveBeenCalledTimes(2);
        expect(handlers.handleFetchProviderModels).toHaveBeenLastCalledWith(provider);
        expect(handlers.handleProviderEditClick).toHaveBeenCalledWith(provider);
        expect(handlers.handleProviderDeleteClick).toHaveBeenCalledWith(provider);
        expect(handlers.handleAddModelClick).toHaveBeenCalledWith(provider);
        expect(handlers.handleModelEditClick).toHaveBeenCalledWith(provider.models![0]);
        expect(handlers.handleModelDeleteClick).toHaveBeenCalledWith(provider.models![0]);
    });

    it('formats provider descriptions as plain type and model-count summaries', () => {
        const cases: Array<[ProviderConfig['type'], number, string]> = [
            ['openai', 3, 'OpenAI · 3 models'],
            ['openai-compatible', 7, 'OpenAI-compatible · 7 models'],
            ['anthropic', 2, 'Anthropic · 2 models'],
            ['gemini', 12, 'Gemini · 12 models'],
        ];
        const host = document.createElement('div');
        const components = new SettingsUIComponents(new App());

        for (const [type, modelCount, expected] of cases) {
            host.replaceChildren();
            components.createProviderAccordion(host, makeProvider(type, modelCount));

            expect(host.querySelector('.ytkn-settings__provider-description')?.textContent).toBe(expected);
        }
    });

    it('stamps setting rows based on direct controls and modal stacking context', () => {
        const host = document.createElement('div');
        new Setting(host).setName('Select').addDropdown((dropdown) => dropdown.addOption('a', 'A'));
        new Setting(host).setName('Number').addText((text) => {
            text.inputEl.type = 'number';
        });
        new Setting(host).setName('Button').addButton((button) => button.setButtonText('Run'));
        const providerHeader = new Setting(host).setName('Provider');
        providerHeader.settingEl.addClass('ytkn-settings__provider-header');
        providerHeader.controlEl.createEl('button', { cls: 'clickable-icon' });
        const quickGrid = host.createDiv({ cls: 'ytkn-modal__quick-grid' });
        new Setting(quickGrid).setName('Quick select').addDropdown((dropdown) => dropdown.addOption('a', 'A'));

        stampSettingRowClasses(host);

        const rows = Array.from(host.querySelectorAll<HTMLElement>('.setting-item'));
        expect(rows[0].classList.contains('ytkn-setting-row--select')).toBe(true);
        expect(rows[0].classList.contains('ytkn-setting-row--fit-control')).toBe(true);
        expect(rows[1].classList.contains('ytkn-setting-row--number')).toBe(true);
        expect(rows[2].classList.contains('ytkn-setting-row--button')).toBe(true);
        expect(rows[3].classList.contains('ytkn-setting-row--fit-control')).toBe(true);
        expect(rows[4].classList.contains('ytkn-setting-row--stacked')).toBe(true);
        expect(rows[4].classList.contains('ytkn-setting-row--fit-control')).toBe(false);
    });

    it('renders brand actions as accessible icon-only links and buttons', () => {
        const host = document.createElement('div');
        const onClick = vi.fn();
        const actionsEl = renderBrandActions(host, [
            { id: 'docs', label: 'Docs', icon: 'book', href: 'https://example.com/docs' },
            { id: 'queue', label: 'Manage queue', icon: 'list-todo', onClick },
        ]);

        const actions = Array.from(actionsEl.querySelectorAll<HTMLElement>('.ytkn-brand-action'));
        expect(actions.map((action) => action.getAttribute('aria-label'))).toEqual(['Docs', 'Manage queue']);
        expect(actions[0].tagName).toBe('A');
        expect(actions[0].getAttribute('target')).toBe('_blank');
        expect(actions[1].tagName).toBe('BUTTON');
        expect(actions[1].getAttribute('type')).toBe('button');

        actions[1].click();
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('toggles semantic tabs and invokes the tab-change callback', () => {
        const host = document.createElement('div');
        const onTabChange = vi.fn();
        const group = new TabGroup(
            host,
            [
                { id: 'one', label: 'One', icon: 'circle' },
                { id: 'two', label: 'Two' },
            ],
            'one',
            onTabChange,
        );

        expect(group.getPanel('one')?.classList.contains('is-active')).toBe(true);
        expect(group.navEl.getAttribute('role')).toBe('tablist');

        (host.querySelector('#ytkn-tab-two') as HTMLButtonElement).click();

        expect(group.getPanel('one')?.classList.contains('is-active')).toBe(false);
        expect(group.getPanel('two')?.classList.contains('is-active')).toBe(true);
        expect(host.querySelector('#ytkn-tab-two')?.getAttribute('aria-selected')).toBe('true');
        expect(onTabChange).toHaveBeenLastCalledWith('two');
    });
});
