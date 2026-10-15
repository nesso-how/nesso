# Changelog

## 1.0.0-alpha.18 — 2026-10-15

### Features

- **inspector:** Auto-grow concept description textarea

## 1.0.0-alpha.17 — 2026-10-15

### Features

- **concept:** Add color picker with multi-select and seed colors

## 1.0.0-alpha.16 — 2026-10-14

### Features

- **app:** Delete shared concepts with view
- **plugin:** Route full-view delete to view dialog
- **concept-map:** Link creation to selection and confirm full delete
- **plugin:** Cap concept label length in renderer
- **app:** Pass concept label limit to renderer
- **concept-map:** Edit concept labels inline

## 1.0.0-alpha.15 — 2026-10-13

### Documentation

- **ai:** Require paid plan for chatgpt sign-in

### Features

- **intro:** Preview the real inspector without writes
- **concept-map:** Reveal the rest of the graph as context
- **chat:** Apply AI edits directly with undo and summaries

### Fixes

- **app:** Keep unsaved-changes handling during the intro
- **i18n:** Capitalize the preview label in English
- **concept-map:** Block concept creation when interactions are locked
- **export:** Notify only after save picker confirms download
- **concept-map:** Ease out graph framing in intro

## 1.0.0-alpha.14 — 2026-10-12

### Features

- **i18n:** Add simplified chinese and localized seeds
- **site:** Add localized pages and language detection
- **intro:** Add guided introduction and About page
- **concepts:** Add optional descriptions
- **seed:** Add concept descriptions in en, it, zh

### Fixes

- **graph:** Preserve parallel relations through import and restore
- **site:** Reduce flicker when switching languages
- **site:** Inline styles to prevent unstyled graph flashes
- **i18n:** Correct Italian and Chinese translations
- **i18n:** Polish italian and chinese copy
- **assets:** Adapt favicon to browser color scheme
- **app:** Capitalize tab title

## 1.0.0-alpha.13 — 2026-10-12

### Features

- **i18n:** Add simplified chinese and localized seeds (#195)
- **concept-map:** Add copy, cut and paste actions

## 1.0.0-alpha.12 — 2026-10-12

### Documentation

- **readme:** Trim header badges and use app icon

### Features

- **inspector:** Remember active tab and default to details
- **data:** Move local data directory without restart

### Fixes

- **inspector:** Persist inspector open state

## 1.0.0-alpha.11 — 2026-10-11

### Features

- **persistence:** Use indexeddb on web and files on desktop

## 1.0.0-alpha.10 — 2026-10-10

### Fixes

- **release:** Exclude build tooling from universal mac app

## 1.0.0-alpha.9 — 2026-10-10

### Documentation

- **readme:** Clarify desktop app and web demo

### Features

- **release:** Generate changelog and shared release notes
- **downloads:** Detect platform and build universal mac app
- **site:** Add llms documentation index

Release notes are generated from Conventional Commits by `pnpm release`.
