# Contributing

Thanks for helping improve YouTube Knowledge Notes.

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

## Releases

Releases are published by GitHub Actions from version tags in `x.y.z` format (no `v` prefix).

1. Update version files:

   ```bash
   npm run release:prep -- 1.2.3
   ```

2. Review the changes to `manifest.json`, `package.json`, and `versions.json`.
3. Run the full verification gate:

   ```bash
   npm run verify
   ```

4. Commit the version bump.
5. Create a matching tag:

   ```bash
   git tag 1.2.3
   ```

6. Push `main` and the tag.

The release workflow will verify that the tag, `manifest.json`, `package.json`, and `versions.json` all match before it publishes the GitHub release assets.

## Pull Requests

- Keep changes focused.
- Add or update tests for behavior changes.
- Run the verification commands in the PR template.
- Do not commit `main.js`, sourcemaps, `.env`, vault data, or `node_modules`.
