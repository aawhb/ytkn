# Workflows

YT Knowledge Notes treats each submission as a batch. A batch can contain one URL or many URLs, and the queue runs items one at a time.

## Single video

Single-video runs are the simplest path and work well for most daily use.

Typical flow:

1. Paste one YouTube URL.
2. Choose transcript-only or AI-assisted output.
3. Pick a built-in template or switch to manual instructions.
4. Choose where the note should go:
   - **Insert at caret** in the current note
   - **Append to active note**
   - **Create new note** in a folder
5. Generate the note.

If you choose **Append to active note**, the plugin writes a note fragment instead of a full standalone note. That keeps your existing frontmatter untouched.

## Multiple URLs

You can paste multiple URLs using new lines, spaces, or commas.

What happens when you submit a batch:

- duplicate URLs are removed automatically
- if even one URL is invalid, the whole batch is rejected before anything is queued
- every URL in the batch uses the same snapshot of generation options
- if another batch is already running, the new batch waits in the queue

When the destination is **Insert at caret** or **Append to active note**:

- a Markdown note must already be open
- multiple URLs are appended sequentially to the same snapshotted note
- they do not use replace-at-caret mode after the first submit
- the note is not renamed for multi-URL batches, even if title-based naming is enabled

If a multi-URL batch includes a playlist and playlist handling is set to **Per video**, the batch cannot target the current note or append mode. Switch to **Combined**, switch the destination to a folder, or remove the playlist URLs from that batch.

## Playlists

Playlist URLs support two modes:

- **Per video** - create one note per video in the playlist
- **Combined** - create one note that synthesizes the whole playlist

Combined playlist notes require AI summary generation unless both AI and transcript inclusion are off. In that metadata-only case, the combined note is a playlist/source index. Per-video playlist notes work with AI-assisted, transcript-only, or metadata-only output.

Important playlist rules:

- **Append to active note** is not supported with **Per video** playlist mode
- transcript failures can either **skip and continue** or **fail the whole run**
- run reports include nested results for each video inside the playlist batch

## Queue and status

YT Knowledge Notes includes a queue so you can keep working while batches finish.

Available commands:

- **Generate** - open the generation modal
- **Manage queue** - inspect active work, queued work, and recent results
- **Cancel all queued** - stop the current run and clear queued work

The status bar shows the active run title and how many items are queued. Clicking it opens the queue manager.

## Run reports

Each submission can produce a run report for the full batch.

Reports can include:

- completed, skipped, failed, and canceled outcomes
- note paths for generated notes
- transcript language information when available
- warnings and failure reasons
- nested playlist outcomes

You can send the report to:

- the **first generated note** in the batch
- a **separate note** next to the generated notes

Reports are rendered as collapsible Obsidian callouts so they stay readable in both source and preview mode.

## Cancellation

Cancellation is best-effort. In practice that means:

- completed notes are kept
- empty plugin-created notes are cleaned up when possible
- queued work stops immediately
- some in-flight network requests may finish their current step first

## Templates or manual instructions?

Use a built-in template when you want a reliable note shape with predictable sections. Switch to manual instructions when you need a one-off output format that does not match the built-in templates.

Template-specific runtime controls appear only when they apply to the selected template. For help choosing one, see [Templates](https://github.com/aawhb/ytkn/blob/main/docs/templates.md).
