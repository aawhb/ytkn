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

## Pull Requests

- Keep changes focused.
- Add or update tests for behavior changes.
- Run the verification commands in the PR template.
- Do not commit `main.js`, sourcemaps, `.env`, vault data, or `node_modules`.
