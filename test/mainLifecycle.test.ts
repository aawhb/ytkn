import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	const noticeMessages: string[] = [];
	const modalOpenEvents: Array<{ kind: string; args: unknown[] }> = [];
	const queueSnapshots: Array<{
		current: { ordinal: number; displayTitle: string } | null;
		queued: unknown[];
	}> = [{ current: null, queued: [] }];
	const runQueueInstances: Array<{
		cancelAll: ReturnType<typeof vi.fn>;
		getSnapshot: ReturnType<typeof vi.fn>;
		on: ReturnType<typeof vi.fn>;
		emit: (event: unknown) => void;
	}> = [];
	const settingsInstances: Array<{
		loadSettings: ReturnType<typeof vi.fn>;
		hasSavedSettings: ReturnType<typeof vi.fn>;
		getLastSeenReleaseNotesVersion: ReturnType<typeof vi.fn>;
		setLastSeenReleaseNotesVersion: ReturnType<typeof vi.fn>;
		getOutputDefaults: ReturnType<typeof vi.fn>;
		getInstructionConfig: ReturnType<typeof vi.fn>;
		getModelIds: ReturnType<typeof vi.fn>;
		getSelectedModel: ReturnType<typeof vi.fn>;
		getModels: ReturnType<typeof vi.fn>;
		getTemperature: ReturnType<typeof vi.fn>;
		getRequestTimeoutMs: ReturnType<typeof vi.fn>;
	}> = [];

	return {
		noticeMessages,
		modalOpenEvents,
		queueSnapshots,
		runQueueInstances,
		settingsInstances,
		setIcon: vi.fn(),
		notifyError: vi.fn(),
		resolveReleaseNotesStartupAction: vi.fn(() => ({ kind: 'none' })),
	};
});

vi.mock('obsidian', () => {
	class MarkdownView { }
	class TFile {
		path = 'Current.md';
	}
	class Notice {
		constructor(message?: string) {
			mocks.noticeMessages.push(message ?? '');
		}
	}
	class Plugin {
		app = {
			workspace: {
				getActiveViewOfType: vi.fn(() => null),
			},
			vault: {
				cachedRead: vi.fn(async () => ''),
			},
		};
		manifest = { name: 'YT Knowledge Notes', version: '1.7.0' };
		commands: Array<{ id: string; name: string; callback: () => unknown }> = [];
		settingTabs: unknown[] = [];
		domEvents: Array<{ el: HTMLElement; event: string; callback: EventListener }> = [];
		statusBarItems: HTMLElement[] = [];

		addCommand(command: { id: string; name: string; callback: () => unknown }): void {
			this.commands.push(command);
		}

		addSettingTab(tab: unknown): void {
			this.settingTabs.push(tab);
		}

		addStatusBarItem(): HTMLElement {
			const el = document.createElement('div');
			el.detach = vi.fn(() => el.remove());
			this.statusBarItems.push(el);
			return el;
		}

		registerDomEvent(el: HTMLElement, event: string, callback: EventListener): void {
			this.domEvents.push({ el, event, callback });
			el.addEventListener(event, callback);
		}
	}

	return { Editor: class { }, MarkdownView, Notice, Plugin, TFile, setIcon: mocks.setIcon };
});

vi.mock('../src/ui/settings/settingsTab', () => ({
	SettingsTab: class {
		constructor(public app: unknown, public plugin: unknown) { }
	},
}));

vi.mock('../src/ui/shared/notifications', () => ({
	notifyError: mocks.notifyError,
}));

