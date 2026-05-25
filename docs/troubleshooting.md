# Troubleshooting

## I do not want to use AI at all

You can use YT Knowledge Notes without any provider or API key.

To do that:

1. Turn **AI summary** off.
2. Keep transcript mode set to **Readable** or **Timestamped**.
3. Generate the note.

## A video has no transcript

Some YouTube videos do not expose captions, or only expose captions in ways the plugin cannot fetch.

Try these checks:

- switch transcript language back to **Auto-detect best available**
- try a different video to confirm it is not a wider provider or network issue
- for playlists, decide whether transcript failures should **Skip and keep going** or **Stop the whole run**

Behavior to expect:

- single-video runs fail with a clear message
- playlist runs either skip or stop, depending on your setting

## A combined playlist note will not start

Combined playlist notes require AI summary generation.

If you want a transcript-only playlist workflow, switch playlist handling to **Per video** instead.

## My local model or provider will not connect

Check the basics first:

- make sure the server is actually running
- confirm the endpoint URL is correct
- for OpenAI-compatible servers, make sure the URL shape matches what the server expects, often ending in `/v1`
- fetch models if the endpoint supports discovery
- if discovery does not work, add the model manually
- increase the timeout for slower local models
- if the provider requires an API key, confirm that the secret is selected in settings

If the provider works for small requests but not large ones, try a shorter transcript, a shorter template, or a longer timeout.

## My batch was rejected before it started

Common reasons:

- one or more URLs in the batch are not recognized as valid YouTube links
- you selected **Insert at caret** or **Append to active note** without an open Markdown note
- the batch includes playlist URLs with **Per video** mode while targeting the current note or append mode

Helpful reminders:

- one invalid URL rejects the whole batch
- duplicates are removed automatically
- multiple URLs to the current note append sequentially to the same snapshotted note

## The note shape is not what I expected

Try adjusting the note shape before changing models.

Good first fixes:

- switch to a different template
- change transcript mode
- turn media embeds on or off
- change source metadata position
- trim the frontmatter allowlist
- switch from manual instructions back to a built-in template if the output became inconsistent

Also remember that **Append to active note** writes a fragment, not a standalone note, so it does not include frontmatter and uses lower heading levels.

## Requests time out or feel slow

Long transcripts, combined playlists, and detail-heavy templates can take noticeably longer.

Things to try:

- increase the request timeout
- try a faster model
- use transcript-only mode when you only need source notes
- use a lighter template before moving to a larger or more expensive model

## Where are API keys stored?

API keys are stored through Obsidian SecretStorage.

The plugin's own data file stores only secret IDs, not raw keys.

YT Knowledge Notes also:

- does not proxy requests through a separate service
- does not collect telemetry

See [SECURITY.md](../SECURITY.md) for the full policy.

## Still stuck

If you open an issue, include:

- plugin version
- Obsidian version and platform
- provider type, if relevant
- the steps to reproduce the problem
- any error message that appears in Obsidian

Do **not** include API keys, vault contents, or private transcripts in public issues.

For security issues, use the private reporting flow described in [SECURITY.md](../SECURITY.md).
