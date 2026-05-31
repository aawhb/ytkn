import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => {
	const mod = await import('../mocks/obsidian');
	return { ...mod, TFile: class TFile { } };
});

import { GenerationService } from '../../src/services/generation';
import type { GenerationOptions, PlaylistResponse, PluginSettings, TranscriptResponse } from '../../src/types';
import type { QueuedRun } from '../../src/services/runQueue';

const VIDEO_URL = 'https://www.youtube.com/watch?v=abcdefghijk';
const PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PL123';

function makeTranscript(url: string, overrides: Partial<TranscriptResponse> = {}): TranscriptResponse {
	const videoId = overrides.videoId ?? new URL(url).searchParams.get('v') ?? 'abcdefghijk';
	return {
		url,
		videoId,
		title: overrides.title ?? 'Captionless Video',
		author: overrides.author ?? 'Metadata Channel',
		channelId: overrides.channelId ?? 'UC123',
		channelUrl: overrides.channelUrl ?? 'https://www.youtube.com/channel/UC123',
		description: overrides.description ?? 'Metadata description.',
		thumbnailUrl: overrides.thumbnailUrl ?? `https://img.example/${videoId}.jpg`,
		durationSeconds: overrides.durationSeconds ?? 90,
		keywords: overrides.keywords ?? ['metadata'],
		lines: overrides.lines ?? [],
	};
}

function makePlaylist(entries = [
	{ videoId: 'video000001', url: 'https://www.youtube.com/watch?v=video000001&list=PL123', position: 1, title: 'Playlist Video 1' },
	{ videoId: 'video000002', url: 'https://www.youtube.com/watch?v=video000002&list=PL123', position: 2, title: 'Playlist Video 2' },
]): PlaylistResponse {
	return {
		url: PLAYLIST_URL,
		playlistId: 'PL123',
		title: 'Metadata Playlist',
		entries,
	};
}

function makeSettings(): PluginSettings {
	return {
		getModels: vi.fn(() => []),
		getOutputDefaults: vi.fn(() => ({ useAi: false, generateAiSummary: false })),
		getInstructionConfig: vi.fn(() => ({
			mode: 'template',
			template: 'general',
			manualInstructions: '',
			includeMindmap: false,
			includeMemorableQuotes: false,
		})),
		getTemperature: vi.fn(() => 0.3),
		getRequestTimeoutMs: vi.fn(() => 300000),
	} as unknown as PluginSettings;
}

function makeApp() {
	const contents = new Map<string, string>();
	const files = new Map<string, any>();
	const folders = new Set<string>();
	const fileForPath = (path: string) => ({
		path,
		extension: path.split('.').pop() ?? 'md',
		parent: { path: path.includes('/') ? path.split('/').slice(0, -1).join('/') : '' },
	});

	const app = {
		vault: {
			getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? (folders.has(path) ? { path } : null)),
			createFolder: vi.fn(async (path: string) => { folders.add(path); }),
			create: vi.fn(async (path: string, content: string) => {
				const file = fileForPath(path);
				files.set(path, file);
				contents.set(path, content);
				return file;
			}),
			process: vi.fn(async (file: { path: string }, fn: (data: string) => string) => {
				contents.set(file.path, fn(contents.get(file.path) ?? ''));
			}),
			cachedRead: vi.fn(async (file: { path: string }) => contents.get(file.path) ?? ''),
		},
		fileManager: {
			trashFile: vi.fn(async (file: { path: string }) => {
				files.delete(file.path);
				contents.delete(file.path);
			}),
			renameFile: vi.fn(async (file: { path: string }, nextPath: string) => {
				const content = contents.get(file.path) ?? '';
				files.delete(file.path);
				contents.delete(file.path);
				file.path = nextPath;
				files.set(nextPath, file);
				contents.set(nextPath, content);
			}),
		},
	};

	return { app: app as any, contents };
}

function makeRun(url: string, options: GenerationOptions, kind: QueuedRun['kind'] = 'video'): QueuedRun {
	return {
		id: `run-${kind}`,
		batchId: 'batch-1',
		ordinal: 1,
		url,
		kind,
		displayTitle: kind === 'playlist' ? 'Metadata Playlist' : 'Captionless Video',
		titleResolved: true,
		options,
		initialTargetRef: null,
		status: 'queued',
		enqueuedAt: Date.now(),
	};
}

function metadataOptions(extra: GenerationOptions = {}): GenerationOptions {
	return {
		useAi: false,
		generateAiSummary: false,
		includeMindmap: false,
		includeMemorableQuotes: false,
		transcriptMode: 'none',
		playlistMode: 'per-video',
		noteDestinationMode: 'folder',
		noteDestinationFolder: 'Notes',
		useVideoTitleAsNoteName: true,
		includeFrontmatter: true,
		...extra,
	};
}

