# Security Policy

## Supported Versions

Security fixes are made against the latest published GitHub release.

## Reporting a Vulnerability

Please report security issues privately by emailing the maintainer or by opening a private GitHub vulnerability report if the repository has that feature enabled.

Do not include API keys, vault contents, or private transcripts in public issues. A useful report includes:

- Plugin version
- Obsidian version and platform
- Steps to reproduce
- Impact
- Any relevant console errors with secrets removed

## Privacy Notes

YouTube Knowledge Notes stores provider API keys in the plugin `data.json` file inside your local vault. The plugin does not encrypt this file, proxy requests through a server, or collect telemetry.
