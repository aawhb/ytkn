# Getting started

YT Knowledge Notes can work in two modes:

- **Transcript-first** notes with no AI provider at all
- **AI-assisted** notes with a configured model

## What you need

- Obsidian `1.11.4` or newer
- one or more YouTube video or playlist URLs
- an optional AI provider and model if you want synthesis
- an open Markdown note only if you want to insert at the caret or append to the active note

## Install the plugin

### Community Plugins

Once YT Knowledge Notes is listed, search for **YT Knowledge Notes** in **Settings → Community plugins**, install it, and enable it.

### Until the community listing is live

Choose one of these temporary install paths:

- **BRAT** — add `aawhb/ytkn` and let BRAT keep the plugin updated from GitHub
- **Manual install** — download the latest release, extract `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/ytkn/`, then reload Obsidian

## Decide how much AI you want

### Transcript-only

Use this when you want clean source notes without any API key.

1. Leave transcript mode set to **Readable** or **Timestamped**.
2. Turn **AI summary** off in the generation modal.
3. Generate the note.

### AI-assisted

Use this when you want synthesis, template-driven notes, or structured takeaways.

1. Open **Settings → YT Knowledge Notes**.
2. Add a provider in the **GenAI** tab.
3. Choose or discover a model.
4. Keep **AI summary** enabled in the generation modal.

Provider help lives in [Providers and local models](https://github.com/aawhb/ytkn/blob/main/docs/providers.md).

## Create your first note

<!-- Screenshot slot: settings page overview -->
<!-- Screenshot slot: generation modal quick setup -->

1. Open **Settings → YT Knowledge Notes** and review your defaults.
2. Open or create a note if you plan to insert at the caret or append to the active note.
3. Run **Generate knowledge note** from the command palette.
4. Paste a YouTube video or playlist URL.
5. Choose:
   - transcript-only or AI-assisted output
   - a built-in template or manual instructions
   - where the note should go
   - whether the transcript should be hidden, readable, or timestamped
6. Click **Generate**.

The plugin writes Markdown directly into your vault. Depending on your settings, it can include frontmatter, source metadata, transcript appendices, and a run report.

## What to learn next

- [Workflows](https://github.com/aawhb/ytkn/blob/main/docs/usage.md) for multiple URLs, playlists, queue behavior, and cancellation
- [Configuration](https://github.com/aawhb/ytkn/blob/main/docs/configuration.md) for defaults and note structure
- [Templates](https://github.com/aawhb/ytkn/blob/main/docs/templates.md) for picking the right note shape
- [Troubleshooting](https://github.com/aawhb/ytkn/blob/main/docs/troubleshooting.md) if the first run does not behave as expected