describe('GenerationService metadata-only runs', () => {
	let consoleError: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		consoleError.mockRestore();
	});

	it('creates a captionless single video note from metadata without fetching captions', async () => {
		const { app, contents } = makeApp();
		const youtubeService = {
			fetchVideoMetadata: vi.fn(async (url: string) => makeTranscript(url)),
			fetchTranscript: vi.fn(),
		};
		const service = new GenerationService(app, youtubeService as any, makeSettings(), vi.fn());

		const entry = await service.executeRun(makeRun(VIDEO_URL, metadataOptions()), new AbortController().signal);

		expect(entry.kind).toBe('video');
		if (entry.kind !== 'video') throw new Error('Expected video report entry');
		expect(entry.outcome).toBe('completed');
		expect(entry.transcriptLanguageCode).toBeUndefined();
		expect(youtubeService.fetchVideoMetadata).toHaveBeenCalledWith(VIDEO_URL);
		expect(youtubeService.fetchTranscript).not.toHaveBeenCalled();
		const content = Array.from(contents.values()).join('\n');
		expect(content).toContain('# Captionless Video');
		expect(content).toContain('source: youtube');
		expect(content).toContain('videoDescription: "Metadata description."');
		expect(content).toContain('> [!info] Source Info');
		expect(content).not.toContain('> [!note]- Transcript');
	});

	it('creates per-video playlist notes from metadata without captions', async () => {
		const { app } = makeApp();
		const playlist = makePlaylist();
		const youtubeService = {
			fetchPlaylist: vi.fn(async () => playlist),
			fetchVideoMetadata: vi.fn(async (url: string) => makeTranscript(url, { title: `Metadata ${url.slice(-1)}` })),
			fetchTranscript: vi.fn(),
		};
		const service = new GenerationService(app, youtubeService as any, makeSettings(), vi.fn());

		const entry = await service.executeRun(makeRun(PLAYLIST_URL, metadataOptions(), 'playlist'), new AbortController().signal);

		expect(entry.kind).toBe('playlist');
		if (entry.kind !== 'playlist') throw new Error('Expected playlist report entry');
		expect(entry.entries).toHaveLength(2);
		expect(entry.entries.every((item) => item.outcome === 'completed')).toBe(true);
		expect(entry.entries.every((item) => item.transcriptLanguageCode === undefined)).toBe(true);
		expect(youtubeService.fetchVideoMetadata).toHaveBeenCalledTimes(2);
		expect(youtubeService.fetchTranscript).not.toHaveBeenCalled();
	});

	it('creates combined metadata-only playlist notes without per-video caption or metadata fetches', async () => {
		const { app, contents } = makeApp();
		const playlist = makePlaylist();
		const youtubeService = {
			fetchPlaylist: vi.fn(async () => playlist),
			fetchVideoMetadata: vi.fn(),
			fetchTranscript: vi.fn(),
		};
		const service = new GenerationService(app, youtubeService as any, makeSettings(), vi.fn());

		const entry = await service.executeRun(
			makeRun(PLAYLIST_URL, metadataOptions({ playlistMode: 'combined' }), 'playlist'),
			new AbortController().signal,
		);

		expect(entry.kind).toBe('playlist');
		if (entry.kind !== 'playlist') throw new Error('Expected playlist report entry');
		expect(entry.outcome).toBe('completed');
		expect(entry.notePath).toBeDefined();
		expect(entry.entries).toHaveLength(2);
		expect(entry.entries.every((item) => item.outcome === 'completed')).toBe(true);
		expect(entry.entries.every((item) => item.notePath === entry.notePath)).toBe(true);
		expect(youtubeService.fetchVideoMetadata).not.toHaveBeenCalled();
		expect(youtubeService.fetchTranscript).not.toHaveBeenCalled();
		const content = Array.from(contents.values()).join('\n');
		expect(content).toContain('# Metadata Playlist');
		expect(content).toContain('videoCount: 2');
		expect(content).toContain('1. [Playlist Video 1](https://www.youtube.com/watch?v=video000001&list=PL123)');
		expect(content).not.toContain('Playlist transcripts');
	});

	it('still rejects combined transcript-only playlist runs', async () => {
		const { app } = makeApp();
		const youtubeService = {
			fetchPlaylist: vi.fn(),
			fetchVideoMetadata: vi.fn(),
			fetchTranscript: vi.fn(),
		};
		const service = new GenerationService(app, youtubeService as any, makeSettings(), vi.fn());

		await expect(service.executeRun(
			makeRun(PLAYLIST_URL, metadataOptions({ transcriptMode: 'readable', playlistMode: 'combined' }), 'playlist'),
			new AbortController().signal,
		)).rejects.toThrow('Combined playlist notes require AI summary generation unless AI and transcript are both off');
		expect(youtubeService.fetchPlaylist).not.toHaveBeenCalled();
	});

	it('still rejects combined add-ons-only playlist runs', async () => {
		const { app } = makeApp();
		const youtubeService = {
			fetchPlaylist: vi.fn(),
			fetchVideoMetadata: vi.fn(),
			fetchTranscript: vi.fn(),
		};
		const service = new GenerationService(app, youtubeService as any, makeSettings(), vi.fn());

		await expect(service.executeRun(
			makeRun(PLAYLIST_URL, metadataOptions({
				useAi: true,
				generateAiSummary: false,
				includeMindmap: true,
				transcriptMode: 'none',
				playlistMode: 'combined',
			}), 'playlist'),
			new AbortController().signal,
		)).rejects.toThrow('Combined playlist notes require AI summary generation unless AI and transcript are both off');
		expect(youtubeService.fetchPlaylist).not.toHaveBeenCalled();
	});
});
