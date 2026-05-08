# YouTube Knowledge Notes

[![Quality](https://github.com/aawhb/ytkn/actions/workflows/quality.yml/badge.svg)](https://github.com/aawhb/ytkn/actions/workflows/quality.yml)
[![CodeQL](https://github.com/aawhb/ytkn/actions/workflows/codeql.yml/badge.svg)](https://github.com/aawhb/ytkn/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/aawhb/ytkn/badge)](https://scorecard.dev/viewer/?uri=github.com/aawhb/ytkn)

YouTube Knowledge Notes (ytkn) turns YouTube videos and playlists into structured Obsidian notes: transcript-first, AI-optional, template-driven, and vault-native.

Paste a YouTube URL, choose the kind of note you want, and ytkn writes deterministic Markdown with source metadata, Properties-friendly frontmatter, optional AI-generated sections, and optional transcript appendices. Use it with OpenAI, Anthropic, Gemini, OpenAI-compatible local models, or no AI provider at all.

## What it does

- **AI optional.** Generate transcript-only notes without an API key, or add AI summaries when you want synthesis.
- **Obsidian-native output.** Notes use Markdown, YAML frontmatter, aliases, tags, callouts, source links, and predictable headings.
- **Deterministic note structure.** ytkn owns source identity fields such as title, channel, video ID, and URLs so model output cannot overwrite them.
- **Flexible media embeds.** Embed the video, show only the thumbnail, or keep generated notes media-free.
- **Knowledge-job templates.** Pick the shape that matches the work: general summary, study notes, implementation plan, deep dive, full extract, or research dossier.
- **Playlist and queue support.** Generate per-video notes or a combined playlist note; multiple submissions run sequentially.
- **Flexible providers.** OpenAI, Anthropic, Gemini, and OpenAI-compatible endpoints such as Ollama, LM Studio, and Llama-Swap are supported.

## Example output

```markdown
---
title: "How Retrieval-Augmented Generation Works"
aliases:
  - "How Retrieval-Augmented Generation Works"
source: youtube
channel: Example Channel
videoUrl: https://www.youtube.com/watch?v=dQw4w9WgXcQ
videoId: dQw4w9WgXcQ
generated: 2026-05-06
---

# How Retrieval-Augmented Generation Works

![How Retrieval-Augmented Generation Works](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

> [!summary] TL;DR
> Retrieval-augmented generation pairs a language model with a searchable knowledge source so answers can cite and use external context instead of relying only on model memory.

## Key takeaways

- Retrieval quality usually matters more than model size.
- Chunking strategy affects whether the model receives useful context.
- Evaluation should test citation quality, not only answer fluency.

## Where this applies

- Internal knowledge bases
- Support assistants
- Research workflows

> [!note]- Transcript
> **[0:12](https://youtu.be/dQw4w9WgXcQ?t=12s)** Retrieval gives the model fresh context and anchors answers in the material being discussed.
```

The exact sections depend on the selected template and run options. Source metadata is renderer-owned; the model only fills the note body.

## How it works

1. Run **Generate knowledge note** from the Obsidian command palette.
2. Paste a YouTube video or playlist URL. Multiple URLs are supported.
3. Choose transcript-only or AI-generated output.
4. Pick a built-in template or provide manual instructions.
5. Send the result to the current note, append to the active note, or create new notes in a folder.

The generation modal starts with a **Quick setup** area for the choices most likely to change per run, plus advanced tabs for per-run overrides. The settings tab stores defaults for output, transcript behavior, AI providers, templates, and queue/run-report preferences.

See [Usage](docs/usage.md) and [Configuration](docs/configuration.md) for the full behavior reference.

## Install

The plugin is not currently in the Obsidian Community Plugins directory. It requires Obsidian 1.6.6 or newer.

### BRAT

Add `aawhb/ytkn` to BRAT to install and update from GitHub.

### Manual install

1. Download `ytkn.zip` from the latest [release](https://github.com/aawhb/ytkn/releases).
2. Extract it so `main.js`, `manifest.json`, and `styles.css` are directly inside `.obsidian/plugins/ytkn/` in your vault.
3. Reload Obsidian and enable **YouTube Knowledge Notes**.

You can also download the individual `manifest.json`, `main.js`, and `styles.css` release assets manually:

1. Download the three files from the latest [release](https://github.com/aawhb/ytkn/releases).
2. Create `.obsidian/plugins/ytkn/` inside your vault.
3. Copy the three files into that folder.
4. Reload Obsidian and enable **YouTube Knowledge Notes**.

## Quick start

1. Open **Settings → YouTube Knowledge Notes**.
2. Optional: add an AI provider and select a default model in the **GenAI** tab.
3. Open any Markdown note.
4. Run **Generate knowledge note**.
5. Paste a YouTube video or playlist URL.
6. Choose a template, transcript mode, and output destination.
7. Click **Generate**.

## Common workflows

### Transcript-only notes

Turn off **Generate AI summary** and choose a transcript mode other than `Off`. This works without any API key.

### Media embeds

Choose whether generated notes embed the YouTube video, show the thumbnail image, or omit media entirely.

### AI-generated knowledge notes

Leave **Generate AI summary** enabled and choose a model. The note body is produced from either a built-in template or your own manual instructions.

### Local models

Use an OpenAI-compatible provider with endpoints such as `http://localhost:11434/v1` for Ollama, LM Studio, Llama-Swap, or similar local model servers.
ytkn sends generation requests to local model servers through the standard OpenAI-compatible `/v1/chat/completions` endpoint.

### Playlists

Playlist URLs can generate one note per video or one combined playlist note. Combined playlist notes require AI summary generation; per-video playlist notes work with AI or transcript-only output.

## Templates at a glance

Templates represent knowledge jobs: the answer to “what am I trying to do with this video?”

| Template | Best for |
| --- | --- |
| General knowledge note | Balanced summary, takeaways, applications, and limits |
| Study notes | Recall-friendly notes with prerequisites, concepts, walkthrough, and self-test |
| Implementation note | Concrete steps, tools, code, gotchas, and action items |
| Deep dive | Permanent topic notes with mental models and common confusions |
| Full extract | Exhaustive capture of claims, examples, tools, people, sources, numbers, and quotes |
| Research dossier | Claims, evidence strength, missing information, and follow-up sources |

Some templates expose runtime controls such as learner level, extraction density, research inquiry, or epistemic strictness. See [Templates](docs/templates.md) for details.

## Documentation

- [Usage](docs/usage.md) — commands, generation flow, multiple URLs, playlists, run reports, and cancellation.
- [Configuration](docs/configuration.md) — output destinations, frontmatter, transcript settings, AI settings, and note shape.
- [Templates](docs/templates.md) — built-in template purposes, renderer guarantees, and runtime controls.
- [Contributing](CONTRIBUTING.md) — local development, verification, and release process.

## Privacy and security

- API keys are stored locally in the plugin's `data.json` inside your vault.
- The plugin does not proxy requests through a separate service and does not collect telemetry.
- YouTube data is fetched from public web pages and unofficial endpoints, which may change over time.
- Transcript and AI requests go directly from Obsidian to YouTube and the providers you configure.
- AI output is written into Markdown notes as returned; review generated content if trust matters.

## FAQ

### Can I use the plugin without an API key?

Yes. Turn off AI summary generation and keep a transcript mode enabled.

### Where are API keys stored?

In the plugin's `data.json` inside your vault. They are local to the vault and not encrypted by the plugin.

### What happens if a video has no captions?

- For a single video, the run fails with a clear message.
- For playlists, behavior depends on the transcript failure setting.

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

Set `OBSIDIAN_VAULT_PATH` in `.env` (see `.env.example`) to your Obsidian vault root. `npm run sync` copies `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/ytkn`, then attempts to reload the plugin with Obsidian CLI from that vault using `obsidian plugin:reload id=ytkn`.

Sync reload modes:

- `OBSIDIAN_SYNC_RELOAD=none` copies files without asking Obsidian to reload.
- `OBSIDIAN_SYNC_RELOAD=app` runs `obsidian reload` instead of the faster plugin-only reload.

```bash
npm run sync
```

## Inspiration

- [notebook-navigator](https://github.com/johansan/notebook-navigator) for settings layout patterns.
- [obsidian-yt-video-summarizer](https://github.com/mbramani/obsidian-yt-video-summarizer) for YouTube transcript fetching.

## License

MIT — see [LICENSE](LICENSE).
