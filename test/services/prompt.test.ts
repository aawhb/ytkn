import { describe, expect, it } from 'vitest';
import { PromptService } from '../../src/services/prompt';
import {
	findTemplateChoice,
	listTemplateChoices,
	populateTemplateDropdown,
} from '../../src/services/templates';

const transcript = {
	url: 'https://youtube.com/watch?v=123',
	videoId: '123',
	title: 'Video',
	author: 'Author',
	channelUrl: 'https://youtube.com/channel/abc',
	lines: [{ text: 'Hello world', offset: 0 }],
};

describe('PromptService', () => {
	it('builds template prompts with shared rules and metadata', () => {
		const service = new PromptService({ mode: 'template', template: 'implementation', manualInstructions: '', includeMindmap: false, includeMemorableQuotes: false });
		const prompt = service.buildPrompt(transcript, 'https://youtube.com/watch?v=123');

		expect(prompt).toContain("You transform a YouTube video's transcript into a structured Markdown body for an Obsidian note.");
		expect(prompt).toContain('Hard rules');
		expect(prompt).toContain('Produce an implementation-focused note for a reader who wants to act on what the source shows — write the steps, code, tools, and action items needed.');
		expect(prompt).toContain('## TL;DR');
		expect(prompt).toContain('Do not output a `## Source` section');
		expect(prompt).toContain('- Title: Video');
		expect(prompt).toContain('- Channel: Author');
		expect(prompt).toContain('Transcript:\nHello world');

		const chunkPrompt = service.buildChunkPrompt(transcript, 'https://youtube.com/watch?v=123', 'Chunk text', 1, 2);
		expect(chunkPrompt).toContain('chunk 1 of 2');
		expect(chunkPrompt).toContain('## Chunk Takeaways');
		expect(chunkPrompt).toContain('Transcript chunk:\nChunk text');

		const synthesisPrompt = service.buildSynthesisPrompt(transcript, 'https://youtube.com/watch?v=123', ['First summary', 'Second summary']);
		expect(synthesisPrompt).toContain('Use the chunk summaries below instead of the raw transcript');
		expect(synthesisPrompt).toContain('### Chunk 1\nFirst summary');
		expect(synthesisPrompt).toContain('### Chunk 2\nSecond summary');
	});

	it('uses manual instructions without prepending built-in templates', () => {
		const service = new PromptService({
			mode: 'manual',
			template: 'implementation',
			manualInstructions: 'Write a compact note with exactly three bullets.',
			includeMindmap: false,
			includeMemorableQuotes: false,
		});

		const prompt = service.buildPrompt(transcript, transcript.url);

		expect(prompt).toContain('Write a compact note with exactly three bullets.');
		expect(prompt).not.toContain('Produce an implementation-focused note for a reader who wants to act on what the source shows — write the steps, code, tools, and action items needed.');
		expect(prompt).not.toContain("You transform a YouTube video's transcript into a structured Markdown body for an Obsidian note.");
	});

	it('omits TL;DR from full-summary prompts when the callout is disabled', () => {
		const service = new PromptService({
			mode: 'template',
			template: 'general',
			manualInstructions: '',
			includeMindmap: false,
			includeMemorableQuotes: false,
		}, { includeTldr: false });

		const prompt = service.buildPrompt(transcript, transcript.url);

		expect(prompt).toContain('Do not output a `## TL;DR` section.');
		expect(prompt).not.toContain('1-2 sentences capturing the single most important takeaway.');
		expect(prompt).not.toContain('`## TL;DR` (required)');
	});

	it('adapts template instructions for playlist synthesis', () => {
		const service = new PromptService({ mode: 'template', template: 'study', manualInstructions: '', includeMindmap: false, includeMemorableQuotes: false });
		const playlistPrompt = service.buildPlaylistSynthesisPrompt(
			{
				playlistId: 'abc',
				title: 'Playlist',
				url: 'https://youtube.com/playlist?list=abc',
				entries: [{ videoId: '123', url: transcript.url, title: transcript.title, position: 1 }],
				transcripts: [transcript],
			},
			[{ transcript, summary: 'Summary text' }],
		);

		expect(playlistPrompt).toContain('Apply the same template to the playlist as a whole');
		expect(playlistPrompt).toContain('## Video 1: Video');
		expect(playlistPrompt).toContain('Summary text');
	});

	it('lists the new template set and keeps the TL;DR contract on every built-in template', () => {
		const choices = listTemplateChoices();

		expect(choices).toHaveLength(6);
		expect(choices.map((choice) => choice.id).sort()).toEqual([
			'deep-dive',
			'full-extract',
			'general',
			'implementation',
			'research',
			'study',
		]);

		for (const choice of choices) {
			const prompt = new PromptService({
				mode: 'template',
				template: choice.id,
				manualInstructions: '',
				includeMindmap: false,
				includeMemorableQuotes: false,
			}).buildPrompt(
				transcript,
				transcript.url,
			);

			expect(prompt).toContain('## TL;DR');
			expect(prompt).toContain('Do not output a `## Source` section');
		}
	});

	it('can add a Mermaid mindmap independently of the selected template or manual mode', () => {
		const mindmapService = new PromptService({
			mode: 'template',
			template: 'general',
			manualInstructions: '',
			includeMindmap: true,
			includeMemorableQuotes: false,
		});
		const templatePrompt = mindmapService.buildPrompt(transcript, transcript.url);
		const manualPrompt = new PromptService({
			mode: 'manual',
			template: 'general',
			manualInstructions: 'Write a concise note.',
			includeMindmap: true,
			includeMemorableQuotes: false,
		}).buildPrompt(transcript, transcript.url);
		const chunkPrompt = mindmapService.buildChunkPrompt(transcript, transcript.url, 'Chunk text', 1, 2);

		expect(templatePrompt).toContain('## Mindmap');
		expect(templatePrompt).toContain('```mermaid');
		expect(templatePrompt).toContain('mindmap');
		expect(templatePrompt).toContain('Section heading must be exactly `## Mindmap`.');
		expect(manualPrompt).toContain('Write a concise note.');
		expect(manualPrompt).toContain('## Mindmap');
		expect(chunkPrompt).not.toContain('## Mindmap');
	});

	it('can add memorable quotes independently of the selected template or manual mode', () => {
		const quotesService = new PromptService({
			mode: 'template',
			template: 'general',
			manualInstructions: '',
			includeMindmap: false,
			includeMemorableQuotes: true,
		});
		const templatePrompt = quotesService.buildPrompt(transcript, transcript.url);
		const manualPrompt = new PromptService({
			mode: 'manual',
			template: 'general',
			manualInstructions: 'Write a concise note.',
			includeMindmap: false,
			includeMemorableQuotes: true,
		}).buildPrompt(transcript, transcript.url);
		const chunkPrompt = quotesService.buildChunkPrompt(transcript, transcript.url, 'Chunk text', 1, 2);
		const noQuotesPrompt = new PromptService({
			mode: 'template',
			template: 'general',
			manualInstructions: '',
			includeMindmap: false,
			includeMemorableQuotes: false,
		}).buildPrompt(transcript, transcript.url);

		expect(templatePrompt).toContain('## Memorable quotes');
		expect(templatePrompt).toContain('> [!quote]');
		expect(templatePrompt).toContain('The section heading must be exactly `## Memorable quotes`.');
		expect(templatePrompt).toContain('Separate consecutive quote callouts with a blank line.');
		expect(templatePrompt).toContain('Each quote must be its own callout block.');
		expect(manualPrompt).toContain('Write a concise note.');
		expect(manualPrompt).toContain('## Memorable quotes');
		expect(chunkPrompt).not.toContain('## Memorable quotes');
		expect(noQuotesPrompt).not.toContain('## Memorable quotes');
	});

	it('builds add-ons-only prompts without template section contracts', () => {
		const service = new PromptService({
			mode: 'template',
			template: 'general',
			manualInstructions: '',
			includeMindmap: true,
			includeMemorableQuotes: true,
		});

		const prompt = service.buildAddonsPrompt(transcript, transcript.url);
		const chunkPrompt = service.buildAddonsChunkPrompt(transcript, transcript.url, 'Chunk text', 1, 2);
		const synthesisPrompt = service.buildAddonsSynthesisPrompt(transcript, transcript.url, ['Chunk notes']);

		expect(prompt).toContain('only the requested add-on sections');
		expect(prompt).toContain('## TL;DR');
		expect(prompt).toContain('## Mindmap');
		expect(prompt).toContain('## Memorable quotes');
		expect(prompt).not.toContain('Always start with');
		expect(prompt).not.toContain('## Key takeaways');
		expect(prompt).not.toContain('Use exactly these H2 headings');
		expect(chunkPrompt).toContain('## Add-on source material');
		expect(synthesisPrompt).toContain('Use the chunk notes below instead of the raw transcript');
	});

	it('can request TL;DR as the only add-on section', () => {
		const service = new PromptService({
			mode: 'template',
			template: 'general',
			manualInstructions: '',
			includeMindmap: false,
			includeMemorableQuotes: false,
		}, { includeTldr: true });

		const prompt = service.buildAddonsPrompt(transcript, transcript.url);

		expect(prompt).toContain('Add a TL;DR section before any other generated section');
		expect(prompt).toContain('## TL;DR');
		expect(prompt).not.toContain('## Mindmap');
		expect(prompt).not.toContain('## Memorable quotes');
	});

	it('builds combined playlist add-ons synthesis prompts', () => {
		const service = new PromptService({
			mode: 'template',
			template: 'general',
			manualInstructions: '',
			includeMindmap: true,
			includeMemorableQuotes: false,
		}, { includeTldr: true });

		const prompt = service.buildPlaylistAddonsSynthesisPrompt(
			{
				playlistId: 'abc',
				title: 'Playlist',
				url: 'https://youtube.com/playlist?list=abc',
				entries: [{ videoId: '123', url: transcript.url, title: transcript.title, position: 1 }],
				transcripts: [transcript],
			},
			[{ transcript, summary: '## TL;DR\nVideo point.\n\n## Mindmap\n```mermaid\nmindmap\n  root((Video))\n```' }],
		);

		expect(prompt).toContain('produce the requested add-on sections for the playlist as a whole');
		expect(prompt).toContain('## TL;DR');
		expect(prompt).toContain('## Mindmap');
		expect(prompt).toContain('## Video 1: Video');
		expect(prompt).toContain('Video point.');
	});

	it('splits long transcripts into chunks without dropping text', () => {
		const service = new PromptService({ mode: 'template', template: 'implementation', manualInstructions: '', includeMindmap: false, includeMemorableQuotes: false });
		const chunks = service.splitTranscript(
			{
				...transcript,
				lines: [
					{ text: 'alpha beta gamma '.repeat(120).trim(), offset: 0 },
					{ text: 'delta epsilon zeta '.repeat(120).trim(), offset: 1 },
					{ text: 'eta theta iota '.repeat(120).trim(), offset: 2 },
				],
			},
			'https://youtube.com/watch?v=123',
			{
				model: {
					name: 'small-model',
					displayName: 'Small Model',
					contextWindow: 3000,
					provider: { name: 'Ollama', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
				},
			},
		);

		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks.join(' ')).toContain('alpha beta gamma');
		expect(chunks.join(' ')).toContain('delta epsilon zeta');
		expect(chunks.join(' ')).toContain('eta theta iota');
	});

	it('findTemplateChoice returns the matching choice or undefined', () => {
		expect(findTemplateChoice('general')?.label).toBe('General knowledge note');
		expect(findTemplateChoice('research')?.id).toBe('research');
		expect(findTemplateChoice('does-not-exist' as never)).toBeUndefined();
	});

	it('populateTemplateDropdown emits one flat option per template in registry order', () => {
		const select = document.createElement('select');
		populateTemplateDropdown(select);

		expect(select.querySelectorAll('optgroup').length).toBe(0);

		const optionValues = Array.from(select.querySelectorAll('option')).map(
			(el) => el.getAttribute('value'),
		);
		const choices = listTemplateChoices();
		expect(optionValues).toEqual(choices.map((c) => c.id));
	});

	it('populateTemplateDropdown can be called repeatedly without duplicating options', () => {
		const select = document.createElement('select');
		populateTemplateDropdown(select);
		const firstCount = select.querySelectorAll('option').length;
		populateTemplateDropdown(select);
		expect(select.querySelectorAll('option').length).toBe(firstCount);
	});

	it('avoids chunking when the selected model has ample context', () => {
		const service = new PromptService({ mode: 'template', template: 'implementation', manualInstructions: '', includeMindmap: false, includeMemorableQuotes: false });
		const chunks = service.splitTranscript(
			{
				...transcript,
				lines: Array.from({ length: 60 }, (_, index) => ({
					text: `Line ${index} `.repeat(20).trim(),
					offset: index,
				})),
			},
			'https://youtube.com/watch?v=123',
			{
				model: {
					name: 'qwen3.5:4b',
					displayName: 'Qwen 3.5 4B',
					contextWindow: 262144,
					provider: { name: 'Ollama', type: 'openai-compatible', apiKey: '', url: 'http://localhost:11434/v1' },
				},
			},
		);

		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toContain('Line 0');
		expect(chunks[0]).toContain('Line 59');
	});
});
