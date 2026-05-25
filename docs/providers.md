# Providers and local models

Transcript-only notes do not need any provider at all. If you want AI-assisted notes, add a provider and choose a model in **Settings → YT Knowledge Notes → GenAI**.

## How provider setup works

1. Add a provider family.
2. Store or select its API key through Obsidian SecretStorage if the provider requires one.
3. Fetch models from the provider, or add a model manually.
4. Pick a default model in settings, or override the model per run.

You can keep more than one provider configured at the same time.

## Supported provider families

### OpenAI

Use this for OpenAI-hosted models.

- requires an API key
- can fetch available models from the OpenAI API
- works well when you want a cloud-hosted default

### Anthropic

Use this for Claude models.

- requires an API key
- can fetch available models from Anthropic
- a good fit when you want strong long-form synthesis or research-style notes

### Gemini

Use this for Google Gemini models.

- requires an API key
- can fetch models that support text generation
- useful if Gemini already fits your broader workflow or pricing

### OpenAI-compatible

Use this for local model servers or third-party endpoints that expose the OpenAI-style API.

Common examples include:

- Ollama
- LM Studio
- llama.cpp, llama-server, llama-Swap
- hosted providers that expose a compatible API

Notes for compatible endpoints:

- the local default is `http://localhost:11434/v1`
- API keys are optional for some local servers and required for some hosted ones
- model discovery uses the provider's `/models` endpoint when available
- generation uses the OpenAI-compatible chat completions endpoint

If model discovery fails but the server itself works, add the model manually and keep using it.

## Local model tips

If you want AI help without sending prompts to a cloud provider, point an OpenAI-compatible provider at a local server.

A good starting checklist:

1. Start the local server first.
2. Confirm the endpoint URL ends in `/v1` if the server expects that shape.
3. Fetch models if the server supports discovery.
4. If discovery is unavailable, enter the model name manually.
5. Choose a longer timeout for slower local models.

## Choosing a model

A few practical guidelines:

- use transcript-only output when you only need a reliable source note
- use a smaller or faster model for quick capture
- use a stronger model for deep dives, research dossiers, or combined playlist notes
- if a note style is too verbose, try a different template before blaming the model

## Privacy and data flow

YT Knowledge Notes does not proxy your requests through a separate service.

That means:

- transcript and playlist metadata requests go directly from Obsidian to YouTube
- AI requests go directly from Obsidian to the provider or local endpoint you configure
- API keys are stored in Obsidian SecretStorage
- the plugin stores only secret IDs in its own data file
- the plugin does not collect telemetry

For security reporting and privacy notes, see [SECURITY.md](../SECURITY.md).

## Next steps

- [Getting started](getting-started.md) if you have not generated a note yet
- [Workflows](usage.md) for batching, playlists, and queue behavior
- [Troubleshooting](troubleshooting.md) if a provider or local model will not connect
