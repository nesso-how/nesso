# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for published releases (npm `package.json` and Tauri `tauri.conf.json`).

## [Unreleased]

### Added

- Keyboard shortcuts dialog (`ShortcutsDialog`): open with **?** or the keyboard icon in the top bar; Escape closes overlays including this dialog.
- **Graph I/O:** export current graph as JSON from the top bar; import creates a new graph from a Nesso JSON file (`importGraph` in the store).

### Changed

- **TopBar:** centered pill keeps brand, graph switcher, and search placeholder; review, theme, and shortcuts moved to a top-right pill.
- **Shortcuts:** **?** no longer toggles the relation-types panel (use the bottom-dock legend control or Edge legend UI instead).

### Fixed

- **ConceptNode:** inline rename keeps a stable width via a hidden-measure span and overlay input; confidence underline hides while editing.

## [0.1.0-alpha.2] - 2026-05-05

### Added

- Keep a Changelog–style `CHANGELOG.md`; GitHub Releases use the matching version section as the release description.

### Changed

- CI desktop builds are **macOS only** (Apple silicon and Intel); Linux and Windows release jobs removed for now.
- GitHub Actions: `actions/checkout` v6, `actions/setup-node` v6, `actions/cache` v5 (Node 24–ready action runtimes).
- Cursor rule `changelog.mdc`: document updating `## [Unreleased]` when committing directly on `main`.

### Fixed

- **Desktop:** `DockBtn` supports a `title` attribute (fixes TypeScript build for Tauri `beforeBuildCommand`).
- **Tooling:** portable pnpm via root `.npmrc` (`store-dir=.pnpm-store`); removed committed machine-specific `pnpm-workspace.yaml` store path that broke CI.
- **CI:** install pnpm with Corepack (no `pnpm/action-setup` / `packageManager` clash); run `actions/cache` after Corepack so `pnpm store path` works; `tauri-action` input `includeUpdaterJson` replaces deprecated `uploadUpdaterJson`.

## [0.1.0-alpha.1] - 2026-05-05

### Added

- Initial alpha: interactive knowledge graph (web + Tauri v2); desktop installers on GitHub Releases (macOS Apple silicon and Intel).

[Unreleased]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.2...HEAD
[0.1.0-alpha.2]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/cedoor/nesso/releases/tag/v0.1.0-alpha.1
