import {
	InstructionConfig,
	ModelConfig,
	PlaylistTranscriptResponse,
	ReasoningMode,
	Template,
	TranscriptResponse,
} from '../types';
import { isOllamaEndpoint } from '../utils';
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
- Always start with \`## TL;DR\` containing 1-2 sentences (≤ 240 characters total) capturing the single most important takeaway. The renderer surfaces this in note previews.
- Omit any section that would be empty. Do not write filler like "no items mentioned" or "n/a".
- Keep bullets concise, specific, and high-signal. Do not restate the same idea twice.
- Separate core content from sponsor reads, promotional content, and filler when relevant.
- Treat each transcript as an independent source unless explicitly told otherwise.`;

const MINDMAP_APPENDIX_INSTRUCTIONS = `After completing your main note content, append one final section: a Mermaid mindmap of the key concepts. Use exactly this format — the backtick fences are required; do not replace the diagram with prose:

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

const MEMORABLE_QUOTES_APPENDIX_INSTRUCTIONS = `Append this extra section at the very end of the note (after Mindmap if present):

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
	reasoningMode?: ReasoningMode;
}

export class PromptService {
	constructor(private instructionConfig: InstructionConfig) { }

	buildPrompt(transcript: TranscriptResponse, videoUrl: string): string {
		const transcriptText = this.getTranscriptText(transcript);

		return `${this.buildTranscriptPromptPrefix(transcript, videoUrl)}${transcriptText}`;
	}

	splitTranscript(transcript: TranscriptResponse, videoUrl: string, options: ChunkingOptions = {}): string[] {
		const transcriptText = this.getTranscriptText(transcript);
		if (!transcriptText) {
			return [];
		}

		const fullPromptBudget = this.getTranscriptBudgetTokens(
			this.buildTranscriptPromptPrefix(transcript, videoUrl),
			options.model,
			options.reasoningMode ?? 'off',
		);

		if (this.estimateTokens(transcriptText) <= fullPromptBudget) {
			return [transcriptText];
		}

		const chunkPromptBudget = this.getTranscriptBudgetTokens(
			this.buildChunkPrompt(transcript, videoUrl, '', 1, 2),
			options.model,
			'off',
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

	buildSynthesisPrompt(transcript: TranscriptResponse, videoUrl: string, chunkSummaries: string[]): string {
		const chunkSummaryText = chunkSummaries
			.map((summary, index) => `### Chunk ${index + 1}\n${summary.trim()}`)
			.join('\n\n');

		return `${this.buildCommonInstructions(transcript, videoUrl)}

Use the chunk summaries below instead of the raw transcript to produce the final video knowledge note. Do not mention chunks in the final answer.

Chunk summaries:
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

	private buildInstructionBlock(context: 'video' | 'playlist', includeAddons = true): string {
		const addons = includeAddons ? this.buildInstructionAddons() : '';
		if (this.instructionConfig.mode === 'manual') {
			return [this.instructionConfig.manualInstructions.trim(), addons].filter(Boolean).join('\n\n');
		}

		const template = getTemplate(this.instructionConfig.template);
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

		if (this.instructionConfig.includeMindmap) {
			blocks.push(MINDMAP_APPENDIX_INSTRUCTIONS);
		}

		if (this.instructionConfig.includeMemorableQuotes) {
			blocks.push(MEMORABLE_QUOTES_APPENDIX_INSTRUCTIONS);
		}

		return blocks.join('\n\n');
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
		reasoningMode: ReasoningMode,
	): number {
		const contextWindow = this.getContextWindowTokens(model, reasoningMode);
		const promptOverheadTokens = this.estimateTokens(promptWithoutTranscript);
		const safetyMarginTokens = Math.max(
			MIN_TRANSCRIPT_BUDGET_TOKENS,
			Math.round(contextWindow * (reasoningMode === 'on' ? 0.2 : 0.1)),
		);
		const reservedOutputTokens = Math.max(
			MIN_TRANSCRIPT_BUDGET_TOKENS,
			Math.min(
				32000,
				Math.round(contextWindow * (reasoningMode === 'on' ? 0.25 : 0.2)),
			),
		);

		return Math.max(
			MIN_TRANSCRIPT_BUDGET_TOKENS,
			contextWindow - promptOverheadTokens - safetyMarginTokens - reservedOutputTokens,
		);
	}

	private getContextWindowTokens(model: ModelConfig | null | undefined, reasoningMode: ReasoningMode): number {
		const isOllamaLocal = model?.provider.type === 'openai-compatible'
			&& !!model.provider.url
			&& isOllamaEndpoint(model.provider.url);

		if (model?.contextWindow && model.contextWindow > 0) {
			if (isOllamaLocal) {
				return Math.min(model.contextWindow, FALLBACK_CONTEXT_WINDOW_TOKENS['ollama']);
			}

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
				return isOllamaLocal ? FALLBACK_CONTEXT_WINDOW_TOKENS['ollama'] : FALLBACK_CONTEXT_WINDOW_TOKENS['openai-compatible'];
			default:
				return reasoningMode === 'on' ? FALLBACK_CONTEXT_WINDOW_TOKENS['ollama'] : FALLBACK_CONTEXT_WINDOW_TOKENS['openai'];
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
