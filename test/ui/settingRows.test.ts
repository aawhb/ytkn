import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
    const mod = await import('../mocks/obsidian');
    return mod;
});

import { Setting } from 'obsidian';
import { stampSettingRowClasses } from '../../src/ui/settingRows';

describe('stampSettingRowClasses', () => {
    it('stamps select rows as fit-control outside the quick grid', () => {
        const host = document.createElement('div');
        new Setting(host).setName('Select').addDropdown((dropdown) => dropdown.addOption('a', 'A'));

        stampSettingRowClasses(host);

        const row = host.querySelector<HTMLElement>('.setting-item')!;
        expect(row.classList.contains('ytkn-setting-row--select')).toBe(true);
        expect(row.classList.contains('ytkn-setting-row--fit-control')).toBe(true);
        expect(row.classList.contains('ytkn-setting-row--stacked')).toBe(false);
    });

    it('stamps number input rows as fit-control outside the quick grid', () => {
        const host = document.createElement('div');
        new Setting(host).setName('Number').addText((text) => {
            text.inputEl.type = 'number';
        });

        stampSettingRowClasses(host);

        const row = host.querySelector<HTMLElement>('.setting-item')!;
        expect(row.classList.contains('ytkn-setting-row--number')).toBe(true);
        expect(row.classList.contains('ytkn-setting-row--fit-control')).toBe(true);
    });

    it('stamps text button rows but ignores icon-only buttons for button detection', () => {
        const host = document.createElement('div');
        new Setting(host).setName('Text button').addButton((button) => button.setButtonText('Run'));
        const iconOnly = new Setting(host).setName('Icon button');
        iconOnly.controlEl.createEl('button', { cls: 'clickable-icon' });

        stampSettingRowClasses(host);

        const rows = Array.from(host.querySelectorAll<HTMLElement>('.setting-item'));
        expect(rows[0].classList.contains('ytkn-setting-row--button')).toBe(true);
        expect(rows[0].classList.contains('ytkn-setting-row--fit-control')).toBe(true);
        expect(rows[1].classList.contains('ytkn-setting-row--button')).toBe(false);
        expect(rows[1].classList.contains('ytkn-setting-row--fit-control')).toBe(false);
    });

    it('keeps quick-grid select and number rows stacked', () => {
        const host = document.createElement('div');
        const quickGrid = host.createDiv({ cls: 'ytkn-modal__quick-grid' });
        new Setting(quickGrid).setName('Quick select').addDropdown((dropdown) => dropdown.addOption('a', 'A'));
        new Setting(quickGrid).setName('Quick number').addText((text) => {
            text.inputEl.type = 'number';
        });

        stampSettingRowClasses(host);

        const rows = Array.from(host.querySelectorAll<HTMLElement>('.setting-item'));
        for (const row of rows) {
            expect(row.classList.contains('ytkn-setting-row--stacked')).toBe(true);
            expect(row.classList.contains('ytkn-setting-row--fit-control')).toBe(false);
        }
    });

    it('keeps model setting selects stacked even outside the quick grid', () => {
        const host = document.createElement('div');
        const modelSetting = new Setting(host).setName('AI model').addDropdown((dropdown) => dropdown.addOption('model', 'Model'));
        modelSetting.settingEl.addClass('ytkn-modal__model-setting');

        stampSettingRowClasses(host);

        expect(modelSetting.settingEl.classList.contains('ytkn-setting-row--select')).toBe(true);
        expect(modelSetting.settingEl.classList.contains('ytkn-setting-row--stacked')).toBe(true);
        expect(modelSetting.settingEl.classList.contains('ytkn-setting-row--fit-control')).toBe(false);
    });

    it('stamps provider headers as fit-control even with only icon controls', () => {
        const host = document.createElement('div');
        const providerHeader = new Setting(host).setName('Provider');
        providerHeader.settingEl.addClass('ytkn-settings__provider-header');
        providerHeader.controlEl.createEl('button', { cls: 'clickable-icon' });

        stampSettingRowClasses(host);

        expect(providerHeader.settingEl.classList.contains('ytkn-setting-row--button')).toBe(false);
        expect(providerHeader.settingEl.classList.contains('ytkn-setting-row--fit-control')).toBe(true);
    });
});
