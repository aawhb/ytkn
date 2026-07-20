# Changelog

## 1.8.0 - 2026-07-19

### New

- Support for Youtube channels. Create notes from videos, Shorts, and stream replays by providing a channel link and selecting one or more channel content type.
- AI requests can now switch automatically between models using an ordered list that keeps the successful fallback for the rest of the run.
- A toggle for Folder runs that opens the generated note in a new tab and the first generated note for a playlist run.

### Improved

- The generation queue now has clearer status cards, accessible controls, and bounded recent history.
- Clearer Settings and generation copy.
- Plugin Documentation

### Fixed

- AI requests now use mobile-safe native transport.
- Queued writes to the current note now stop safely if the note changed while the run was waiting.
- A run-report write failure no longer prevents later queued runs from starting.
- Provider errors shown in note progress blocks are bounded and escaped before Markdown rendering.

## 1.7.2 - 2026-06-02

### New

- TL;DR callouts can now be generated independently from the full AI summary, including TL;DR-only notes.
- Combined playlist mode now supports transcript-only notes without AI.
- Video frontmatter can include `uploadDate` and `videoCategory` when available from YouTube metadata.

### Improved

- Combined playlist source lists now link video channel names when YouTube provides channel metadata.

### Fixed

- Combined playlist video embeds now use the first playlist video instead of rendering a broken playlist URL embed.
- Combined playlist thumbnail mode now uses the first video thumbnail instead of omitting media.
- Transcript text is now escaped before Markdown rendering so caption tokens like `<unk>` no longer break transcript callouts.

## 1.7.1 - 2026-06-01

### Fixed

- Playlist generation on mobile devices
- Mobile branding

## 1.7.0 - 2026-05-31

### New

- Existing installs now get an in-plugin recent updates modal for this release.
- The generation modal and settings tab now include quick access to the queue for long-running batches.
- Metadata-only notes can now be generated with AI off and transcript inclusion off.
- Video frontmatter can include `thumbnailUrl`, `videoDescription`, `channelId`, `durationSeconds`, and `keywords`.
- A new "Use AI" master switch to turn off AI summary, mindmap, and memorable quote generation.

### Improved

- Run reports now count videos inside playlists instead of only the submitted playlist URL.
- Captionless videos can still produce useful source and metadata notes in metadata-only mode.
- AI provider settings now use simpler provider cards with plain provider/model summaries and standard model action buttons.
- Settings and generation-modal copy now share one source of truth for more consistent labels, descriptions, and dropdown options.
- Plugin commands use shorter labels: **Generate** and **Cancel all queued**.

### Fixed

- Playlists with more than 100 videos now continue through nested YouTube continuation tokens.
- Turning off AI no longer applies AI template tags or hidden AI section warnings.

### Maintenance

- Added coverage reporting, focused provider/notification helper tests, and maintainer development conventions for safer future releases.
