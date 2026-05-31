# Changelog

## 1.7.0 - 2026-05-30

### New

- Metadata-only notes can now be generated with AI off and transcript inclusion off.
- Video frontmatter can include `thumbnailUrl`, `videoDescription`, `channelId`, `durationSeconds`, and `keywords`.
- Use AI now acts as the master switch for AI summary, mindmap, and memorable quote generation.

### Improved

- Run reports now count videos inside playlists instead of only the submitted playlist URL.
- Captionless videos can still produce useful source and metadata notes in metadata-only mode.

### Fixed

- Playlists with more than 100 videos now continue through nested YouTube continuation tokens.
- Turning off AI no longer applies AI template tags or hidden AI section warnings.
