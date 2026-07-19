# AI providers and local models

You do not need an AI provider for transcript, metadata, or source notes. Connect a provider only if you want an AI-generated note body, TL;DR callout, mind map, or memorable quotes.

## Basic setup

1. Open **Settings → YT Knowledge Notes**.
2. Open the **AI** tab.
3. Select **Add provider**.
4. Choose the provider type and enter a name.
5. Create or select an Obsidian secret for the API key when one is required.
6. Save the provider.
7. Select **Fetch models**, or use **Add model** if discovery is unavailable.
8. Choose the model you want to use by default.

You can configure more than one provider and choose a different model for an individual generation.

## Create and select an API key secret

The **API key** control uses Obsidian's built-in secret storage. It lets you select an existing secret or create one without saving the key in the plugin's settings file.

1. Get an API key from your provider.
2. In the **Add AI provider** window, open the **API key** control.
3. Choose the option to create a new secret.
4. Give the secret a recognizable name, such as `openai-api-key`.
5. Paste the API key as the secret value and save it.
6. Make sure the new secret is selected in the **API key** control.
7. Save the provider.

You can select the same secret again when editing the provider. Obsidian also lets other plugins use that secret if you choose it in their settings.

## Choose the correct provider type

### OpenAI

Choose **OpenAI** for models accessed through OpenAI's official API.

You need:

- an OpenAI API key stored as an Obsidian secret
- a model fetched from the provider or added manually

The OpenAI provider always uses OpenAI's standard service. It does not show a custom URL field.

### Anthropic

Choose **Anthropic** for Claude models accessed through Anthropic's official API.

You need:

- an Anthropic API key stored as an Obsidian secret
- a model fetched from the provider or added manually

The Anthropic provider uses Anthropic's standard service and does not accept a custom URL.

### Gemini

Choose **Gemini** for models accessed through Google's Gemini API.

You need:

- a Gemini API key stored as an Obsidian secret
- a model fetched from the provider or added manually

Only models that support text generation are listed during model discovery.

### OpenAI-compatible

Choose **OpenAI-compatible** for a local server or another service that implements the OpenAI-style API.

Common examples include:

- Ollama
- LM Studio
- llama.cpp and llama-server
- llama-Swap
- hosted services with compatible model and chat completion endpoints

You need:

- the server URL
- an API key secret if the server requires one
- the exact model ID expected by the server

The default local URL is `http://localhost:11434/v1`. Many compatible servers expect the URL to end in `/v1`, but you should use the URL shown by your server's documentation.

The plugin uses:

- `/models` when you select **Fetch models**
- `/chat/completions` when generating content

If model discovery fails but generation is supported, use **Add model** and enter the exact model ID manually.

## Set up Ollama

1. Install and start Ollama.
2. Make sure the model you want is available in Ollama.
3. Add an **OpenAI-compatible** provider in YT Knowledge Notes.
4. Use `http://localhost:11434/v1` unless your Ollama setup uses another address.
5. Leave the API key empty unless your setup requires authentication.
6. Select **Fetch models**.
7. If the model does not appear, add its exact Ollama name manually, such as `qwen3.5:4b`.
8. Choose the model as your default.

Local models can take longer than hosted services. Increase **Request timeout (seconds)** when needed.

## Local servers on mobile

On a phone or tablet, `localhost` means the mobile device itself. It does not point to Ollama or another server running on your computer.

To use a server on another device:

1. Make the server reachable from the mobile device.
2. Use the computer's network address instead of `localhost`.
3. Follow the server's security and authentication guidance before exposing it to a network.

If you do not intend to make the local server reachable from mobile, use transcript-only notes on mobile or choose a hosted provider.

## Model selection and context size

Use **Fetch models** when the provider supports it. Use **Add model** when:

- discovery is unavailable
- the provider hides a model from its model list
- you need to enter a local model ID exactly

When adding a model manually, you can provide its context window if you know it. A correct context window helps the plugin decide when a long transcript needs to be split into multiple requests.

For long videos or combined playlists, choose a model with enough context or use a lighter template.

## Secrets and privacy

API keys are stored through Obsidian SecretStorage. YT Knowledge Notes stores the selected secret ID, not the raw key, in its plugin settings.

Requests go directly from Obsidian to the provider or local server you configure. They include transcript content, custom instructions, and the prompt context needed for the selected note body and add-ons. The plugin does not proxy AI traffic and does not collect telemetry.

Canceling or timing out an AI request stops the plugin from waiting for it. Obsidian cannot cancel a native request that has already started, so the provider may still finish processing it and may still charge for it. The plugin does not automatically retry provider requests; if a model fails, the configured fallback model chain can continue instead.

See [SECURITY.md](../SECURITY.md) for security reporting and more information about data handling.

## If setup does not work

See [Troubleshooting](troubleshooting.md#my-provider-or-model-will-not-connect) for connection checks, model discovery help, mobile guidance, and timeout suggestions.
