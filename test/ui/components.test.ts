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
        const fetchButton = host.querySelector<HTMLButtonElement>('.ytkn-settings__provider-fetch')!;
        const editButton = host.querySelector<HTMLButtonElement>('.ytkn-settings__provider-edit')!;
        const deleteButton = host.querySelector<HTMLButtonElement>('.ytkn-settings__provider-delete')!;

        expect(accordion.getAttribute('data-provider-name')).toBe('Local');
        expect(host.querySelector('.ytkn-settings__provider-badge')?.textContent).toBe('OpenAI compatible');
        expect(host.querySelector('.setting-model')?.getAttribute('data-model-id')).toBe('Local:llama3');

        header.click();
        fetchButton.click();
        editButton.click();
        deleteButton.click();

        expect(handlers.handleAccordionToggle).toHaveBeenCalledWith(accordion);
        expect(handlers.handleFetchProviderModels).toHaveBeenCalledWith(provider);
        expect(handlers.handleProviderEditClick).toHaveBeenCalledWith(provider);
        expect(handlers.handleProviderDeleteClick).toHaveBeenCalledWith(provider);
    });

    it('stamps setting rows based on direct controls and modal stacking context', () => {
        const host = document.createElement('div');
        new Setting(host).setName('Select').addDropdown((dropdown) => dropdown.addOption('a', 'A'));
        new Setting(host).setName('Number').addText((text) => {
            text.inputEl.type = 'number';
        });
        new Setting(host).setName('Button').addButton((button) => button.setButtonText('Run'));
        const quickGrid = host.createDiv({ cls: 'ytkn-modal__quick-grid' });
        new Setting(quickGrid).setName('Quick select').addDropdown((dropdown) => dropdown.addOption('a', 'A'));

        stampSettingRowClasses(host);

        const rows = Array.from(host.querySelectorAll<HTMLElement>('.setting-item'));
        expect(rows[0].classList.contains('ytkn-setting-row--select')).toBe(true);
        expect(rows[0].classList.contains('ytkn-setting-row--fit-control')).toBe(true);
        expect(rows[1].classList.contains('ytkn-setting-row--number')).toBe(true);
        expect(rows[2].classList.contains('ytkn-setting-row--button')).toBe(true);
        expect(rows[3].classList.contains('ytkn-setting-row--stacked')).toBe(true);
        expect(rows[3].classList.contains('ytkn-setting-row--fit-control')).toBe(false);
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
