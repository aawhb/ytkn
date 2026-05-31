# Changelog

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
