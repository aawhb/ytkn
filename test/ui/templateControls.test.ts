import { describe, it, expect, vi } from 'vitest';

vi.mock('obsidian', async () => {
    const mod = await import('../mocks/obsidian');
    return mod;
});

import { renderTemplateControls } from '../../src/ui/components/TemplateControls';
import type { ControlDeclaration } from '../../src/types';

describe('renderTemplateControls', () => {
    it('renders enum controls with the shared control-row class', () => {
        const container = document.createElement('div');
        const controls: ControlDeclaration[] = [
            {
                id: 'depth',
                type: 'enum',
                label: 'Depth',
                description: 'How detailed the note should be.',
                enumValues: ['short', 'long'],
                required: false,
            },
        ];

        renderTemplateControls(container, controls, {}, vi.fn());

        const row = container.querySelector('.setting-item.ytkn-control-row');
        expect(row).not.toBeNull();
        expect(row?.querySelector('select')).not.toBeNull();
    });

    it('renders multiline string controls with textarea contract classes', () => {
        const container = document.createElement('div');
        const controls: ControlDeclaration[] = [
            {
                id: 'audience',
                type: 'string',
                label: 'Audience',
                description: 'Audience context for the note.',
                multiline: true,
                required: false,
            },
        ];

        renderTemplateControls(container, controls, {}, vi.fn());

        const row = container.querySelector(
            '.setting-item.ytkn-control-row.ytkn-control-row--textarea',
        );
        const textarea = container.querySelector('textarea.ytkn-control-row__textarea');
        expect(row).not.toBeNull();
        expect(textarea).not.toBeNull();
    });

    it('renders single-line string controls with the shared form input class', () => {
        const container = document.createElement('div');
        const controls: ControlDeclaration[] = [
            {
                id: 'focus',
                type: 'string',
                label: 'Focus',
                description: 'Primary focus for the note.',
                required: false,
            },
        ];

        renderTemplateControls(container, controls, {}, vi.fn());

        const input = container.querySelector('input.ytkn-form__input');
        expect(input).not.toBeNull();
    });
});