vi.mock('../src/settings/settingsService', () => ({
	SettingsService: class {
		loadSettings = vi.fn(async () => undefined);
		hasSavedSettings = vi.fn(() => true);
		getLastSeenReleaseNotesVersion = vi.fn(() => '1.6.0');
		setLastSeenReleaseNotesVersion = vi.fn(async () => undefined);
		getOutputDefaults = vi.fn(() => ({
			useAi: true,
			generateAiSummary: true,
			transcriptMode: 'none',
			playlistMode: 'per-video',
			transcriptLanguageMode: 'auto',
			preferredTranscriptLanguage: '',
			transcriptFailureMode: 'skip',
			mediaEmbedMode: 'video',
			includeRunReport: false,
			runReportLocation: 'generated-note',
			useVideoTitleAsNoteName: true,
			noteDestinationMode: 'current-note',
			noteDestinationFolder: '',
			includeFrontmatter: true,
			frontmatterTags: '',
			frontmatterPropertyAllowlist: '',
			sourceSectionPosition: 'top',
			linkTimestamps: true,
			tldrCalloutAtTop: true,
		}));
		getInstructionConfig = vi.fn(() => ({
			mode: 'template',
			template: 'general',
			manualInstructions: '',
			includeMindmap: false,
			includeMemorableQuotes: false,
			controlValues: {},
		}));
		getModelIds = vi.fn(() => []);
		getSelectedModel = vi.fn(() => null);
		getModels = vi.fn(() => []);
		getTemperature = vi.fn(() => 0.3);
		getRequestTimeoutMs = vi.fn(() => 300000);

		constructor() {
			mocks.settingsInstances.push(this);
		}
	},
}));

vi.mock('../src/youtube/youtubeService', () => ({
	YouTubeService: vi.fn(),
}));

vi.mock('../src/generation/generationService', () => ({
	GenerationService: class {
		executeRun = vi.fn();
		resolveTitle = vi.fn();
		persistBatchReport = vi.fn();
	},
}));

vi.mock('../src/queue/runQueueService', () => ({
	RunQueueService: class {
		private listener?: (event: unknown) => void;
		cancelAll = vi.fn();
		getSnapshot = vi.fn(() => mocks.queueSnapshots[mocks.queueSnapshots.length - 1]);
		on = vi.fn((listener: (event: unknown) => void) => {
			this.listener = listener;
		});
		emit(event: unknown): void {
			this.listener?.(event);
		}
		constructor() {
			mocks.runQueueInstances.push(this);
		}
	},
	buildEditorAppendSequentialPolicy: vi.fn(() => ({ kind: 'append' })),
	buildEditorReplaceRangeFirstPolicy: vi.fn(() => ({ kind: 'replace' })),
	buildFolderTargetPolicy: vi.fn(() => ({ kind: 'folder' })),
}));

vi.mock('../src/ui/generation/generationOptionsModal', () => ({
	GenerationOptionsModal: class {
		constructor(...args: unknown[]) {
			mocks.modalOpenEvents.push({ kind: 'generation-created', args });
		}
		open(): void {
			mocks.modalOpenEvents.push({ kind: 'generation-opened', args: [] });
		}
	},
}));

vi.mock('../src/ui/queue/queueModal', () => ({
	QueueModal: class {
		constructor(...args: unknown[]) {
			mocks.modalOpenEvents.push({ kind: 'queue-created', args });
		}
		open(): void {
			mocks.modalOpenEvents.push({ kind: 'queue-opened', args: [] });
		}
	},
}));

vi.mock('../src/ui/releaseNotes/whatsNewModal', () => ({
	WhatsNewModal: class {
		constructor(...args: unknown[]) {
			mocks.modalOpenEvents.push({ kind: 'whats-new-created', args });
		}
		open(): void {
			mocks.modalOpenEvents.push({ kind: 'whats-new-opened', args: [] });
		}
	},
}));

vi.mock('../src/releaseNotes', () => ({
	resolveReleaseNotesStartupAction: mocks.resolveReleaseNotesStartupAction,
}));

import { YTKN } from '../src/main';

