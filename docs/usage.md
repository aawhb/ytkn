# Usage

YouTube Knowledge Notes is built around one command: paste YouTube URLs, choose the note shape, and let the queue write Markdown into your vault.

## Commands

The plugin registers these commands under **YouTube Knowledge Notes** in the Obsidian command palette:

- **Generate knowledge note** — open the generation modal.
- **Cancel all generations** — cancel the active run and clear queued runs.
- **Manage queue** — inspect the active run, queued runs, and recent results.

## Generation flow

The generation modal has two layers:

- **Quick setup** — URL input, AI summary toggle, instruction style, content template or manual prompt, TL;DR summary callout toggle, Mermaid mindmap toggle, memorable quotes toggle, output destination, transcript mode, and playlist handling when a playlist URL is detected.
- **Advanced settings** — per-run overrides that mirror the settings page, grouped into `General` and `GenAI` tabs, including media embed mode, transcript behavior, and run-report preferences.

The URL field accepts one or more YouTube URLs. It grows up to 6 rows as you type, shows a breakdown of videos/playlists/invalid entries, and supports Shift+Enter for new lines.

## Supported workflows

### Transcript-only notes

Turn off **Generate AI summary** and choose a transcript mode other than `Off`. No AI provider or API key is required.

### AI-generated knowledge notes

Leave **Generate AI summary** enabled and choose a model. The body content comes from either a built-in template or your manual instructions.

### Local models with OpenAI-compatible providers

Add an OpenAI-compatible provider with an endpoint such as `http://localhost:11434/v1`, fetch or configure a model, and select it as the default or override it per run.

Common local model paths include Ollama, LM Studio, Llama-Swap, and other OpenAI-compatible servers.
ytkn sends generation requests through the standard OpenAI-compatible `/v1/chat/completions` endpoint.

### Playlists

Playlist URLs support two modes:

- **Per video** — one note per video.
- **Combined** — one aggregated note for the whole playlist.

Combined playlist notes require AI summary generation. Per-video playlist notes work with AI or transcript-only output.

## Multiple URLs

Paste multiple URLs into the URL field using one URL per line, spaces, or commas.

Duplicate URLs within a single paste are removed automatically, preserving the first occurrence and showing a notice.

On submit:

- If any URL is not a recognized YouTube link, the batch is rejected with a notice identifying the invalid entry. Nothing is enqueued until the input is fixed.
- All valid URLs are enqueued as a single batch under the same generation options snapshot.
- Runs execute one at a time in FIFO order.
- Submitting another batch while a run is in progress adds it to the queue.

### Editor-target restrictions for multi-URL batches

When the destination is **Current note** or **Append to active note**:

- A Markdown note must be open at submit time.
- Multiple URLs append sequentially to the snapshotted active note. They do not use replace-at-caret mode.
- The note is not renamed for multi-URL batches, even if **Use video title as note name** is enabled.
- A multi-URL batch containing any playlist URL is rejected when **Playlist handling** is set to **Per video**. Switch playlist mode to **Combined**, switch destination to a folder, or remove the playlist URLs.

## Run reports

Each modal submission can produce a run report covering all videos and playlists in that batch.

Entries are marked as:

- completed
- skipped
- failed
- canceled

The **Run report location** setting controls where the report lands:

- **First note** — appended to the first note created in the batch.
- **Separate note** — written to a new file alongside the generated notes.

Playlist runs appear as a single batch entry with nested per-video sub-entries.

Run reports render as folded Obsidian callouts with a summary block and structured run entries, so batch results are readable in both source and preview modes.

## Cancellation

Cancel individual runs or the whole queue through the **Manage queue** modal. Cancel all queued and active work with **Cancel all generations**.

Cancellation is best-effort:

- completed notes are kept
- empty plugin-created notes are cleaned up
- new work stops as soon as possible
- some in-flight network calls may finish their current step first

The status bar shows the active run title and how many runs are queued. Click it to open the **Manage queue** modal, which lists the active run, queued runs, and the last 50 recent results across batches.
