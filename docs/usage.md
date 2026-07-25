# Using YT Knowledge Notes

This guide explains how to choose the note you want, where it should go, and how videos, playlists, AI features, and transcripts work together.

## Defaults and one-time changes

**Settings → YT Knowledge Notes** stores the choices you normally want. The generation window begins with those defaults, but changes made there apply only to that submission.

Once a batch enters the queue, it keeps the choices it was submitted with. Changing plugin settings later does not change work that is already queued.

## Choose what to create

The **Use AI**, **Generate note body**, and **Transcript in note** settings can be combined in several ways.

| What you want | Settings to use |
| --- | --- |
| Source and transcript note | Turn **Use AI** off. Choose **Readable** or **Timestamped** for the transcript. |
| Full AI-assisted note | Turn **Use AI** and **Generate note body** on. Choose a built-in template or custom instructions. |
| TL;DR callout, mind map, or quotes without a full AI body | Turn **Use AI** on and **Generate note body** off. Enable the individual AI sections you want. |
| Metadata and source only | Turn **Use AI** off and set **Transcript in note** to **Off**. |

Every generated note keeps source details under plugin control. AI fills only the content that you request.

## Choose where notes go

### Current note

**Current note** replaces the current selection in an open Markdown note, or inserts at the cursor when nothing is selected.

If that note changes while a run is waiting in the queue, the run stops instead of applying stale selection offsets. Start the run again to use the new selection or cursor.

Use it when you are already writing and want to place the generated content at a specific location.

### Append to active note

**Append to active note** adds the result to the end of the open note. It writes a note fragment instead of a second complete document:

- existing note properties are left unchanged
- the generated title starts at heading level 2
- body headings move down one level
- source information and enabled AI sections are still included

### Folder

**Folder** creates one or more notes in the folder you choose. The folder is created automatically if it does not exist.

This is the best destination for multiple URLs and playlists that create one note per video.

When **Folder** is selected, **Open created note** opens the first generated note in a new tab as soon as it is created. This lets you watch progress while the plugin fills the note. It is off by default, and it opens only the first note for each batch, including multi-URL submissions and per-video playlists.

### Note titles and filenames

**Use source title as note name** is on by default.

- For a single video or a combined playlist using **Current note**, the plugin can rename the current note to the video or playlist title.
- For **Folder**, created notes use the video or playlist title.
- For a per-video playlist using **Current note**, the first video can rename the current note and later videos are created as adjacent notes with their video titles.
- **Append to active note** does not rename the active note.
- A multi-URL run targeting the current note does not rename it.

Turn this setting off to keep the current filename. New single-video notes use a generic name, and per-video playlist notes use numbered playlist filenames.

## Choose what the note contains

The **General** tab controls the parts that the plugin adds around the main content.

### Media

Choose **Video**, **Thumbnail**, or **Off** under **Media embed**.

For a combined playlist note, video and thumbnail modes use the first playlist video when it is available.

### Note properties

Turn **Include frontmatter** on to add Obsidian note properties in a YAML block.

You can:

- add your own tags
- choose which source properties are included
- keep a small property block that matches your vault conventions

The **Frontmatter properties** setting lists the supported property names. Video title, channel, URLs, IDs, and other source details come from the plugin rather than the AI response.

### Source information

Use **Source metadata position** to place the video title, channel, and URL near the top or bottom of the note.

### Transcript

**Transcript in note** has three choices:

- **Off** leaves transcript text out of the note.
- **Readable** creates cleaned transcript paragraphs.
- **Timestamped** adds timestamps to the cleaned transcript.

Turn **Link timestamps to YouTube** on if you want timestamp links to open the video at that point.

For transcript language:

- **YouTube default** uses the first transcript YouTube exposes.
- **Preferred language, then default** tries the requested language code first, then uses YouTube's default.

Long transcripts appear in a collapsed callout so the note remains easy to navigate.

## Shape AI-assisted notes

### Built-in templates

Templates answer the question, “What do I want to get from this video?”

| Template | Best for | Extra options |
| --- | --- | --- |
| General knowledge note | A balanced note with takeaways, applications, and limits | None |
| Study notes | Learning, review, and self-testing | Learner level |
| Implementation note | Steps, tools, gotchas, and action items | None |
| Deep dive | A durable reference note about an important concept | Audience level |
| Full extract | Preserving claims, examples, numbers, and details | Extraction density |
| Research dossier | Investigating a question and weighing evidence | Research inquiry and strictness |

