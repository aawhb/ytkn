# CSS selector inventory

This inventory records the current ownership and cleanup status of plugin CSS selectors. It exists to keep CSS maintenance behavior-preserving: verify ownership before moving, renaming, or deleting selectors.

## Guardrails

- Do not rename existing selectors during routine cleanup; intentional migrations must update source, tests, and this inventory together.
- Treat Obsidian/theme classes as external dependencies even when they do not appear in source.
- Treat generated classes such as queue outcome badges as used when they are assembled dynamically.
- Move CSS in small chunks and validate with tests plus manual UI review when visual cascade could change.

## Owner map

| Area | Selector families | Owners |
| --- | --- | --- |
| Root/tokens | `.ytkn`, `.ytkn-settings`, `.ytkn-modal`, `.ytkn-queue-modal` | Shared stylesheet roots and CSS custom properties |
| Form controls | `.ytkn-form__input` | Shared text/textarea styling for provider forms, generation modal fields, and template controls |
| Status bar | `.ytkn-status-bar--clickable` | Status bar queue affordance in `src/main.ts` |
| Generic cards | `.ytkn-card`, `.ytkn-card__title`, `.ytkn-card__body` | `createSettingsCard` in `src/ui/components/SettingsUIComponents.ts` |
| Settings shell | `.ytkn-settings*` | `src/ui/settings.ts`, `SettingsUIComponents`, settings modals |
| Provider accordions/models | `.ytkn-settings__provider-*`, `.ytkn-settings__models-*`, `.setting-model` | `SettingsUIComponents`, `SettingsEventHandlers` |
| Setting row layout | `.ytkn-setting-row--*` | `src/ui/settingRows.ts`; tests assert these classes |
| Tabs | `.ytkn-tabs*`, `.ytkn-tab*` | `src/ui/components/Tabs.ts` |
| Brand actions | `.ytkn-brand-*` | `src/ui/components/BrandActions.ts`, settings tab, generation modal |
| Generation modal shell | `.ytkn-modal*`, `.ytkn-modal-scroll-container` | `GenerationOptionsModal`, provider form modal |
| Template controls | `.ytkn-control-row*` | `src/ui/components/TemplateControls.ts` |
| Queue modal | `.ytkn-queue-modal*`, `.ytkn-queue__badge*` | `src/ui/modals/QueueModal.ts` |
| What's new modal | `.ytkn-whats-new-modal*` | `src/ui/modals/WhatsNewModal.ts` |
| Obsidian bridges | `.modal`, `.modal-content`, `.mod-settings`, `.mod-toggle`, `.is-phone` | Obsidian/theme-provided classes referenced by scoped compatibility rules |

## Dynamic or external selectors to keep

These may not appear as exact string literals in source but are intentionally used:

- `.ytkn-queue__badge--completed`, `.ytkn-queue__badge--failed`, `.ytkn-queue__badge--canceled`, `.ytkn-queue__badge--skipped`: created from `entry.outcome` in `QueueModal`.
- `.is-phone`, `.modal`, `.modal-content`, `.mod-settings`, `.mod-toggle`: Obsidian/theme classes.
- `.clickable-icon`, `.setting-item`, `.setting-item-info`, `.setting-item-name`, `.setting-item-description`, `.setting-item-control`: Obsidian setting DOM classes.

## Renamed or removed in cleanup

Plugin-owned selectors intentionally renamed or removed from `styles.css`:

- `.ytkn__input` (renamed to `.ytkn-form__input`)
- `.ytkn__status-bar--clickable` (renamed to `.ytkn-status-bar--clickable`)

- `.ytkn__actions`
- `.ytkn__button`
- `.ytkn__button--primary`
- `.ytkn__button--danger`
- `.ytkn-settings__subsection-title`

Verification method: searched `src/**`, `test/**`, and docs for exact class references, then ran targeted UI tests and the full gate after the cleanup slice.
