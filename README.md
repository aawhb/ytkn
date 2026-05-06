# YouTube Knowledge Notes

[![Quality](https://github.com/aawhb/ytkn/actions/workflows/quality.yml/badge.svg)](https://github.com/aawhb/ytkn/actions/workflows/quality.yml)
[![CodeQL](https://github.com/aawhb/ytkn/actions/workflows/codeql.yml/badge.svg)](https://github.com/aawhb/ytkn/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/aawhb/ytkn/badge)](https://securityscorecards.dev/viewer/?uri=github.com/aawhb/ytkn)

YouTube Knowledge Notes (ytkn) is an Obsidian plugin that turns YouTube videos into structured **knowledge notes** for your vault. You can pick one of the built-in content templates that matches what you're trying to do with the video (summarize, study, extract, deep-dive, research), or you can set instructions manually, and the plugin generates a note shaped for that job.

The plugin fetches a YouTube transcript via the YouTube InnerTube API, optionally sends it to a configured AI model, and writes a Markdown note that fits cleanly into an Obsidian vault: frontmatter, aliases, tags, source metadata, TL;DR, optional transcript appendix, and playlist reporting.

## What the plugin does well

- **Vault-native notes.** Stable structure, Properties-friendly frontmatter, aliases, tags, and source metadata.
- **Transcript-first workflow.** Transcript-only runs work without any AI provider.
- **Provider flexibility.** OpenAI, Anthropic, Gemini, and OpenAI-compatible endpoints are supported.
- **Queue and multiple URLs.** Paste one or more URLs (space- or comma-separated) and all run sequentially. New submissions enqueue while the current run is in progress.
- **Playlist support.** Generate one note per video or one combined playlist note.
- **Three output destinations.** Insert at caret in the current note, create new notes in a folder, or append to the active note.

## Current UX

The plugin has two main surfaces:

### Settings tab

The settings page has two tabs:

- **General** — four cards: `Output destination` (where notes go, whether to use the video title as the note name), `Note structure` (thumbnail, frontmatter, source position, TL;DR callout), `Transcript in note` (transcript mode, timestamp links, language preference), `Queue and run reports` (playlist handling, transcript failure behavior, run report toggle and location)
- **GenAI** — generation defaults (instruction style, default content template, manual instructions, reasoning, temperature, timeout, mindmap, memorable quotes) and AI setup (providers, default model)

### Commands Palette

The generation flow opens a modal with two layers:

- a **Quick setup** card with the fields most likely to change per run — URL input (accepts multiple URLs, one per line or comma/space-separated) + AI summary toggle, instruction style, content template (or manual prompt), Mermaid mindmap toggle, memorable quotes toggle, output destination, transcript mode, and playlist handling when a playlist URL is detected
- a tabbed **Advanced settings** area mirroring most of the settings page (`General`, `GenAI`) for per-run overrides

## Commands

The plugin registers these commands:

- `Generate knowledge note`
- `Cancel all generations`
- `Manage queue`

In Obsidian, these appear under the plugin name in the command palette.

## Install

The plugin is NOT currently in the Obsidian Community Plugins directory.
It requires Obsidian 1.6.6 or newer.

### Manual install

1. Download `ytkn.zip` from the latest [release](https://github.com/aawhb/ytkn/releases).
2. Extract it so `main.js`, `manifest.json`, and `styles.css` are directly inside `.obsidian/plugins/ytkn/` in your vault.
3. Reload Obsidian and enable **YouTube Knowledge Notes**.

You can also download the individual `manifest.json`, `main.js`, and `styles.css` release assets manually:

1. Download the three files from the latest [release](https://github.com/aawhb/ytkn/releases).
2. Create `.obsidian/plugins/ytkn/` inside your vault.
3. Copy the three files into that folder.
4. Reload Obsidian and enable **YouTube Knowledge Notes**.

### BRAT

Add `aawhb/ytkn` to BRAT to install and update from GitHub.

## Quick start

1. Open **Settings → YouTube Knowledge Notes**.
2. If you want AI summaries, add a provider and select a default model in the **GenAI** tab.
3. Open any note.
4. Run `Generate knowledge note`.
5. Paste a YouTube video or playlist URL.
6. Use **Quick setup** for the run-specific choices, then click **Generate**.

## Supported workflows

### Transcript-only notes

Turn off **Generate AI summary** and pick a transcript mode other than `Off`.

### AI-generated knowledge notes

Leave **Generate AI summary** enabled and choose a model. The note body is produced from either a built-in template or your own manual instructions.

### Local models with OpenAI-compatible provider

OpenAI-compatible path (Ollama, LMStudio, LLama-Swap..etc.)

1. Add a provider using an OpenAI-compatible endpoint such as `http://localhost:11434/v1`.
2. Fetch or configure a model.
3. Select it as the default model or override it per run.

### Playlists

Playlist URLs support two modes:

- **Per video** — one note per video
- **Combined** — one aggregated note for the whole playlist

Combined playlist notes **require AI summary generation**. Per-video playlists work with AI or transcript-only output.

## What you can configure

### Output and note structure

- Current note, folder, or append-to-active-note destination
- Auto-create destination folders
- Use the video title as the note title
- Include thumbnail
- Include YAML frontmatter
- Add frontmatter tags
- Frontmatter property allowlist — control which renderer-owned keys appear in YAML (title, aliases, source, channel, channelUrl, videoUrl, playlistUrl, videoId, playlistId, generated, videoCount)
- Put source metadata at the top or bottom
- Control how YouTube linkbacks are rendered
- Promote the TL;DR into a summary callout at the top

### Transcript behavior

- Transcript mode:
  - none
  - raw
  - readable
  - timestamped
- Optional timestamp deep-links back to YouTube
- Transcript language mode:
  - auto-detect best available
  - preferred language with fallback
- Playlist transcript failure behavior:
  - skip and continue
  - fail the whole run

### AI behavior

- Built-in template vs fully manual instructions
- Optional Mermaid mindmap appendix
- Optional memorable quotes appendix
- Default AI model
- Reasoning mode and reasoning effort when the model supports it
- Temperature
- Request timeout

## Built-in content templates

Templates represent **knowledge jobs** — the answer to "what am I trying to do with this video?"

- **General knowledge note** — balanced summary, takeaways, where it applies, and limits. Best default.
- **Study notes** — recall-friendly, with prerequisites, concepts, walkthrough, self-test (collapsed Q&A), and to-remember bullets.
- **Implementation note** — concrete steps, code, tools, gotchas, and action items to act on the source.
- **Deep dive (topic reference)** — permanent topic note with canonical concept, mental model, components, common confusions, and explicit open threads.
- **Full extract** — exhaustive archive: every claim, example, tool, person, source, number, and quote worth keeping.
- **Research dossier** — inquiry-shaped: claims tagged with strength, evidence offered, what's missing, sources to chase.

All templates produce:

- Body sections in the order the template declares them, regardless of the order the AI emits them.
- Source-identity fields (`title`, `videoId`, `channel`, `videoUrl`, etc.) are renderer-owned and never accept AI overrides — protecting your vault from hallucinated source metadata.
- A run-report entry (for playlist generation) or an in-app Notice (for single videos) when a required section is missing.

### Per-template runtime controls

Some templates expose a runtime field in the generation modal to shape the output per run:

| Template | Control | Values |
| --- | --- | --- |
| Study notes | Learner level | intro / intermediate / advanced |
| Deep dive | Audience level | intro / intermediate / advanced |
| Full extract | Extraction density | concise / comprehensive / exhaustive |
| Research dossier | Research inquiry (required) | free text — the research question |
| Research dossier | Epistemic strictness | lenient / standard / strict |

Current built-in controls are prompt-only: they shape the AI's output (vocabulary depth, section depth, focus) and do not write frontmatter.

If none of the templates fit, switch the instruction style to **Manual** and provide your own prompt.

## Note shape

Generated notes are deterministic and renderer-driven. The plugin controls the outer note structure; the model only produces the body content.

When **Append to active note** is selected, the plugin writes a fragment instead of a standalone note:

- no frontmatter (existing note's YAML is untouched)
- H2 title (instead of H1)
- body sections shifted one heading level down (H2 → H3)
- source metadata and TL;DR callout still included

## Multiple URLs

Paste multiple URLs into the URL field — one per line (Shift+Enter), or separate them with spaces or commas. The field grows up to 6 rows as you type. The hint below the field shows a breakdown: videos, playlists, invalid. Enter submits; Shift+Enter adds a new line.

Duplicate URLs within a single paste are removed automatically (first occurrence kept) with a notice.

On submit:

- If any URL is not a recognized YouTube link, the batch is rejected with a notice identifying which one (e.g. "URL #2 is not a YouTube link: …"). Nothing is enqueued until you fix the input.
- All valid URLs are enqueued as a single batch under the same generation options snapshot.
- Runs execute one at a time, FIFO. Submitting a second batch while the first is in progress simply adds to the queue.

### Editor-target restrictions for multi-URL batches

When the destination is **Current note** or **Append to active note**:

- A markdown note must be open at submit time. If none is open, the batch is rejected.
- Multiple URLs coerce destination to sequential append (end-of-file) into the snapshotted active note — they do **not** use the replace-at-caret mode.
- The note is **not renamed** for multi-URL batches even if "Use video title as note name" is on (renaming after the first run would break subsequent runs). Single-URL "Insert at caret" runs still rename.
- A multi-URL batch that contains any playlist URL while **Playlist handling** is set to **Per video** is rejected. Switch playlist mode to **Combined**, switch destination to a folder, or remove the playlist URLs.

## Run reports

Each modal submission (batch) can produce one run report covering all videos and playlists in that submission. Entries are marked as:

- completed
- skipped
- failed
- canceled

The **Run report location** setting controls where the report lands:

- **First note** — appended to the first note created in the batch.
- **Separate note** — written to a new file alongside the other notes.

Playlist runs appear as a single batch entry with nested per-video sub-entries.

## Cancellation

Cancel individual runs or the whole queue through the **Manage queue** modal (status bar click or `Manage queue` command). Cancel everything at once with the `Cancel all generations` command.

Cancellation is best-effort:

- completed notes are kept
- empty plugin-created notes are cleaned up
- new work stops as soon as possible
- some in-flight network calls may finish their current step first

The status bar shows the active run title and how many runs are queued. Click it to open the **Manage queue** modal, which lists the active run, all queued runs, and a recent-results history (last 50 entries across all batches).

## Privacy and security

- API keys are stored locally in the plugin's `data.json` inside your vault.
- The plugin does not proxy requests through a separate service.
- There is no telemetry collection in the plugin.
- YouTube data is fetched from public web pages and unofficial endpoints, which may change over time.
- AI output is written into Markdown notes as returned; review generated content if trust matters.

## FAQ

### Can I use the plugin without an API key?

Yes. You can use local LLMs, or you can turn off AI summary and keep a transcript mode enabled.

### Where are API keys stored?

In the plugin's `data.json` inside your vault. They are local to the vault and not encrypted by the plugin.

### What happens if a video has no captions?

- For a single video, the run fails with a clear message.
- For playlists, behavior depends on the transcript failure setting.

### What happens when I cancel?

The plugin stops scheduling new work, keeps completed notes, and tries to clean up temporary files it created.

## Development

```bash
npm install
npm run lint:full
npm run typecheck
npm run test:run
npm audit --audit-level=moderate
npm run build
```

`npm run verify` runs the same local gate in one command.

### Optional sync to vault

Set `OBSIDIAN_VAULT_PATH` in `.env` (see `.env.example`) to your Obsidian vault root. `npm run sync` copies `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/ytkn`, then attempts to reload the plugin with Obsidian CLI from that vault using `obsidian plugin:reload id=ytkn`. Enable **Command line interface** in Obsidian Settings → General and restart your terminal after registration.

Sync reload modes:

- `OBSIDIAN_SYNC_RELOAD=none` copies files without asking Obsidian to reload.
- `OBSIDIAN_SYNC_RELOAD=app` runs `obsidian reload` instead of the faster plugin-only reload.

```bash
npm run sync
```

## License

MIT — see [LICENSE](LICENSE).
