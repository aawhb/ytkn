# Contributing

Thanks for helping improve YT Knowledge Notes.

## Development

```bash
npm install
npm run lint:full
npm run typecheck
npm run test:run
npm run build
```

Use `npm run dev` for esbuild watch mode during local plugin development. To copy built files into a vault, set `OBSIDIAN_VAULT_PATH` in `.env` and run `npm run sync`.

Use `npm run verify` to run the full local quality gate (lint, typecheck, tests, audit, build) before opening a PR or cutting a release.

Use `npm run test:coverage` when adding tests or evaluating coverage gaps. Coverage thresholds should be introduced only after reviewing the current baseline.

See [Development conventions](docs/development.md) for the module map, naming defaults, UI/CSS conventions, comment policy, safe-refactor checklist, and testing expectations.

## Maintenance conventions

- Keep cleanup behavior-preserving unless the behavior change is intentional and tested.
- Add or update focused tests before refactoring modules that lack direct coverage.
- Do not rename persisted settings keys, manifest command IDs, provider/model IDs, CSS selectors, or generated note structures without an explicit migration plan.
- Keep shared settings/modal labels, descriptions, placeholders, and option labels in `src/ui/settingCopy.ts`.
- Prefer `build*`, `create*`, `resolve*`, `normalize*`, `render*`, `handle*`, and `validate*` prefixes according to the conventions doc.
- Keep comments that explain Obsidian quirks, provider limitations, migrations, cancellation semantics, or generated-note invariants; remove comments that only narrate the code.

## Releases

Releases are published by GitHub Actions from version tags in `x.y.z` format (no `v` prefix).

1. Update version files:

   ```bash
   npm run release:prep -- 1.2.3
   ```

2. Add the same version to `src/releaseNotes.ts` and `CHANGELOG.md`.
3. Review the changes to `manifest.json`, `package.json`, `versions.json`, and release notes.
4. Run the full verification gate:

   ```bash
   npm run verify
   ```

5. Commit the version bump and release notes.
6. Create a matching tag:

   ```bash
   git tag 1.2.3
   ```

7. Push `main` and the tag.

The release workflow will verify that the tag, `manifest.json`, `package.json`, `versions.json`, `CHANGELOG.md`, and bundled release notes all match before it publishes the GitHub release assets. Published releases include the installable plugin files, `ytkn.zip`, `ytkn-release.sha256`, and `ytkn-release.sigstore.json`.

## Pull Requests

- Keep changes focused.
- Add or update tests for behavior changes.
- Run the verification commands in the PR template.
- Do not commit `main.js`, sourcemaps, `.env`, vault data, or `node_modules`.