describe('YTKN plugin lifecycle', () => {
	beforeEach(() => {
		mocks.noticeMessages.length = 0;
		mocks.modalOpenEvents.length = 0;
		mocks.runQueueInstances.length = 0;
		mocks.settingsInstances.length = 0;
		mocks.queueSnapshots.splice(0, mocks.queueSnapshots.length, { current: null, queued: [] });
		mocks.notifyError.mockClear();
		mocks.resolveReleaseNotesStartupAction.mockClear();
	});

	it('loads services, settings UI, commands, and status-bar queue wiring', async () => {
		const plugin = new YTKN({} as any, {} as any) as YTKN & {
			commands: Array<{ id: string; callback: () => unknown }>;
			settingTabs: unknown[];
			statusBarItems: HTMLElement[];
		};

		await plugin.onload();

		expect(mocks.settingsInstances[0].loadSettings).toHaveBeenCalledOnce();
		expect(plugin.settingTabs).toHaveLength(1);
		expect(plugin.commands.map((command) => command.id)).toEqual([
			'generate-video-knowledge-note',
			'cancel-all-queued',
			'manage-knowledge-note-queue',
		]);
		expect(plugin.statusBarItems[0].classList.contains('ytkn-status-bar--clickable')).toBe(true);
		expect(plugin.statusBarItems[0].style.display).toBe('none');

		plugin.statusBarItems[0].click();
		expect(mocks.modalOpenEvents.map((event) => event.kind)).toContain('queue-opened');
	});

	it('command callbacks open generation and queue modals and handle empty cancellation', async () => {
		const plugin = new YTKN({} as any, {} as any) as YTKN & {
			commands: Array<{ id: string; callback: () => unknown }>;
		};
		await plugin.onload();

		await plugin.commands.find((command) => command.id === 'generate-video-knowledge-note')?.callback();
		plugin.commands.find((command) => command.id === 'manage-knowledge-note-queue')?.callback();
		plugin.commands.find((command) => command.id === 'cancel-all-queued')?.callback();

		expect(mocks.modalOpenEvents.map((event) => event.kind)).toEqual([
			'generation-created',
			'generation-opened',
			'queue-created',
			'queue-opened',
		]);
		expect(mocks.noticeMessages).toContain('Nothing to cancel.');
		expect(mocks.runQueueInstances[0].cancelAll).not.toHaveBeenCalled();
	});

	it('explains unsupported channel tabs before queueing', async () => {
		const plugin = new YTKN({} as any, {} as any) as YTKN & {
			commands: Array<{ id: string; callback: () => unknown }>;
		};
		await plugin.onload();
		await plugin.commands.find((command) => command.id === 'generate-video-knowledge-note')?.callback();

		const created = mocks.modalOpenEvents.find((event) => event.kind === 'generation-created');
		const submit = created?.args[4] as ((urls: string[], options: unknown) => void) | undefined;
		submit?.(['https://www.youtube.com/@channel/playlists'], {});

		expect(mocks.noticeMessages).toContain(
			'URL #1 uses the unsupported channel tab "playlists". Use a channel Home, Videos, Shorts, or Live link.',
		);
	});

	it('renders the current queue title once and refreshes it on queue events', async () => {
		const plugin = new YTKN({} as any, {} as any) as YTKN & { statusBarItems: HTMLElement[] };
		await plugin.onload();
		mocks.queueSnapshots.push({
			current: { ordinal: 7, displayTitle: '#7 · Resolved title' },
			queued: [{}],
		});

		mocks.runQueueInstances[0].emit({ type: 'title-resolved' });

		expect(plugin.statusBarItems[0].textContent).toBe(
			'YouTube · #7 · Resolved title — Working… (1 queued)',
		);
	});

	it('cancels queued work and detaches status bar on unload without throwing', async () => {
		const plugin = new YTKN({} as any, {} as any) as YTKN & { statusBarItems: HTMLElement[] };
		await plugin.onload();

		expect(() => plugin.onunload()).not.toThrow();
		expect(mocks.runQueueInstances[0].cancelAll).toHaveBeenCalledOnce();
		expect((plugin.statusBarItems[0].detach as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
	});
});
