# Troubleshooting

Start with the section that matches what you see. Error messages from the plugin usually identify the setting or step that needs attention.

## I want to use the plugin without AI

No provider or API key is required.

1. Run **YT Knowledge Notes: Generate**.
2. Turn **Use AI** off.
3. Set **Transcript in note** to **Readable** or **Timestamped**.
4. Select **Generate**.

For a metadata and source note without transcript text, set **Transcript in note** to **Off** as well.

## Generate says that I need an AI model

Either select a model or turn AI off.

To use AI:

1. Open **Settings → YT Knowledge Notes → AI**.
2. Add a provider.
3. Select or create an API key secret if needed.
4. Fetch or add a model.
5. Choose that model in settings or in the generation window.

To continue without AI, turn **Use AI** off in the generation window.

## A video has no transcript

Some videos do not provide captions that the plugin can retrieve.

Try:

- changing **Transcript language** to **YouTube default**
- trying another video to confirm the problem is limited to one source
- turning **Use AI** off and **Transcript in note** off if you only need metadata and source information
- choosing **Skip and keep going** for playlists when missing transcripts should not stop the rest of the run

A run that needs transcript content cannot continue without a usable transcript. A metadata and source-only run can.

## My provider or model will not connect

Check these items in order:

1. Confirm that the correct provider type is selected.
2. Confirm that the API key secret still exists and is selected.
3. For **OpenAI-compatible**, confirm that the URL is correct and that the server is running.
4. Check whether the server expects the URL to end in `/v1`.
5. Select **Fetch models** again.
6. If discovery is unavailable, add the exact model ID manually.
7. Increase **Request timeout (seconds)** for a slow model or server.

Official OpenAI, Anthropic, and Gemini providers do not accept custom URLs. Use **OpenAI-compatible** only when the service implements the compatible model and chat completion endpoints.

## A local model works on desktop but not mobile

On mobile, `localhost` points to the mobile device, not your computer.

Use the computer's network address and make sure the local server accepts connections from the mobile device. Do not expose a local model server outside a trusted network without following its authentication and security guidance.

See [Local servers on mobile](providers.md#local-servers-on-mobile).

## Model discovery fails, but the server is running

Some services support generation without exposing a usable model list.

1. Open the provider in **Settings → YT Knowledge Notes → AI**.
2. Select **Add model**.
3. Enter the exact model ID expected by the server.
4. Choose the model and try a short video.

If generation also fails, check the URL, API key secret, server logs, and request timeout.

## My submission is rejected before it starts

Common causes include:

- one URL is not recognized as a valid YouTube video, playlist, or channel
- **Current note** or **Append to active note** was selected without an open Markdown note
- **Folder** was selected without a destination folder
- a multi-URL submission contains a per-video playlist or channel while the destination is **Current note** or **Append to active note**
- a per-video playlist uses **Append to active note**
- AI is enabled but no model is selected

One invalid URL rejects the entire submission. Remove or correct it, then submit the batch again.

## A playlist does not go where I expect

For a single playlist using **One note per video**:

- **Current note** puts the first video in the current note and creates adjacent notes for the remaining videos.
- **Folder** creates every video note in the chosen folder.
- **Append to active note** is not supported. Choose **Current note**, **Folder**, or **One combined note**.

For a submission containing multiple URLs, use **Folder** if any playlist uses **Per video**. You can also switch that playlist to **Combined** or submit it separately.

Use **One combined note** when you want one playlist note in the current note, at the end of the active note, or in a folder.

For a smaller note per source video, use **Per video**. For one searchable document, use **Combined**.

Channels follow the same destination rules. If a channel returns fewer items than expected, check its selected content types and per-type limit. Active and upcoming streams are intentionally excluded; completed stream replays are supported.

## The note layout is not what I expected

Check:

- **Output destination**
- **Open created note** when using **Folder**
- **Media embed**
- **Include frontmatter** and **Frontmatter properties**
- **Source metadata position**
- **Transcript in note**
- **AI instructions** and **Content template**
- the TL;DR callout, mind map, and memorable quotes toggles

**Append to active note** creates a fragment. It does not add a new frontmatter block, and it moves generated headings down one level.

If custom instructions produce inconsistent results, try a built-in template. See [Shape AI-assisted notes](usage.md#shape-ai-assisted-notes).

## Requests time out or take too long

Long videos, combined playlists, detailed templates, and local models can take more time.

Try:

- increasing **Request timeout (seconds)**
- using a faster model
- choosing a lighter template
- processing a playlist **Per video** instead of as one combined note
- using transcript-only output when you only need the source material

If you added a model manually, confirm that its context window is correct.

## Cancellation does not immediately stop my local model

Canceling tells YT Knowledge Notes to stop waiting and ignore a late response. A local server or remote provider may continue processing a request that it already received.

Completed notes are kept. Waiting work is removed from the queue, and empty plugin-created notes are cleaned up when possible.

## Where are API keys stored?

API keys are stored through Obsidian SecretStorage. The plugin stores only the selected secret ID in its settings.

If a key stops working, create or update the secret from the provider's **API key** control, then select it again. See [Create and select an API key secret](providers.md#create-and-select-an-api-key-secret).

Do not paste API keys into bug reports or screenshots.

## Report a problem

[Open the bug report form](https://github.com/aawhb/ytkn/issues/new?template=bug_report.yml) and include:

- YT Knowledge Notes version
- Obsidian version
- desktop or mobile platform
- provider type, if relevant
- steps that reproduce the problem
- the complete error message

Do not include API keys, private vault content, or private transcripts.

For a security issue, follow the private reporting instructions in [SECURITY.md](../SECURITY.md).
