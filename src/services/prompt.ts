import {
	InstructionConfig,
	ModelConfig,
	PlaylistTranscriptResponse,
	Template,
	TranscriptResponse,
} from '../types';
import {
	getTemplate,
} from './templates';
import { FALLBACK_CONTEXT_WINDOW_TOKENS } from '../defaults';

const ESTIMATED_CHARS_PER_TOKEN = 4;
const MIN_TRANSCRIPT_BUDGET_TOKENS = 1024;

const SHARED_BASE_INSTRUCTIONS = `You transform a YouTube video's transcript into a structured Markdown body for an Obsidian note. The renderer adds frontmatter, the H1 title, the source-metadata block, and an optional transcript appendix — your output is everything between them.

Hard rules — never break these:
- Use only information clearly supported by the transcript. If a detail is uncertain, omit it.
- Do not invent facts, tools, libraries, metrics, thresholds, or performance claims.
- Correct only obvious transcription errors. Otherwise leave wording faithful.
- Do not output a \`# H1\` heading. Section headings start at \`## H2\`.
- Do not output a \`## Source\` section, a \`## Transcript\` section, or long verbatim transcript excerpts. Those are added separately.
- Use Obsidian-flavored Markdown. Prefer \`> [!info]\`, \`> [!warning]\`, \`> [!quote]\`, and \`> [!summary]\` callouts when context fits. Use \`- [ ]\` for tasks.
- Omit any section that would be empty. Do not write filler like "no items mentioned" or "n/a".
- Keep bullets concise, specific, and high-signal. Do not restate the same idea twice.
- Separate core content from sponsor reads, promotional content, and filler when relevant.
- Treat each transcript as an independent source unless explicitly told otherwise.`;

const ADDON_BASE_INSTRUCTIONS = `You transform a YouTube video's transcript into requested add-on Markdown sections for an Obsidian note. The renderer adds frontmatter, the H1 title, source metadata, and any transcript appendix — your output is only the requested add-on sections.

Hard rules — never break these:
- Use only information clearly supported by the transcript. If a detail is uncertain, omit it.
- Do not invent facts, tools, libraries, metrics, thresholds, or performance claims.
- Do not output a \`# H1\` heading.
- Do not output a \`## Source\`, \`## Transcript\`, or long verbatim transcript excerpts.
- Output only the requested add-on sections, using H2 headings.
- Omit a requested section if the transcript does not contain enough grounded material for it.`;

const TLDR_SECTION_INSTRUCTIONS = `Add a TL;DR section before any other generated section:

## TL;DR
1-2 sentences (≤ 240 characters total) capturing the single most important takeaway.

TL;DR rules:
- Section heading must be exactly \`## TL;DR\`.
- Keep it grounded in the transcript.
- Do not repeat the title or source metadata.`;

const NO_TLDR_SECTION_INSTRUCTIONS = `Do not output a \`## TL;DR\` section.`;

const MINDMAP_APPENDIX_INSTRUCTIONS = `Add a Mermaid mindmap section for the key concepts. Use exactly this format — the backtick fences are required; do not replace the diagram with prose:

## Mindmap
\`\`\`mermaid
mindmap
  root((Central idea))
    Branch A
      Leaf 1
      Leaf 2
    Branch B
      Leaf 3
\`\`\`

Mindmap rules:
- Section heading must be exactly \`## Mindmap\`.
- The content must be a \`\`\`mermaid mindmap\`\`\` code block — not prose, not a description of a mindmap.
- Keep labels short: noun phrases or very short clauses.
- Capture only the main ideas, supporting branches, and notable tradeoffs from the transcript.
- Roughly 2–4 levels deep and 8–18 nodes total.
- Do not invent nodes that are not grounded in the transcript.`;

const MEMORABLE_QUOTES_APPENDIX_INSTRUCTIONS = `Add a memorable quotes section at the end of the AI output (after Mindmap if present):

## Memorable quotes
- 3–7 verbatim quotes worth preserving from this source.
- Each quote must be its own callout block. Format every quote line as:
  \`> [!quote] "..." (mm:ss)\`
- Separate consecutive quote callouts with a blank line.
- Append a \`(mm:ss)\` timestamp suffix when the timing is verifiable from the transcript.
- The section heading must be exactly \`## Memorable quotes\`.
- Omit the section entirely if fewer than 3 quote-worthy lines exist in the source.`;

