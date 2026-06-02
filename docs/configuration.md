# Configuration

The settings page stores your defaults. The generation modal can override most of them for a single submission without changing what you saved in settings.

## How settings are applied

- **Settings → YT Knowledge Notes** stores the defaults you want most of the time.
- The generation modal starts with **Quick setup** for the fields people usually change per run.
- The modal also includes advanced **General** and **GenAI** tabs for one-off overrides.
- Each queued batch keeps the options it was submitted with, even if you change settings later.

## Default starting point

Out of the box, the plugin starts from a practical default setup:

- AI and AI summary enabled
- **General knowledge note** as the default template
- timestamped transcripts
- **Insert at caret** as the destination
- video embed mode enabled
- frontmatter enabled
- playlist handling set to **Per video**
- run reports enabled and attached to the generated note

If that starting point is not how you work, change the defaults once and let the generation modal inherit them.

## Output destination

You can send output to one of three places:

- **Insert at caret** - write into the current Markdown note at the cursor
- **Create new note** - create one or more notes in a folder
- **Append to active note** - add a note fragment to the end of the current note

Related behavior to know:

- destination folders are created automatically when needed
- title-based renaming applies to folder runs and single-video insert-at-caret runs
- multi-URL editor-target batches never rename the note, to avoid breaking later items in the same batch

### Append-to-active-note behavior

Append mode writes a fragment instead of a full standalone note:

- no frontmatter is added
- the title becomes `##` instead of `#`
- body headings shift down by one level
- source metadata and summary callouts still follow your other display settings

That keeps your existing note's frontmatter untouched while preserving the generated structure.

## Note structure

Generated notes are renderer-driven. The plugin controls the outer Markdown shape, while AI output only fills the body content.

Structure options include:

- media embed mode: video, thumbnail, or off
- frontmatter on or off
- frontmatter tags
- frontmatter property allowlist
- source metadata position at the top or bottom of the note
- timestamp linking inside timestamped transcripts

For combined playlist notes, video media mode embeds the first playlist video using the same Markdown embed pattern as video notes. Thumbnail mode uses the first video thumbnail when available.

The plugin owns source identity fields, so model output cannot overwrite them.

### Frontmatter properties

If frontmatter is enabled, you can choose which renderer-owned keys are written.

Supported keys are:

- `title`
- `aliases`
- `source`
- `channel`
- `channelUrl`
- `channelId`
- `videoUrl`
- `playlistUrl`
- `videoId`
- `playlistId`
- `thumbnailUrl`
- `videoDescription`
- `uploadDate`
- `videoCategory`
- `durationSeconds`
- `keywords`
- `generated`
- `videoCount`

The allowlist is useful when you want a lighter frontmatter block or need to match your vault conventions.

## Transcript settings

Transcript modes:

- **Off** - do not include transcript content in the note
- **Readable** - include cleaned transcript paragraphs
- **Timestamped** - include cleaned paragraphs with timestamps that can link back to YouTube

Long transcripts are rendered inside a collapsed callout so the source material stays available without taking over the note.

Language behavior:

- **Auto-detect best available** - use any available transcript
- **Preferred language with fallback** - try your chosen language first, then fall back to another available transcript

Playlist transcript failures can either:

- **Skip and keep going**
- **Stop the whole run**

## AI and note generation

AI-related settings cover:

- whether a run uses AI at all
- whether AI generates the main summary/template body
- built-in templates vs manual instructions
- default model selection
- temperature, when supported by the chosen provider
- request timeout
- optional TL;DR summary callout at the top of the note, independent of the full AI summary body
- optional Mermaid mindmap appendix
- optional memorable quotes appendix

When **Use AI** is off, the plugin generates renderer-owned metadata and does not apply template tags or AI frontmatter. If transcript inclusion is also off, the result is a metadata/source-only note and captions are not required. When **Use AI** is on but **AI summary** is off, AI can still generate enabled outputs such as the TL;DR summary callout, mindmaps, or memorable quotes without applying the selected content template.

Combined playlist notes require at least one AI output unless both **Use AI** and transcript inclusion are off. In that metadata-only case, the combined playlist note is a playlist/source index without per-video transcript fetching.

Template-specific runtime controls show up only when they apply to the selected template. For the decision guide, see [Templates](https://github.com/aawhb/ytkn/blob/main/docs/templates.md).

For provider setup and local model help, see [Providers and local models](https://github.com/aawhb/ytkn/blob/main/docs/providers.md).

## Queue and run reports

Run reports summarize what happened in a batch.

They can include:

- completed, skipped, failed, and canceled totals
- totals based on standalone videos and nested playlist videos
- one grouped entry per submitted video or playlist
- per-playlist counts and nested playlist outcomes
- note paths, transcript language, warnings, and failure reasons when available

Report location options:

- **Generated note** - append the report to the first generated note in the batch
- **Separate note** - write a separate report file next to the generated notes
