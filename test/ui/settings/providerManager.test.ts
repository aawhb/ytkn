import { beforeEach, describe, expect, it, vi } from 'vitest';

const { discoverProviderModels } = vi.hoisted(() => ({
	discoverProviderModels: vi.fn(),
}));

vi.mock('obsidian', async () => import('../../mocks/obsidian'));
vi.mock('../../../src/ai/providers/discovery', () => ({ discoverProviderModels }));

import { App, Notice } from 'obsidian';
import { DEFAULT_OPENAI_COMPATIBLE_URL } from '../../../src/defaults';
import { ProviderManager } from '../../../src/ui/settings/ai/providerManager';
import type { ProviderConfig } from '../../../src/types';

const noticeMessages = (): string[] => (
	Notice as typeof Notice & { messages: string[] }
).messages;
const lastNoticeMessage = (): string | undefined => {
	const messages = noticeMessages();
	return messages[messages.length - 1];
};

const localProvider: ProviderConfig = {
	name: 'Local',
	type: 'openai-compatible',
	apiKey: '',
	url: 'http://localhost:11434/v1',
	models: [],
};

function makeSettings(seed: ProviderConfig[] = [localProvider]) {
	let providers = structuredClone(seed);
	const settings = {
		getProviders: vi.fn(() => providers),
		getModels: vi.fn(() => providers.flatMap((provider) => provider.models ?? [])),
		getModelIds: vi.fn(() => [] as string[]),
		addProvider: vi.fn(async (provider: ProviderConfig) => {
			providers.push(provider);
		}),
		updateProvider: vi.fn(async (provider: ProviderConfig, originalName: string) => {
			providers = providers.map((item) => item.name === originalName ? provider : item);
		}),
		saveProviderSecretId: vi.fn(async (providerName: string, secretId: string) => {
			providers = providers.map((provider) => provider.name === providerName
				? { ...provider, apiKeySecretId: secretId || undefined }
				: provider);
		}),
		mergeProviderModels: vi.fn(async () => 1),
		updateModelIds: vi.fn(async () => undefined),
		addModel: vi.fn(async () => undefined),
		updateModel: vi.fn(async () => undefined),
		deleteModel: vi.fn(async () => undefined),
		deleteProvider: vi.fn(async () => undefined),
	};
	return settings;
}

describe('ProviderManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		noticeMessages().length = 0;
	});

	it('reports readiness without requiring a secret for OpenAI-compatible providers', () => {
		const settings = makeSettings();
		const manager = new ProviderManager(new App(), settings as any, vi.fn());

		expect(manager.getReadiness(localProvider)).toEqual({
			ready: true,
			message: 'Ready to fetch models.',
		});
		expect(manager.getReadiness({ ...localProvider, url: '' }).ready).toBe(false);
		expect(manager.getReadiness({ name: 'OpenAI', type: 'openai', apiKey: '' }).ready).toBe(false);
		expect(manager.getReadiness({
			name: 'OpenAI',
			type: 'openai',
			apiKey: 'resolved',
			apiKeySecretId: 'openai-key',
		}).ready).toBe(true);
	});

	it('autosaves type changes and initializes the compatible URL', async () => {
		const cloud: ProviderConfig = {
			name: 'Cloud',
			type: 'openai',
			apiKey: '',
			models: [],
		};
		const settings = makeSettings([cloud]);
		const onStructureChanged = vi.fn();
		const manager = new ProviderManager(new App(), settings as any, onStructureChanged);

		await manager.updateProviderType('Cloud', 'openai-compatible');

		expect(settings.updateProvider).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Cloud',
				type: 'openai-compatible',
				url: DEFAULT_OPENAI_COMPATIBLE_URL,
			}),
			'Cloud',
		);
		expect(onStructureChanged).toHaveBeenCalledOnce();
	});

	it('renames explicitly and leaves URL autosave non-structural', async () => {
		const settings = makeSettings();
		const onStructureChanged = vi.fn();
		const manager = new ProviderManager(new App(), settings as any, onStructureChanged);

		await manager.updateProviderUrl('Local', ' http://new-host:11434/v1 ');
		expect(settings.updateProvider).toHaveBeenLastCalledWith(
			expect.objectContaining({ url: 'http://new-host:11434/v1' }),
			'Local',
		);
		expect(onStructureChanged).not.toHaveBeenCalled();

		await manager.renameProvider('Local', 'Home AI');
		expect(settings.updateProvider).toHaveBeenLastCalledWith(
			expect.objectContaining({ name: 'Home AI' }),
			'Local',
		);
		expect(onStructureChanged).toHaveBeenCalledOnce();
	});

	it('fetches and merge-adds models only when the provider is ready', async () => {
		discoverProviderModels.mockResolvedValue([
			{ name: 'llama3.2', displayName: 'Llama 3.2' },
		]);
		const settings = makeSettings();
		const onStructureChanged = vi.fn();
		const manager = new ProviderManager(new App(), settings as any, onStructureChanged);

		await manager.fetchModels('Local');

		expect(discoverProviderModels).toHaveBeenCalledWith(localProvider);
		expect(settings.mergeProviderModels).toHaveBeenCalledWith('Local', [
			{ name: 'llama3.2', displayName: 'Llama 3.2' },
		]);
		expect(onStructureChanged).toHaveBeenCalledOnce();

		await manager.updateProviderUrl('Local', '');
		discoverProviderModels.mockClear();
		await manager.fetchModels('Local');
		expect(discoverProviderModels).not.toHaveBeenCalled();
	});

	it('explains why no model can be added to model order', () => {
		const emptySettings = makeSettings();
		const emptyManager = new ProviderManager(new App(), emptySettings as any, vi.fn());

		emptyManager.openModelPicker();
		expect(lastNoticeMessage()).toBe(
			'Add a model to a provider before adding it to model order.',
		);

		const provider: ProviderConfig = {
			...localProvider,
			models: [{
				name: 'llama3.2',
				displayName: 'Llama 3.2',
				provider: localProvider,
			}],
		};
		const completeSettings = makeSettings([provider]);
		completeSettings.getModelIds.mockReturnValue(['Local:llama3.2']);
		const completeManager = new ProviderManager(new App(), completeSettings as any, vi.fn());

		completeManager.openModelPicker();
		expect(lastNoticeMessage()).toBe(
			'All available models are already in model order.',
		);
	});
});