const LEVEL_GUIDES: Record<string, Record<string, string>> = {
	learner_level: {
		intro: `intro — treat the reader as new to this topic:
- Explain all domain terms on first use.
- Prefer analogies to familiar concepts over technical precision.
- Self-test questions test recall ("What is X?"), not synthesis.
- Examples show the basic shape of an idea, not edge cases.`,
		intermediate: `intermediate — assume the reader knows the field's vocabulary and core concepts:
- Skip first-principles intros; reference well-known prerequisites by name only.
- Self-test questions probe synthesis ("How does X relate to Y?"), not recall.
- Examples illustrate edge cases or trade-offs, not the basic shape.`,
		advanced: `advanced — assume deep field expertise:
- Skip background entirely; assume fluency with prerequisites.
- Self-test questions demand analysis ("Why would X fail if Y changes?").
- Examples focus on subtle edge cases, pitfalls, and architectural trade-offs.`,
	},
	audience_level: {
		intro: `intro — write for someone new to this topic:
- Explain all domain terms on first use.
- Use analogies to familiar concepts.
- Keep references concrete and grounded.`,
		intermediate: `intermediate — write for someone familiar with the field:
- Assume vocabulary; skip basic definitions.
- Reference related concepts by name without explaining them.
- Balance depth with accessibility.`,
		advanced: `advanced — write for a domain expert:
- Assume full fluency; no background explanations.
- Go deep on nuances, trade-offs, and edge cases.
- Reference niche terminology freely.`,
	},
};

interface ChunkingOptions {
	model?: ModelConfig | null;
}

interface PromptRuntimeOptions {
	includeTldr?: boolean;
}

export class PromptService {
	constructor(
		private instructionConfig: InstructionConfig,
		private runtimeOptions: PromptRuntimeOptions = {},
	) { }

	buildPrompt(transcript: TranscriptResponse, videoUrl: string): string {
		const transcriptText = this.getTranscriptText(transcript);

		return `${this.buildTranscriptPromptPrefix(transcript, videoUrl)}${transcriptText}`;
	}

	buildAddonsPrompt(transcript: TranscriptResponse, videoUrl: string): string {
		const transcriptText = this.getTranscriptText(transcript);

		return `${this.buildAddonsPromptPrefix(transcript, videoUrl)}${transcriptText}`;
	}

	splitTranscript(transcript: TranscriptResponse, videoUrl: string, options: ChunkingOptions = {}): string[] {
		const transcriptText = this.getTranscriptText(transcript);
		if (!transcriptText) {
			return [];
		}

		const fullPromptBudget = this.getTranscriptBudgetTokens(
			this.buildTranscriptPromptPrefix(transcript, videoUrl),
			options.model,
		);

		if (this.estimateTokens(transcriptText) <= fullPromptBudget) {
			return [transcriptText];
		}

		const chunkPromptBudget = this.getTranscriptBudgetTokens(
			this.buildChunkPrompt(transcript, videoUrl, '', 1, 2),
			options.model,
		);

		return this.chunkTranscriptLines(transcript, Math.max(MIN_TRANSCRIPT_BUDGET_TOKENS, chunkPromptBudget));
	}

	splitTranscriptForAddons(transcript: TranscriptResponse, videoUrl: string, options: ChunkingOptions = {}): string[] {
		const transcriptText = this.getTranscriptText(transcript);
		if (!transcriptText) {
			return [];
		}

		const fullPromptBudget = this.getTranscriptBudgetTokens(
			this.buildAddonsPromptPrefix(transcript, videoUrl),
			options.model,
		);

		if (this.estimateTokens(transcriptText) <= fullPromptBudget) {
			return [transcriptText];
		}

		const chunkPromptBudget = this.getTranscriptBudgetTokens(
			this.buildAddonsChunkPrompt(transcript, videoUrl, '', 1, 2),
			options.model,
		);

		return this.chunkTranscriptLines(transcript, Math.max(MIN_TRANSCRIPT_BUDGET_TOKENS, chunkPromptBudget));
	}

