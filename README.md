<p align="center">
  <img src="docs/assets/ytkn-logo.svg" width="96" height="96" alt="YT Knowledge Notes logo">
</p>

<h1 align="center">YT Knowledge Notes</h1>

[![Quality](https://github.com/aawhb/ytkn/actions/workflows/quality.yml/badge.svg)](https://github.com/aawhb/ytkn/actions/workflows/quality.yml)
[![CodeQL](https://github.com/aawhb/ytkn/actions/workflows/codeql.yml/badge.svg)](https://github.com/aawhb/ytkn/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/aawhb/ytkn/badge)](https://scorecard.dev/viewer/?uri=github.com/aawhb/ytkn)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

YT Knowledge Notes turns YouTube videos, playlists, and channels into organized Markdown notes in Obsidian. Use it for a clean transcript and source record, an AI-assisted knowledge note, or both.

## What you can create

- Source notes with video details and a readable or timestamped transcript
- AI-assisted notes for studying, research, implementation, or general reference
- Optional TL;DR callouts, Mermaid mind maps, and memorable quotes
- One note per video or one combined note for a playlist or channel selection
- Multiple notes from a queued batch of URLs
- Optional opening of the first generated Folder note in a new tab

AI is optional. Transcript and metadata notes do not require an API key.

## Install

YT Knowledge Notes requires Obsidian `1.13.1` or newer.

### Community Plugins

1. Open **Settings → Community plugins** in Obsidian.
2. Search for **YT Knowledge Notes**.
3. Select **Install**, then **Enable**.

### BRAT

Install and enable BRAT, then add `aawhb/ytkn` as a beta plugin. See [Getting started](docs/getting-started.md#install-with-brat) for the full steps.

For a manual installation from a release, see [Install manually](docs/getting-started.md#install-manually).

## Create your first note

1. Open the Obsidian command palette and run **YT Knowledge Notes: Generate**.
2. Paste a YouTube video, playlist, or channel URL.
3. If you have not configured an AI model, turn **AI** off.
4. Choose where the note should go and how the transcript should appear.
5. Select **Generate**.

For a guided first run, including optional AI setup, see [Getting started](docs/getting-started.md).

## User guide

- [Getting started](docs/getting-started.md): install the plugin and create your first note
- [Using YT Knowledge Notes](docs/usage.md): choose note content, destinations, templates, playlists, queue behavior, and reports
- [AI providers and local models](docs/providers.md): connect OpenAI, Anthropic, Gemini, Ollama, or another compatible service
- [Troubleshooting](docs/troubleshooting.md): solve common transcript, provider, playlist, and output problems

## Privacy

- The plugin does not collect telemetry.
- YouTube requests go directly from Obsidian to YouTube.
- AI requests go directly from Obsidian to the provider or local server you configure. They include transcript content, your instructions, and the prompt context needed to create the selected note body and add-ons.
- API keys are stored through Obsidian SecretStorage. The plugin stores only the selected secret IDs.
- AI content can be inaccurate. Review generated notes when accuracy matters.

See [SECURITY.md](SECURITY.md) for security reporting and more information about data handling.

## Help and feedback

- [Report a bug](https://github.com/aawhb/ytkn/issues/new?template=bug_report.yml)
- [Request a feature](https://github.com/aawhb/ytkn/issues/new?template=feature_request.yml)
- [Contribute to the plugin](CONTRIBUTING.md)

## License

GNU GPL v3 or later. See [LICENSE](LICENSE).
