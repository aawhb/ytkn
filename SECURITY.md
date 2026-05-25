# Security Policy

## Supported Versions

Security fixes are made against the latest published GitHub release.

## Private Reporting Channels

Please report vulnerabilities privately through GitHub's private vulnerability reporting flow:

- [GitHub private vulnerability reporting](https://github.com/aawhb/ytkn/security/advisories/new)

Do not open a public issue for a vulnerability before coordinated disclosure.

## Reporting a Vulnerability

Please include enough detail for the maintainer to reproduce, assess, and disclose the issue safely. A useful report includes:

- plugin version
- Obsidian version and platform
- steps to reproduce
- expected impact
- any relevant console errors with secrets removed

## Disclosure and Response Expectations

The maintainer aims to:

- acknowledge new vulnerability reports within 7 days
- share a status update at least every 30 days while a report is open
- coordinate public disclosure after a fix is available, or within 90 days when that is not possible

Do not include API keys, vault contents, or private transcripts in public issues or vulnerability reports.

## Privacy Notes

YT Knowledge Notes stores provider API keys through Obsidian SecretStorage. The plugin `data.json` file stores only per-provider secret IDs. The plugin does not proxy requests through a server or collect telemetry.