	buildChunkPrompt(transcript: TranscriptResponse, videoUrl: string, chunkText: string, chunkIndex: number, totalChunks: number): string {
		return `${this.buildCommonInstructions(transcript, videoUrl, false)}

You are summarizing chunk ${chunkIndex} of ${totalChunks} from a longer transcript.
Do not write the final note yet. Extract only the facts, claims, examples, and implementation details from this chunk that matter for a later final synthesis pass.

Output structure (use Markdown):

## Chunk Takeaways
- [Short factual bullet]

## Important Details
- [Specific example, tool, tradeoff, or implementation detail from this chunk]

## Open Questions
- [Only if this chunk leaves something unresolved]

Keep the chunk output concise and factual. Do not output a \`## Source\` section.

Transcript chunk:
${chunkText}`;
	}

	buildAddonsChunkPrompt(transcript: TranscriptResponse, videoUrl: string, chunkText: string, chunkIndex: number, totalChunks: number): string {
		return `${this.buildAddonCommonInstructions(transcript, videoUrl)}

You are processing chunk ${chunkIndex} of ${totalChunks} from a longer transcript.
Do not write the final add-on sections yet. Extract only concise, grounded source material that would help create the requested add-ons later.

Output structure (use Markdown):

## Add-on source material
- [Grounded detail, concept, relationship, or quote candidate]

Transcript chunk:
${chunkText}`;
	}

	buildSynthesisPrompt(transcript: TranscriptResponse, videoUrl: string, chunkSummaries: string[]): string {
		const chunkSummaryText = chunkSummaries
			.map((summary, index) => `### Chunk ${index + 1}\n${summary.trim()}`)
			.join('\n\n');

		return `${this.buildCommonInstructions(transcript, videoUrl)}

Use the chunk summaries below instead of the raw transcript to produce the final video knowledge note. Do not mention chunks in the final answer.

Chunk summaries:
${chunkSummaryText}`;
	}

	buildAddonsSynthesisPrompt(transcript: TranscriptResponse, videoUrl: string, chunkSummaries: string[]): string {
		const chunkSummaryText = chunkSummaries
			.map((summary, index) => `### Chunk ${index + 1}\n${summary.trim()}`)
			.join('\n\n');

		return `${this.buildAddonCommonInstructions(transcript, videoUrl)}

Use the chunk notes below instead of the raw transcript to produce the requested add-on sections. Do not mention chunks in the final answer.

Chunk notes:
${chunkSummaryText}`;
	}

	buildPlaylistSynthesisPrompt(
		playlist: PlaylistTranscriptResponse,
		videoSummaries: Array<{ transcript: TranscriptResponse; summary: string }>,
	): string {
		const summaryText = videoSummaries
			.map(({ transcript, summary }, index) => `## Video ${index + 1}: ${transcript.title}
- Channel: ${transcript.author}
- URL: ${transcript.url}

${summary.trim()}`)
			.join('\n\n');

		return `${this.buildInstructionBlock('playlist')}

You are creating a single knowledge note for an entire YouTube playlist. Use only the summarized material below. Do not invent details that are not present in the provided video summaries.

Follow these non-negotiable rules:
- Do not output a \`## Source\` section. Source metadata is rendered separately.
- Do not output transcript sections or long verbatim quotes.
- Synthesize recurring themes, differences between videos, and practical takeaways across the playlist.
- Treat the playlist as one cohesive resource, but mention standout videos when they add important context.

Playlist metadata:
- Title: ${playlist.title}
- Playlist URL: ${playlist.url}
- Video count: ${playlist.transcripts.length}

Video summaries:
${summaryText}`;
	}

	buildPlaylistAddonsSynthesisPrompt(
		playlist: PlaylistTranscriptResponse,
		videoAddonNotes: Array<{ transcript: TranscriptResponse; summary: string }>,
	): string {
		const addonText = videoAddonNotes
			.map(({ transcript, summary }, index) => `## Video ${index + 1}: ${transcript.title}
- Channel: ${transcript.author}
- URL: ${transcript.url}

${summary.trim()}`)
			.join('\n\n');

		return `${this.buildPlaylistAddonInstructions(playlist)}

Use the per-video add-on notes below instead of raw transcripts to produce the requested add-on sections for the playlist as a whole. Do not mention chunks or per-video processing in the final answer.

Per-video add-on notes:
${addonText}`;
	}

