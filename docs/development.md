# Development conventions

This document captures maintainer-facing conventions for YT Knowledge Notes. User-facing behavior belongs in the README and feature docs; this page is for safe changes to the codebase itself.

## North star

- Preserve plugin behavior unless a change is explicitly intended and tested.
- Prefer consistency, locality, and small verifiable slices over broad churn.
- Rename persisted settings keys, manifest command IDs, provider/model IDs, CSS selectors, or generated note structures only with an explicit migration plan.
- Delete code only after verifying there are no imports, tests, docs references, or Obsidian runtime dependencies.

## Module map

- `src/main.ts` owns plugin lifecycle wiring: settings load/save, commands, ribbon/status UI, queue modal, and unload cleanup.
- `src/services/` owns domain behavior: generation orchestration, prompt building, rendering, settings persistence, queueing, progress, YouTube parsing, and provider adapters.
- `src/services/providers/` isolates provider-specific API details behind shared provider interfaces.
- `src/services/templates/` owns note template definitions, template extraction, and frontmatter merging helpers.
- `src/ui/` owns Obsidian DOM rendering, settings UI, modals, notifications, and UI event handlers.
- `src/ui/components/` owns reusable DOM helpers and small UI components.
- `test/services/`, `test/providers/`, `test/ui/`, `test/templates/`, `test/renderer/`, and `test/properties/` mirror source seams; root-level tests are reserved for repo metadata, lifecycle, release notes, and shared utilities.

## Naming defaults

Use these prefixes consistently when adding or renaming code:

- `build*` for pure value or object construction.
- `create*` for DOM nodes, class instances, or side-effectful construction.
- `resolve*` for lookup or derivation from multiple inputs.
- `normalize*` for coercion, defaulting, and shape cleanup.
- `render*` for Markdown or DOM output.
- `handle*` for event-handler entry points.
- `validate*` for invariant checks that can reject input.

Use camelCase for TypeScript source and test filenames. Keep persisted/user-facing IDs unchanged when filenames move: template `id` values such as `full-extract` and `deep-dive`, provider IDs, manifest command IDs, and settings keys are compatibility contracts.

## Obsidian API conventions

- Keep the plugin mobile-safe: do not introduce Node/Electron-only APIs while `manifest.json` has `isDesktopOnly: false`.
- Normalize user-configured vault paths with Obsidian `normalizePath()` before trimming root slashes.
- Prefer `requestUrl` for network calls that need Obsidian's adapter behavior. A guarded/browser `fetch` fallback is acceptable for provider-safe discovery or compatible-provider requests when `requestUrl` fails or is unavailable; do not describe the policy as absolute no-`fetch`.
- Keep `Vault.process()` for asynchronous/background note writes that need atomic file updates. Prefer editor APIs only for immediate active-editor edits.
- Existing settings UI is imperative because `minAppVersion` remains `1.11.4`; revisit Obsidian's newer declarative settings API only if the minimum app version is intentionally raised.

## UI copy

Shared settings and generation-modal copy must live in `src/ui/settingCopy.ts`.

- Put shared labels, descriptions, placeholders, and dropdown option labels in `SETTING_COPY`.
- Consume `SETTING_COPY` from `src/ui/settings.ts` and `src/ui/modals/GenerationOptionsModal.ts`.
- Do not introduce context-specific wording for the same semantic setting unless the design decision is documented.
- Update `test/ui/settingCopy.test.ts` when adding or changing shared setting metadata.

## CSS and DOM conventions

- Use [CSS selector inventory](css-selector-inventory.md) when moving, renaming, or deleting stylesheet rules.
- Keep existing selectors stable during routine maintenance cleanup; intentional selector migrations must update `styles.css`, source class stamping, tests, and the selector inventory in one slice.
- Prefer new selectors in the form `.ytkn-<area>__<element>--<modifier>`.
- Treat classes such as `ytkn-setting-row--button` as semantic JS/CSS/test seams unless proven unused across source, tests, and CSS.
- Move CSS in small chunks because ordering can change cascade behavior.
- Keep short comments only for non-obvious Obsidian specificity bridges, theme compatibility, or ordering constraints.

## Comments

Keep comments that explain why something is non-obvious:

- Obsidian platform quirks or DOM/CSS specificity bridges.
- Provider SDK limitations, timeout behavior, or error normalization.
- Data migrations and persisted compatibility.
- Cancellation semantics and generated-note invariants.

Remove comments that merely repeat function names, branch conditions, or obvious assignments.

## Testing expectations

- Add or update tests before refactoring modules that lack direct coverage.
- Prefer focused regression tests around the seam being changed.
- Use DOM tests for Obsidian settings/modals and pure unit tests for services/templates/rendering helpers.
- Use property tests where input-shape variety matters, such as URLs, output normalization, or parsing helpers.
- Before finishing a slice, run the narrow relevant tests first, then the broader quality gate.
- Use `npm run test:coverage` to inspect coverage locally. Do not add coverage thresholds until the current baseline and the highest-value gaps are known.

## Verification checklist

Run these from the repository root for routine changes:

```bash
npm run lint:full
npm run typecheck
npm run test:run
npm run build
```

Use the full local gate before opening a PR, cutting a release, or after cross-cutting cleanup:

```bash
npm run verify
```

Use coverage as an inspection tool when adding tests or planning a coverage gate:

```bash
npm run test:coverage
```

If release metadata changes, also run:

```bash
npm run release:check
```

## Safe-refactor checklist

Before moving, renaming, or deleting code:

1. Capture the current behavior with tests or identify existing tests that lock it.
2. Check imports, tests, docs, CSS selectors, manifest IDs, and persisted settings references.
3. Prefer small helper extraction over broad architecture changes.
4. Avoid generic builders unless repeated behavior, not just repeated text, is being centralized.
5. Run targeted tests after the small change.
6. Run the full gate when the slice is complete.

## Deferred deeper refactors

These ideas need evidence before implementation:

- `GenerationOptions` normalization: introduce a dedicated effective-options module only if repeated option-resolution logic remains hard to test after small local cleanups.
- Target/progress writer seam: extract only when there are at least two real adapters, such as Obsidian vault writes plus a test/fake implementation.
- Split settings interfaces: prefer narrower consumer types only when they remove boilerplate or clarify ownership without changing persisted settings.
- CSS selector renames: handle future renames as separate migration/test passes, not as routine cleanup.
