# Configuration

The settings page stores defaults for generation runs. Most options can also be overridden per run from the generation modal.

## Settings tabs

The settings page has two tabs:

- **General** — output destination, note structure, transcript behavior, queue behavior, playlist handling, and run reports.
- **GenAI** — instruction style, default template, manual instructions, provider/model setup, temperature, timeout, TL;DR summary callouts, Mermaid mindmaps, and memorable quotes.

## Output destination

Choose where generated content goes:

- **Current note** — insert into the current Markdown note.
- **Folder** — create new notes in a configured folder.
- **Append to active note** — append generated content to the active note.

Related options include:

- auto-create destination folders
- use the video title as the note title
- rename single-video insert-at-caret notes when title naming is enabled

## Note structure

Generated notes are deterministic and renderer-driven. The plugin controls the outer Markdown shape; AI output only fills body sections.

Configurable structure options include:

- choose the media embed mode: video, thumbnail, or off
- include YAML frontmatter
- add frontmatter tags
- choose source metadata position
- control how YouTube linkbacks are rendered

## Frontmatter allowlist

The frontmatter property allowlist controls which renderer-owned keys appear in YAML.

Supported source identity fields include:

- `title`
- `aliases`
- `source`
- `channel`
- `channelUrl`
- `videoUrl`
- `playlistUrl`
- `videoId`
- `playlistId`
- `generated`
- `videoCount`

These fields are owned by the renderer and are not accepted from model output.

## Transcript behavior

Transcript modes:

- **none** — do not include transcript content.
- **readable** — include cleaned, coherent transcript paragraphs.
- **timestamped** — include coherent transcript paragraphs with timestamp links back to YouTube.

Transcripts render in a folded Obsidian callout so long source text stays available without overwhelming the note.

Transcript language options:

- auto-detect best available transcript
- prefer a configured language with fallback

Playlist transcript failure behavior:

- **skip and continue** — skip videos whose transcripts cannot be fetched.
- **fail the whole run** — stop the playlist run on transcript failure.

## Run reports

Run reports can be appended to the generated note or written as a separate note.

Reports render in a collapsible section with:

- summary totals for completed, skipped, failed, and canceled runs
- one readable entry per video or playlist
- nested playlist video outcomes
- note paths, transcript language, failure reasons, and warnings when available

## AI behavior

Generation options include:

- built-in template vs manual instructions
- default AI model
- temperature, where supported by the selected provider/model
- request timeout
- optional TL;DR summary callout promotion for AI-generated summaries
- optional Mermaid mindmap appendix
- optional memorable quotes appendix

## Provider setup

Supported provider families:

- OpenAI
- Anthropic
- Gemini
- OpenAI-compatible endpoints

For local models, add an OpenAI-compatible provider pointed at your model server, such as `http://localhost:11434/v1`.
Generation requests use the standard OpenAI-compatible `/v1/chat/completions` endpoint.

API keys are stored locally in the plugin's `data.json` inside your vault.

## Append-to-active-note shape

When **Append to active note** is selected, the plugin writes a fragment instead of a standalone note:

- no frontmatter is written
- the title is H2 instead of H1
- body sections shift down one heading level, for example H2 becomes H3
- source metadata and TL;DR callout still follow the configured options

This keeps the existing note's YAML untouched while preserving the generated content structure.