	private buildFrontmatterDirective(template: Template): string {
		const fm = template.frontmatter ?? [];
		if (!fm.length) {
			return '';
		}
		const keyLines = fm.map((f) => {
			let typeNote: string = f.type;
			if (f.type === 'enum' && f.enumValues?.length) {
				typeNote = `enum: ${f.enumValues.join(' | ')}`;
			}
			return `- ${f.key} (${typeNote}) — ${f.description}`;
		}).join('\n');

		return `Frontmatter directive — emit a metadata block at the very top of your response, before any heading, using EXACTLY these HTML-comment markers:

<!-- ytkn:frontmatter
key: value
list_key: [item1, item2]
-->

Use these keys (only these keys; omit any you cannot fill confidently):
${keyLines}

Use proper YAML inside the block. For arrays use \`[item1, item2]\` inline form. Do not output a top-level Markdown frontmatter (\`---\`) block; the renderer owns that.`;
	}

	private buildSectionDirective(template: Template): string {
		const sections = template.sections ?? [];
		if (!sections.length) {
			return '';
		}
		const lines = sections.map((s) => {
			const tag = s.required ? '(required)' : '(optional)';
			return `- \`## ${s.heading}\` ${tag} — ${s.description}`;
		}).join('\n');

		return `Use exactly these H2 headings, in this order. Required sections must be present; optional sections may be omitted if the source has no relevant content.

${lines}`;
	}

	private buildControlsBlock(template: Template, controlValues: Record<string, string>): string {
		const controls = template.controls ?? [];
		if (!controls.length) {
			return '';
		}

		const populated = controls.filter((c) => {
			const v = controlValues[c.id];
			return v !== undefined && v.trim() !== '';
		});

		if (!populated.length) {
			return '';
		}

		const lines = populated.map((c) => {
			const value = controlValues[c.id].trim();
			const guide = LEVEL_GUIDES[c.id]?.[value];
			return guide
				? `- ${c.label}: ${guide}`
				: `- ${c.label}: ${value}`;
		}).join('\n');

		return `User-supplied values — use these verbatim when generating the note:\n\n${lines}`;
	}

	private shouldIncludeTldr(): boolean {
		return this.runtimeOptions.includeTldr ?? true;
	}

