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

## Maintenance conventions

- Keep cleanup behavior-preserving unless the behavior change is intentional and tested.
- Add or update focused tests before refactoring modules that lack direct coverage.
- Do not rename persisted settings keys, manifest command IDs, provider/model IDs, CSS selectors, or generated note structures without an explicit migration plan.
- Keep shared settings/modal labels, descriptions, placeholders, and option labels in `src/ui/shared/settingCopy.ts`.
- Keep comments that explain Obsidian quirks, provider limitations, migrations, cancellation semantics, or generated-note invariants; remove comments that only narrate the code.
- Keep the plugin mobile-safe while `manifest.json` has `isDesktopOnly: false`; do not introduce Node or Electron-only APIs.
- Check modal changes at desktop width and at 720 px or narrower by resizing the Obsidian window. Confirm labels wrap without clipping, rows stack, and every action remains keyboard reachable.
- Normalize user-configured vault paths with Obsidian `normalizePath()` before trimming root slashes.
- Use Obsidian `requestUrl` for provider completion and discovery requests. It is available on desktop and mobile, but cannot cancel an already-started native request.
- Use `Vault.process()` for asynchronous note writes that require atomic updates. Use editor APIs for immediate active-editor changes.
- Treat dynamically generated CSS classes and Obsidian-provided classes as used even when an exact class name does not appear in TypeScript. Verify source, tests, `styles.css`, and runtime ownership before removing a selector.
- Keep `styles.css` grouped by shared UI, settings, generation, queue, release notes, Obsidian compatibility rules, and media queries so cascade-sensitive changes remain reviewable.

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

The release workflow verifies that the tag, `manifest.json`, `package.json`, `versions.json`, `CHANGELOG.md`, and bundled release notes all match. It publishes the installable `main.js`, `manifest.json`, and `styles.css` files and generates artifact attestations for them.

## Pull Requests

- Keep changes focused.
- Add or update tests for behavior changes.
- Run the verification commands in the PR template.
- Do not commit `main.js`, sourcemaps, `.env`, vault data, or `node_modules`.
