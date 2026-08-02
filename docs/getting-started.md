# Getting started

YT Knowledge Notes works with or without AI. The shortest path is to create a transcript and source note first, then connect an AI provider only if you want an AI-generated note body or add-ons.

## Before you begin

You need:

- Obsidian `1.13.1` or newer
- a YouTube video, playlist, or channel URL
- an open Markdown note only if you want to use **Current note** or **Append to active note**
- an optional AI provider and model for AI-assisted output

## Install from Community Plugins

1. Open **Settings → Community plugins**.
2. Select **Browse** and search for **YT Knowledge Notes**.
3. Select **Install**.
4. Select **Enable**.

## Install with BRAT

1. Install and enable **BRAT** from Community Plugins.
2. Open the command palette.
3. Run **BRAT: Add a beta plugin for testing**.
4. Enter `aawhb/ytkn`.
5. Let BRAT install the plugin, then make sure **YT Knowledge Notes** is enabled under Community Plugins.

BRAT follows releases from the GitHub repository. It is intended for users who want to test versions distributed outside the Community Plugins update flow.

## Install manually

1. Open the [latest YT Knowledge Notes release](https://github.com/aawhb/ytkn/releases/latest) and expand **Assets**.
2. Download `main.js`, `manifest.json`, and `styles.css`. Do not download a source code archive.
3. Create a folder named `ytkn` inside your vault's `.obsidian/plugins/` folder.
4. Copy the three downloaded files into `.obsidian/plugins/ytkn/`.
5. Reload Obsidian.
6. Open **Settings → Community plugins** and enable **YT Knowledge Notes**.

## Defaults and one-time changes

**Settings → YT Knowledge Notes** stores the choices you normally want. The generation window begins with those defaults, but changes made there apply only to that submission.

Once a batch enters the queue, it keeps the choices it was submitted with. Changing plugin settings later does not change work that is already queued.

## Create a note without AI

This path needs no provider and no API key.

1. Open a note if you want the result in the current note.
2. Open the command palette and run **YT Knowledge Notes: Generate**.
3. Paste a YouTube video, playlist, or channel URL.
4. Turn **Use AI** off.
5. Choose a destination:
   - **Current note** replaces the current selection, or inserts at the cursor when nothing is selected.
   - **Append to active note** adds the result to the end of the open note.
   - **Folder** creates one or more notes in the folder you choose.
   - With **Folder**, turn on **Open created note** if you want the first generated note in the batch to open in a new tab.
6. Set **Transcript in note** to **Readable** or **Timestamped**.
7. Select **Generate**.

The result can include video details, note properties, source information, media, and the transcript. Use the **General** tab in the generation window if you want to change any of those parts.

## Add AI-assisted content

AI can create a full note body, a TL;DR callout, a mind map, memorable quotes, or any combination of those outputs.

### Connect a provider

1. Open **Settings → YT Knowledge Notes**.
2. Open the **AI** tab.
3. Add the provider you use.
4. Select or create an Obsidian secret for the API key when the provider requires one. See [Create and select an API key secret](providers.md#create-and-select-an-api-key-secret).
5. Select **Fetch models**, or add a model manually.
6. Choose the model you want to use by default.

See [AI providers and local models](providers.md) for provider-specific instructions.

### Generate an AI-assisted note

1. Run **YT Knowledge Notes: Generate**.
2. Paste a YouTube URL.
3. Keep **Use AI** on.
4. Keep **Generate note body** on if you want a complete AI-generated note body.
5. Under **AI instructions**, choose **Built-in template** or **Custom instructions**.
6. Turn the TL;DR callout, mind map, or memorable quotes on or off as needed.
7. Choose the destination and transcript mode.
8. Select **Generate**.

If **Use AI** is on but **Generate note body** is off, the plugin can still create any enabled TL;DR callout, mind map, or memorable quotes section.

## Next steps

- [Using YT Knowledge Notes](usage.md) explains templates, destinations, multiple URLs, playlists, note structure, queue behavior, and reports.
- [AI providers and local models](providers.md) covers cloud providers, local servers, secrets, and model selection.
- [Troubleshooting](troubleshooting.md) helps when a transcript, provider, destination, or batch does not work as expected.