	private stripTldrSectionFromBody(body: string): string {
		return body
			.replace(/(^|\n)##[ \t]+TL;DR[ \t]*\n[\s\S]*?(?=\n##[ \t]+|$)/i, (match) => match.startsWith('\n') ? '\n' : '')
			.replace(/\n{3,}/g, '\n\n')
			.trim();
	}

	private getPromptTemplate(): Template {
		const template = getTemplate(this.instructionConfig.template);
		if (this.shouldIncludeTldr()) {
			return template;
		}

		return {
			...template,
			body: this.stripTldrSectionFromBody(template.body),
			sections: template.sections?.filter((section) => section.id !== 'tldr'),
		};
	}

	private buildInstructionBlock(context: 'video' | 'playlist', includeAddons = true): string {
		const addons = includeAddons ? this.buildInstructionAddons() : '';
		if (this.instructionConfig.mode === 'manual') {
			return [this.instructionConfig.manualInstructions.trim(), addons].filter(Boolean).join('\n\n');
		}

		const template = this.getPromptTemplate();
		const playlistPrefix = context === 'playlist'
			? 'Apply the same template to the playlist as a whole, using the provided per-video summaries instead of a raw transcript.\n\n'
			: '';

		const directiveParts = [
			this.buildFrontmatterDirective(template),
			this.buildControlsBlock(template, this.instructionConfig.controlValues ?? {}),
			this.buildSectionDirective(template),
		].filter(Boolean);
		const directiveBlock = directiveParts.length ? `\n\n${directiveParts.join('\n\n')}` : '';

		return `${SHARED_BASE_INSTRUCTIONS}\n\n${playlistPrefix}${template.body}${directiveBlock}${addons ? `\n\n${addons}` : ''}`;
	}

	private buildInstructionAddons(): string {
		const blocks: string[] = [];

		blocks.push(this.shouldIncludeTldr() ? TLDR_SECTION_INSTRUCTIONS : NO_TLDR_SECTION_INSTRUCTIONS);

		if (this.instructionConfig.includeMindmap) {
			blocks.push(MINDMAP_APPENDIX_INSTRUCTIONS);
		}

		if (this.instructionConfig.includeMemorableQuotes) {
			blocks.push(MEMORABLE_QUOTES_APPENDIX_INSTRUCTIONS);
		}

		return blocks.join('\n\n');
	}

	private buildPlaylistAddonInstructions(playlist: PlaylistTranscriptResponse): string {
		return `${ADDON_BASE_INSTRUCTIONS}

${this.buildInstructionAddons()}

Playlist metadata (renderer adds this automatically — do not repeat it inside the body):
- Title: ${playlist.title}
- Playlist URL: ${playlist.url}
- Video count: ${playlist.transcripts.length}`;
	}

	private buildAddonCommonInstructions(transcript: TranscriptResponse, videoUrl: string): string {
		return `${ADDON_BASE_INSTRUCTIONS}

${this.buildInstructionAddons()}

Video metadata (renderer adds this automatically — do not repeat it inside the body):
- Title: ${transcript.title}
- Channel: ${transcript.author}
- Channel URL: ${transcript.channelUrl}
- Video URL: ${videoUrl}`;
	}

	private chunkTranscriptLines(transcript: TranscriptResponse, targetTranscriptTokens: number): string[] {
		const chunks: string[] = [];
		let currentChunk = '';
		let currentChunkTokens = 0;

		for (const line of transcript.lines) {
			const text = line.text.trim();
			if (!text) {
				continue;
			}

			const textTokens = this.estimateTokens(text);
			if (currentChunk && currentChunkTokens + textTokens > targetTranscriptTokens) {
				chunks.push(currentChunk);
				currentChunk = text;
				currentChunkTokens = textTokens;
				continue;
			}

			currentChunk = currentChunk ? `${currentChunk} ${text}` : text;
			currentChunkTokens += textTokens;
		}

		if (currentChunk) {
			chunks.push(currentChunk);
		}

		return chunks;
	}

	private getTranscriptBudgetTokens(
		promptWithoutTranscript: string,
		model: ModelConfig | null | undefined,
	): number {
		const contextWindow = this.getContextWindowTokens(model);
		const promptOverheadTokens = this.estimateTokens(promptWithoutTranscript);
		const safetyMarginTokens = Math.max(
			MIN_TRANSCRIPT_BUDGET_TOKENS,
			Math.round(contextWindow * 0.1),
		);
		const reservedOutputTokens = Math.max(
			MIN_TRANSCRIPT_BUDGET_TOKENS,
			Math.min(
				32000,
				Math.round(contextWindow * 0.2),
			),
		);

		return Math.max(
			MIN_TRANSCRIPT_BUDGET_TOKENS,
			contextWindow - promptOverheadTokens - safetyMarginTokens - reservedOutputTokens,
		);
	}

	private getContextWindowTokens(model: ModelConfig | null | undefined): number {
		if (model?.contextWindow && model.contextWindow > 0) {
			return model.contextWindow;
		}

		switch (model?.provider.type) {
			case 'anthropic':
				return FALLBACK_CONTEXT_WINDOW_TOKENS['anthropic'];
			case 'gemini':
				return FALLBACK_CONTEXT_WINDOW_TOKENS['gemini'];
			case 'openai':
				return FALLBACK_CONTEXT_WINDOW_TOKENS['openai'];
			case 'openai-compatible':
				return FALLBACK_CONTEXT_WINDOW_TOKENS['openai-compatible'];
			default:
				return FALLBACK_CONTEXT_WINDOW_TOKENS['openai'];
		}
	}

	private getTranscriptText(transcript: TranscriptResponse): string {
		return transcript.lines.map((line) => line.text).join(' ');
	}

	private buildTranscriptPromptPrefix(transcript: TranscriptResponse, videoUrl: string): string {
		return `${this.buildCommonInstructions(transcript, videoUrl)}

Transcript:
`;
	}

	private buildAddonsPromptPrefix(transcript: TranscriptResponse, videoUrl: string): string {
		return `${this.buildAddonCommonInstructions(transcript, videoUrl)}

Transcript:
`;
	}

	private estimateTokens(text: string): number {
		return Math.max(1, Math.ceil(text.length / ESTIMATED_CHARS_PER_TOKEN));
	}

	private buildCommonInstructions(transcript: TranscriptResponse, videoUrl: string, includeAddons = true): string {
		return `${this.buildInstructionBlock('video', includeAddons)}

Video metadata (renderer adds this automatically — do not repeat it inside the body):
- Title: ${transcript.title}
- Channel: ${transcript.author}
- Channel URL: ${transcript.channelUrl}
- Video URL: ${videoUrl}`;
	}
}