If a note is too broad, try **Deep dive** or **Research dossier**. If it is too detailed, try **General knowledge note**. For practical instructions, try **Implementation note**. For review and recall, try **Study notes**.

### Custom instructions

Choose **Custom instructions** when none of the built-in templates match what you need.

Describe the body you want the AI to write. The plugin still adds source details, media, note properties, enabled AI sections, and the transcript according to your other settings.

### Optional AI sections

The following sections can be enabled independently:

- **Add TL;DR callout** creates a brief TL;DR callout near the top of the note.
- **Add mind map** creates a Mermaid mind map after the main body.
- **Add memorable quotes** creates a quote section after the main body and mind map.

The toggle tells the plugin to request, format, and place that section. If your custom instructions request similar content while its toggle is off, the plugin leaves that content as part of the ordinary AI-written body.

If the model misses an enabled section, the plugin preserves useful output and adds a warning instead of silently discarding content.

## Generate notes from multiple URLs

Paste multiple URLs using lines, spaces, or commas.

For each submission:

- duplicate URLs are removed
- one invalid URL stops the submission before it enters the queue
- every URL uses the same choices from the generation window
- a new submission waits if another batch is already running

When multiple URLs target **Current note** or **Append to active note**, results are added in order to the same note. The note is not renamed during a multi-URL run.

A single per-video playlist can use **Current note**. The first video uses the current note, and later videos are created as adjacent notes.

**Append to active note** is not supported for per-video playlists. When one submission contains multiple URLs, a per-video playlist also cannot target **Current note**. Use **Folder**, choose **One combined note**, or submit the playlist separately.

## Generate notes from playlists

**Playlist and channel output** has two choices:

- **One note per video** creates one note for each playlist video.
- **One combined note** creates one note for the whole playlist.

Both choices support AI-assisted, transcript-only, and metadata-only notes.

With **One note per video** and **Current note**, the first video uses the current note and the remaining videos become adjacent notes. With **One note per video** and **Folder**, every video becomes a note in the chosen folder. **Append to active note** is available only with **One combined note**.

Under **When a transcript can't be fetched**, choose whether the plugin should:

- **Skip and keep going** with the rest of the playlist
- **Stop the whole run**

Combined playlist notes can be large. A lighter template, a faster model, or transcript-only output can make long playlists easier to process.

## Generate notes from channels

Paste a channel URL using a handle (`youtube.com/@handle`), channel ID (`youtube.com/channel/UC…`), or legacy `/c/` or `/user/` URL. Links from the channel's Home, About, and Community pages are accepted, and links ending in `/videos`, `/shorts`, or `/streams` are also supported. Channel-level Playlists, Podcasts, and Releases tabs are not imported; paste an individual playlist URL instead.

For each channel run, choose one or more content types:

- **Videos** processes the channel's Videos tab.
- **Shorts** processes the channel's Shorts tab through the same transcript pipeline as other videos.
- **Stream replays** processes completed streams. Active and upcoming streams are skipped because they do not have a stable final transcript.

The item limit applies separately to every selected type. For example, a limit of 10 with Videos and Shorts selected processes up to 10 of each. Choose **All available** to remove the plugin's channel item limit. Large or unlimited channel runs can require many YouTube and AI requests.

An explicit `/videos`, `/shorts`, or `/streams` link initially selects that content type. A bare channel URL uses the saved channel-content defaults. **Playlist and channel output** still controls whether the result is one note per video or one combined channel note.

## Use the queue

Each submission becomes a batch in the queue. A batch can contain one URL, several URLs, a playlist, or a channel.

Use **Manage queue** to see:

- the item currently running
- work waiting to start
- recent completed, skipped, failed, and canceled results

The status bar also shows active work. Select it to open the queue manager.

Use **Cancel all queued** to stop waiting work and cancel the active run. Notes that already finished are kept. The plugin stops waiting for canceled AI requests, but a local server or remote service may continue processing a request that it already received.

## Run reports

Turn **Include report** on to record what happened in a batch.

A report can show:

- completed, skipped, failed, and canceled results
- paths to generated notes
- transcript languages
- warnings and failure reasons
- results for individual videos inside a playlist

Choose **First generated note** to append the report to the first generated note, or **Separate report note** to create another file beside the generated notes.
