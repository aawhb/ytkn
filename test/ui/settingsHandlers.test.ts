import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockNotice } = vi.hoisted(() => ({ mockNotice: vi.fn() }));

vi.mock('obsidian', async () => {
	const mod = await import('../mocks/obsidian');
	return {
		...mod,
		Notice: mockNotice,
	};
});

import { SettingsEventHandlers } from '../../src/ui/handlers/SettingsEventHandlers';
import type { ProviderConfig, ModelConfig } from '../../src/types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const fakeProvider: ProviderConfig = {
	name: 'TestProvider',
	type: 'openai',
	apiKey: 'key123',
};

const fakeModel: ModelConfig = {
	name: 'gpt-4',
	displayName: 'GPT-4',
	provider: fakeProvider,
};

function makeFakeSettings(providerList: ProviderConfig[] = []) {
	return {
		validateModelId: vi.fn().mockReturnValue(true),
		updateActiveModel: vi.fn().mockResolvedValue(undefined),
		addProvider: vi.fn().mockResolvedValue(undefined),
		updateProvider: vi.fn().mockResolvedValue(undefined),
		deleteProvider: vi.fn().mockResolvedValue(undefined),
		mergeProviderModels: vi.fn().mockResolvedValue(0),
		saveProviderSecretId: vi.fn().mockResolvedValue(undefined),
		addModel: vi.fn().mockResolvedValue(undefined),
		updateModel: vi.fn().mockResolvedValue(undefined),
		deleteModel: vi.fn().mockResolvedValue(undefined),
		resetSettings: vi.fn().mockResolvedValue(undefined),
		getProviders: vi.fn().mockReturnValue(providerList),
	};
}

const mockOpen = vi.fn();

const fakeModalsFactory = {
	createDeleteProviderModal: vi.fn().mockReturnValue({ open: mockOpen }),
	createEditProviderModal: vi.fn().mockReturnValue({ open: vi.fn() }),
	createAddModelModal: vi.fn().mockReturnValue({ open: vi.fn() }),
	createEditModelModal: vi.fn().mockReturnValue({ open: vi.fn() }),
	createDeleteModelModal: vi.fn().mockReturnValue({ open: vi.fn() }),
} as any;

// ---------------------------------------------------------------------------
// A. Explicit-action error handlers — call notifyError (console.error + Notice)
// ---------------------------------------------------------------------------

