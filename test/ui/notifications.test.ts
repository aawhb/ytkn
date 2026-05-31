import { beforeEach, describe, expect, it, vi } from 'vitest';

const noticeMessages = vi.hoisted(() => [] as string[]);

vi.mock('obsidian', () => ({
    Notice: class {
        constructor(message: string) {
            noticeMessages.push(message);
        }
    },
}));

import { notifyError } from '../../src/ui/notifications';

describe('notifyError', () => {
    beforeEach(() => {
        noticeMessages.length = 0;
        vi.restoreAllMocks();
    });

    it('logs the original error and shows a user-facing notice', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const error = new Error('Provider failed');

        notifyError('Could not generate note', error, { url: 'https://youtu.be/example' });

        expect(consoleSpy).toHaveBeenCalledWith(
            'Could not generate note:',
            error,
            { url: 'https://youtu.be/example' },
        );
        expect(noticeMessages).toEqual(['Could not generate note: Provider failed']);
    });
});
