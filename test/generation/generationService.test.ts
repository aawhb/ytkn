import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const providerMocks = vi.hoisted(() => ({
	summarizeVideo: vi.fn(),
}));

vi.mock('obsidian', async () => {
	const mod = await import('../mocks/obsidian');
	return { ...mod, TFile: class TFile { } };
});

vi.mock('../../src/ai/providers/factory', () => ({
	createProvider: vi.fn(() => ({
		summarizeVideo: providerMocks.summarizeVideo,
	})),
}));

import { GenerationService } from '../../src/generation/generationService';
import type { ChannelResponse, GenerationOptions, ModelConfig, PlaylistResponse, PluginSettings, TranscriptResponse } from '../../src/types';
import type { QueuedRun } from '../../src/queue/runQueueService';

const VIDEO_URL = 'https://www.youtube.com/watch?v=abcdefghijk';
const SHORT_URL = 'https://www.youtube.com/shorts/abcdefghijk';
const PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PL123';
const CHANNEL_URL = 'https://www.youtube.com/@channel';

const sampleModel: ModelConfig = {
	name: 'local-model',
	displayName: 'Local Model',
	provider: { name: 'Ollama', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
};

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

function makePlaylist(entries: PlaylistResponse['entries'] = [
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

function makeChannel(): ChannelResponse {
	return {
		url: CHANNEL_URL,
		channelId: 'UC123',
		title: 'Metadata Channel',
		contentTypes: ['videos', 'shorts'],
		entries: [
			{ videoId: 'video000001', url: 'https://www.youtube.com/watch?v=video000001', position: 1, title: 'Channel Video', contentType: 'videos' },
			{ videoId: 'short000001', url: 'https://www.youtube.com/watch?v=short000001', position: 2, title: 'Channel Short', contentType: 'shorts' },
		],
	};
}

function makeSettings(): PluginSettings {
	return {
		getModels: vi.fn(() => []),
		getModelIds: vi.fn(() => []),
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

function makeAiSettings(): PluginSettings {
	return {
		getModels: vi.fn(() => [sampleModel]),
		getModelIds: vi.fn(() => ['Ollama:local-model']),
		getOutputDefaults: vi.fn(() => ({ useAi: true, generateAiSummary: false, tldrCalloutAtTop: true })),
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
	const openFile = vi.fn(async () => undefined);
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
		workspace: {
			openFile,
			getLeaf: vi.fn(() => ({ openFile })),
		},
	};

	return { app: app as any, contents };
}

function makeRun(url: string, options: GenerationOptions, kind: QueuedRun['kind'] = 'video', batchId = 'batch-1'): QueuedRun {
	return {
		id: `run-${kind}`,
		batchId,
		ordinal: 1,
		url,
		kind,
		displayTitle: kind === 'playlist' ? 'Metadata Playlist' : 'Captionless Video',
		options,
		initialTargetRef: null,
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
		providerMocks.summarizeVideo.mockReset();
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

	it('creates a first-class combined channel note from the selected content types', async () => {
		const { app, contents } = makeApp();
		const channel = makeChannel();
		const youtubeService = {
			fetchChannel: vi.fn(async () => channel),
		};
		const service = new GenerationService(app, youtubeService as any, makeSettings(), vi.fn());

		const entry = await service.executeRun(makeRun(CHANNEL_URL, metadataOptions({
			playlistMode: 'combined',
			channelContentTypes: ['videos', 'shorts'],
			channelVideoLimit: 10,
		}), 'channel' as never), new AbortController().signal);

		expect(youtubeService.fetchChannel).toHaveBeenCalledWith(CHANNEL_URL, {
			contentTypes: ['videos', 'shorts'],
			videoLimit: 10,
		});
		expect(entry.kind).toBe('channel');
		if (entry.kind !== 'channel') throw new Error('Expected channel report entry');
		expect(entry.channelTitle).toBe('Metadata Channel');
		expect(entry.entries).toHaveLength(2);
		expect(entry.entries.map((item) => item.contentType)).toEqual(['videos', 'shorts']);
		const content = Array.from(contents.values()).join('\n');
		expect(content).toContain('source: youtube-channel');
		expect(content).toContain(`channelUrl: "${CHANNEL_URL}"`);
		expect(content).not.toContain('playlistId:');
	});

	it('marks a directly submitted Shorts URL in the run report entry', async () => {
		const { app } = makeApp();
		const youtubeService = {
			fetchVideoMetadata: vi.fn(async () => makeTranscript(SHORT_URL)),
			fetchTranscript: vi.fn(),
		};
		const service = new GenerationService(app, youtubeService as any, makeSettings(), vi.fn());

		const entry = await service.executeRun(makeRun(SHORT_URL, metadataOptions(), 'video'), new AbortController().signal);

		expect(entry.kind).toBe('video');
		if (entry.kind !== 'video') throw new Error('Expected video report entry');
		expect(entry.contentType).toBe('shorts');
	});

	it('creates combined metadata-only playlist notes without per-video caption or metadata fetches', async () => {
		const { app, contents } = makeApp();
		const playlist = makePlaylist([
			{
				videoId: 'video000001',
				url: 'https://www.youtube.com/watch?v=video000001&list=PL123',
				position: 1,
				title: 'Playlist Video 1',
				author: 'Playlist Channel',
				channelUrl: 'https://www.youtube.com/@playlist-channel',
			},
			{ videoId: 'video000002', url: 'https://www.youtube.com/watch?v=video000002&list=PL123', position: 2, title: 'Playlist Video 2' },
		]);
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
		expect(content).toContain('![Metadata Playlist](https://www.youtube.com/watch?v=video000001&list=PL123)');
		expect(content).toContain('videoCount: 2');
		expect(content).toContain('1. [Playlist Video 1](https://www.youtube.com/watch?v=video000001&list=PL123) - [Playlist Channel](https://www.youtube.com/@playlist-channel)');
		expect(content).toContain('2. [Playlist Video 2](https://www.youtube.com/watch?v=video000002&list=PL123)');
		expect(content).not.toContain(' - Playlist Channel');
		expect(content).not.toContain('Playlist transcripts');
	});

	it('creates combined transcript-only playlist notes without AI', async () => {
		const { app, contents } = makeApp();
		const playlist = makePlaylist();
		const youtubeService = {
			fetchPlaylist: vi.fn(async () => playlist),
			fetchVideoMetadata: vi.fn(),
			fetchTranscript: vi.fn(async (url: string) => ({
				transcript: makeTranscript(url, {
					title: `Transcript ${new URL(url).searchParams.get('v')}`,
					lines: [{ text: `Transcript text for ${new URL(url).searchParams.get('v')} with <unk>* [Music].`, offset: 0 }],
				}),
				languageCode: 'en',
			})),
		};
		const service = new GenerationService(app, youtubeService as any, makeSettings(), vi.fn());

		const entry = await service.executeRun(
			makeRun(PLAYLIST_URL, metadataOptions({ transcriptMode: 'readable', playlistMode: 'combined' }), 'playlist'),
			new AbortController().signal,
		);

		expect(entry.kind).toBe('playlist');
		if (entry.kind !== 'playlist') throw new Error('Expected playlist report entry');
		expect(entry.outcome).toBe('completed');
		expect(entry.notePath).toBeDefined();
		expect(entry.entries).toHaveLength(2);
		expect(entry.entries.every((item) => item.outcome === 'completed')).toBe(true);
		expect(entry.entries.every((item) => item.notePath === entry.notePath)).toBe(true);
		expect(youtubeService.fetchTranscript).toHaveBeenCalledTimes(2);
		expect(youtubeService.fetchVideoMetadata).not.toHaveBeenCalled();
		expect(providerMocks.summarizeVideo).not.toHaveBeenCalled();
		const content = Array.from(contents.values()).join('\n');
		expect(content).toContain('# Metadata Playlist');
		expect(content).toContain('1. [Transcript video000001](https://www.youtube.com/watch?v=video000001&list=PL123) - [Metadata Channel](https://www.youtube.com/channel/UC123)');
		expect(content).toContain('> [!note]- Playlist transcripts');
		expect(content).toContain('> **1. Transcript video000001**');
		expect(content).toContain('> Transcript text for video000001 with &lt;unk&gt;\\* \\[Music\\].');
		expect(content).toContain('> **2. Transcript video000002**');
		expect(content).toContain('> Transcript text for video000002 with &lt;unk&gt;\\* \\[Music\\].');
		expect(content).not.toContain('<unk>* [Music]');
		expect(content).not.toContain('## Summary');
	});

	it('skips missing transcripts in combined transcript-only playlist notes', async () => {
		const { app, contents } = makeApp();
		const playlist = makePlaylist();
		const youtubeService = {
			fetchPlaylist: vi.fn(async () => playlist),
			fetchVideoMetadata: vi.fn(),
			fetchTranscript: vi.fn(async (url: string) => {
				if (url.includes('video000001')) {
					throw new Error('Failed to fetch transcript: unavailable');
				}
				return {
					transcript: makeTranscript(url, {
						title: 'Transcript video000002',
						lines: [{ text: 'Second transcript text.', offset: 0 }],
					}),
					languageCode: 'en',
				};
			}),
		};
		const service = new GenerationService(app, youtubeService as any, makeSettings(), vi.fn());

		const entry = await service.executeRun(
			makeRun(PLAYLIST_URL, metadataOptions({ transcriptMode: 'readable', playlistMode: 'combined' }), 'playlist'),
			new AbortController().signal,
		);

		expect(entry.kind).toBe('playlist');
		if (entry.kind !== 'playlist') throw new Error('Expected playlist report entry');
		expect(entry.outcome).toBe('completed');
		expect(entry.entries.map((item) => item.outcome)).toEqual(['skipped', 'completed']);
		expect(entry.entries[0].notePath).toBeUndefined();
		expect(entry.entries[1].notePath).toBe(entry.notePath);
		expect(providerMocks.summarizeVideo).not.toHaveBeenCalled();
		const content = Array.from(contents.values()).join('\n');
		expect(content).toContain('> [!note]- Playlist transcripts');
		expect(content).toContain('> **1. Transcript video000002**');
		expect(content).toContain('> Second transcript text.');
		expect(content).not.toContain('video000001');
	});

	it('creates a TL;DR-only single video note with AI summary disabled', async () => {
		providerMocks.summarizeVideo.mockResolvedValue('## TL;DR\nA short grounded takeaway.');
		const { app, contents } = makeApp();
		const youtubeService = {
			fetchVideoMetadata: vi.fn(),
			fetchTranscript: vi.fn(async (url: string) => ({
				transcript: makeTranscript(url, { title: 'TLDR Video', lines: [{ text: 'Grounded transcript.', offset: 0 }] }),
				languageCode: 'en',
			})),
		};
		const service = new GenerationService(app, youtubeService as any, makeAiSettings(), vi.fn());

		const entry = await service.executeRun(
			makeRun(VIDEO_URL, metadataOptions({
				useAi: true,
				generateAiSummary: false,
				tldrCalloutAtTop: true,
				modelIds: ['Ollama:local-model'],
			})),
			new AbortController().signal,
		);

		expect(entry.kind).toBe('video');
		expect(providerMocks.summarizeVideo).toHaveBeenCalledOnce();
		const prompt = providerMocks.summarizeVideo.mock.calls[0]?.[0] as string;
		expect(prompt).toContain('Add a TL;DR section');
		expect(prompt).not.toContain('Use exactly these H2 headings');
		const content = Array.from(contents.values()).join('\n');
		expect(content).toContain('> [!summary] TL;DR');
		expect(content).toContain('> A short grounded takeaway.');
		expect(content).not.toContain('## Summary');
	});

	it('creates per-video playlist notes with TL;DR-only AI output', async () => {
		providerMocks.summarizeVideo.mockResolvedValue('## TL;DR\nPlaylist video takeaway.');
		const { app, contents } = makeApp();
		const playlist = makePlaylist();
		const youtubeService = {
			fetchPlaylist: vi.fn(async () => playlist),
			fetchVideoMetadata: vi.fn(),
			fetchTranscript: vi.fn(async (url: string) => ({
				transcript: makeTranscript(url, { title: `Video ${url.slice(-1)}`, lines: [{ text: 'Grounded transcript.', offset: 0 }] }),
				languageCode: 'en',
			})),
		};
		const service = new GenerationService(app, youtubeService as any, makeAiSettings(), vi.fn());

		const entry = await service.executeRun(
			makeRun(PLAYLIST_URL, metadataOptions({
				useAi: true,
				generateAiSummary: false,
				tldrCalloutAtTop: true,
				modelIds: ['Ollama:local-model'],
				playlistMode: 'per-video',
			}), 'playlist'),
			new AbortController().signal,
		);

		expect(entry.kind).toBe('playlist');
		expect(providerMocks.summarizeVideo).toHaveBeenCalledTimes(2);
		expect(youtubeService.fetchTranscript).toHaveBeenCalledTimes(2);
		const content = Array.from(contents.values()).join('\n');
		expect(content.match(/> \[!summary\] TL;DR/g)).toHaveLength(2);
		expect(content).toContain('> Playlist video takeaway.');
	});

	it('creates combined add-ons-only playlist notes', async () => {
		providerMocks.summarizeVideo.mockImplementation(async (prompt: string) => {
			if (prompt.includes('Per-video add-on notes')) {
				return '## TL;DR\nCombined playlist takeaway.\n\n## Mindmap\n```mermaid\nmindmap\n  root((Playlist))\n```';
			}
			return '## TL;DR\nPer-video takeaway.\n\n## Mindmap\n```mermaid\nmindmap\n  root((Video))\n```';
		});
		const playlist = makePlaylist();
		const youtubeService = {
			fetchPlaylist: vi.fn(async () => playlist),
			fetchVideoMetadata: vi.fn(),
			fetchTranscript: vi.fn(async (url: string) => ({
				transcript: makeTranscript(url, { title: `Video ${url.slice(-1)}`, lines: [{ text: 'Grounded transcript.', offset: 0 }] }),
				languageCode: 'en',
			})),
		};
		const appAndContents = makeApp();
		const service = new GenerationService(appAndContents.app, youtubeService as any, makeAiSettings(), vi.fn());

		const entry = await service.executeRun(
			makeRun(PLAYLIST_URL, metadataOptions({
				useAi: true,
				generateAiSummary: false,
				tldrCalloutAtTop: true,
				includeMindmap: true,
				transcriptMode: 'none',
				playlistMode: 'combined',
				modelIds: ['Ollama:local-model'],
			}), 'playlist'),
			new AbortController().signal,
		);

		expect(entry.kind).toBe('playlist');
		expect(entry.outcome).toBe('completed');
		expect(providerMocks.summarizeVideo).toHaveBeenCalledTimes(3);
		expect(youtubeService.fetchTranscript).toHaveBeenCalledTimes(2);
		const finalPrompt = providerMocks.summarizeVideo.mock.calls[2]?.[0] as string;
		expect(finalPrompt).toContain('produce the requested add-on sections for the playlist as a whole');
		const content = Array.from(appAndContents.contents.values()).join('\n');
		expect(content).toContain('> [!summary] TL;DR');
		expect(content).toContain('> Combined playlist takeaway.');
		expect(content).toContain('## Mindmap');
	});

	it('propagates combined playlist rendering warnings to the playlist report', async () => {
		providerMocks.summarizeVideo.mockImplementation(async (prompt: string) => {
			if (prompt.includes('Per-video add-on notes')) {
				return '## TL;DR\nCombined playlist takeaway.';
			}
			return '## TL;DR\nPer-video takeaway.';
		});
		const playlist = makePlaylist();
		const youtubeService = {
			fetchPlaylist: vi.fn(async () => playlist),
			fetchVideoMetadata: vi.fn(),
			fetchTranscript: vi.fn(async (url: string) => ({
				transcript: makeTranscript(url, { lines: [{ text: 'Grounded transcript.', offset: 0 }] }),
				languageCode: 'en',
			})),
		};
		const { app } = makeApp();
		const service = new GenerationService(app, youtubeService as any, makeAiSettings(), vi.fn());

		const entry = await service.executeRun(
			makeRun(PLAYLIST_URL, metadataOptions({
				useAi: true,
				generateAiSummary: false,
				tldrCalloutAtTop: true,
				includeMindmap: true,
				transcriptMode: 'none',
				playlistMode: 'combined',
				modelIds: ['Ollama:local-model'],
			}), 'playlist'),
			new AbortController().signal,
		);

		expect(entry.kind).toBe('playlist');
		if (entry.kind !== 'playlist') throw new Error('Expected playlist report entry');
		expect(entry.warnings).toContain('Requested section "Mindmap" was not emitted by the model.');
	});
});

describe('GenerationService open created note', () => {
	let consoleError: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		consoleError.mockRestore();
	});

	function makeVideoService() {
		const { app } = makeApp();
		const youtubeService = {
			fetchVideoMetadata: vi.fn(async (url: string) => makeTranscript(url)),
			fetchTranscript: vi.fn(),
		};
		const service = new GenerationService(app, youtubeService as any, makeSettings(), vi.fn());
		return { app, service };
	}

	it('opens only the first created note of a batch in a new tab', async () => {
		const { app, service } = makeVideoService();
		const options = metadataOptions({ openCreatedNote: true });

		await service.executeRun(makeRun(VIDEO_URL, options), new AbortController().signal);
		await service.executeRun(makeRun(VIDEO_URL, options), new AbortController().signal);

		expect(app.workspace.getLeaf).toHaveBeenCalledTimes(1);
		expect(app.workspace.getLeaf).toHaveBeenCalledWith('tab');
		expect(app.workspace.openFile).toHaveBeenCalledTimes(1);
		expect(app.workspace.openFile).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringContaining('Notes/') }));
	});

	it('opens the first note of each distinct batch', async () => {
		const { app, service } = makeVideoService();
		const options = metadataOptions({ openCreatedNote: true });

		await service.executeRun(makeRun(VIDEO_URL, options, 'video', 'batch-1'), new AbortController().signal);
		await service.executeRun(makeRun(VIDEO_URL, options, 'video', 'batch-2'), new AbortController().signal);

		expect(app.workspace.openFile).toHaveBeenCalledTimes(2);
	});

	it('does not open notes when the option is off', async () => {
		const { app, service } = makeVideoService();

		await service.executeRun(makeRun(VIDEO_URL, metadataOptions()), new AbortController().signal);

		expect(app.workspace.openFile).not.toHaveBeenCalled();
	});

	it('forgets a batch once it is finalized, even with reports disabled', async () => {
		const { app, service } = makeVideoService();
		const options = metadataOptions({ openCreatedNote: true });

		await service.executeRun(makeRun(VIDEO_URL, options), new AbortController().signal);
		service.onBatchFinalized(
			{ batchId: 'batch-1', reportPolicy: { include: false, location: 'generated-note' }, runIds: [], outcomeEntries: [], finalized: true },
		);
		await service.executeRun(makeRun(VIDEO_URL, options), new AbortController().signal);

		expect(app.workspace.openFile).toHaveBeenCalledTimes(2);
	});

	it('opens the first completed entry of a per-video playlist once', async () => {
		const { app } = makeApp();
		const youtubeService = {
			fetchPlaylist: vi.fn(async () => makePlaylist()),
			fetchVideoMetadata: vi.fn(async (url: string) => makeTranscript(url, { title: url })),
			fetchTranscript: vi.fn(),
		};
		const service = new GenerationService(app, youtubeService as any, makeSettings(), vi.fn());

		await service.executeRun(
			makeRun(PLAYLIST_URL, metadataOptions({ openCreatedNote: true }), 'playlist'),
			new AbortController().signal,
		);

		expect(app.workspace.openFile).toHaveBeenCalledTimes(1);
	});
});