describe('SettingsEventHandlers – explicit-action error handlers call notifyError', () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	it('handleProviderAdd — service throws → console.error and Notice called', async () => {
		const fakeSettings = makeFakeSettings();
		fakeSettings.addProvider.mockRejectedValueOnce(new Error('add failed'));
		const fakePlugin = { settings: fakeSettings } as any;

		const handlers = new SettingsEventHandlers(fakePlugin, fakeModalsFactory);

		await expect(handlers.handleProviderAdd(fakeProvider)).rejects.toThrow('add failed');

		expect(consoleSpy).toHaveBeenCalled();
		expect(mockNotice).toHaveBeenCalled();
	});

	it('handleProviderEdit — service throws → console.error and Notice called', async () => {
		const fakeSettings = makeFakeSettings();
		fakeSettings.updateProvider.mockRejectedValueOnce(new Error('edit failed'));
		const fakePlugin = { settings: fakeSettings } as any;

		const handlers = new SettingsEventHandlers(fakePlugin, fakeModalsFactory);

		await expect(handlers.handleProviderEdit(fakeProvider, 'OldName')).rejects.toThrow('edit failed');

		expect(consoleSpy).toHaveBeenCalled();
		expect(mockNotice).toHaveBeenCalled();
	});

	it('handleProviderDelete — service throws → console.error and Notice called', async () => {
		const fakeSettings = makeFakeSettings();
		fakeSettings.deleteProvider.mockRejectedValueOnce(new Error('delete failed'));
		const fakePlugin = { settings: fakeSettings } as any;

		const handlers = new SettingsEventHandlers(fakePlugin, fakeModalsFactory);

		await expect(handlers.handleProviderDelete(fakeProvider)).rejects.toThrow('delete failed');

		expect(consoleSpy).toHaveBeenCalled();
		expect(mockNotice).toHaveBeenCalled();
	});

	it('handleModelAdd — service throws → console.error and Notice called', async () => {
		const fakeSettings = makeFakeSettings();
		fakeSettings.addModel.mockRejectedValueOnce(new Error('model add failed'));
		const fakePlugin = { settings: fakeSettings } as any;

		const handlers = new SettingsEventHandlers(fakePlugin, fakeModalsFactory);

		await expect(handlers.handleModelAdd(fakeModel)).rejects.toThrow('model add failed');

		expect(consoleSpy).toHaveBeenCalled();
		expect(mockNotice).toHaveBeenCalled();
	});

	it('handleModelDelete — service throws → console.error and Notice called', async () => {
		const fakeSettings = makeFakeSettings();
		fakeSettings.deleteModel.mockRejectedValueOnce(new Error('model delete failed'));
		const fakePlugin = { settings: fakeSettings } as any;

		const handlers = new SettingsEventHandlers(fakePlugin, fakeModalsFactory);

		await expect(handlers.handleModelDelete(fakeModel)).rejects.toThrow('model delete failed');

		expect(consoleSpy).toHaveBeenCalled();
		expect(mockNotice).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// B. Autosave handlers — console.error called but Notice NOT called (§3b lock)
// ---------------------------------------------------------------------------

describe('SettingsEventHandlers – autosave error handlers do NOT call Notice', () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	it('handleProviderUrlChange — service throws → console.error called, Notice NOT called', async () => {
		// getProviders must return the provider so the handler proceeds past the early-return guard
		const fakeSettings = makeFakeSettings([fakeProvider]);
		fakeSettings.updateProvider.mockRejectedValueOnce(new Error('url save failed'));
		const fakePlugin = { settings: fakeSettings } as any;

		const handlers = new SettingsEventHandlers(fakePlugin, fakeModalsFactory);

		// Should resolve (autosave swallows the error)
		await handlers.handleProviderUrlChange(fakeProvider, 'http://new-url.example.com');

		expect(consoleSpy).toHaveBeenCalled();
		expect(mockNotice).not.toHaveBeenCalled();
	});

	it('handleApiKeySecretChange — service throws → console.error called, Notice NOT called', async () => {
		const fakeSettings = makeFakeSettings();
		fakeSettings.saveProviderSecretId.mockRejectedValueOnce(new Error('key save failed'));
		const fakePlugin = { settings: fakeSettings } as any;

		const handlers = new SettingsEventHandlers(fakePlugin, fakeModalsFactory);

		// Should resolve (autosave swallows the error)
		await handlers.handleApiKeySecretChange('TestProvider', 'new-api-key');

		expect(consoleSpy).toHaveBeenCalled();
		expect(mockNotice).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// C. Modal opens correctly
// ---------------------------------------------------------------------------

describe('SettingsEventHandlers – modal delegation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('handleProviderDeleteClick — calls createDeleteProviderModal and opens it', () => {
		const fakeSettings = makeFakeSettings();
		const fakePlugin = { settings: fakeSettings } as any;

		const handlers = new SettingsEventHandlers(fakePlugin, fakeModalsFactory);
		handlers.handleProviderDeleteClick(fakeProvider);

		expect(fakeModalsFactory.createDeleteProviderModal).toHaveBeenCalledWith(fakeProvider, handlers);
		expect(mockOpen).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// D. CSS state contracts
// ---------------------------------------------------------------------------

describe('SettingsEventHandlers – accordion state contracts', () => {
	function makeAccordion(parent: HTMLElement): HTMLElement {
		const accordion = parent.createDiv({ cls: 'ytkn-settings__provider-accordion' });
		accordion.createDiv({ cls: 'ytkn-settings__provider-content' });
		accordion.createDiv({ cls: 'ytkn-settings__collapse-icon' });
		return accordion;
	}

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('toggles is-expanded on one accordion and collapses siblings', () => {
		const fakeSettings = makeFakeSettings();
		const fakePlugin = { settings: fakeSettings } as any;
		const handlers = new SettingsEventHandlers(fakePlugin, fakeModalsFactory);
		const parent = document.createElement('div');
		const firstAccordion = makeAccordion(parent);
		const secondAccordion = makeAccordion(parent);

		handlers.handleAccordionToggle(firstAccordion);
		expect(firstAccordion.classList.contains('is-expanded')).toBe(true);

		handlers.handleAccordionToggle(secondAccordion);
		expect(firstAccordion.classList.contains('is-expanded')).toBe(false);
		expect(secondAccordion.classList.contains('is-expanded')).toBe(true);
	});
});
