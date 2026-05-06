# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for published releases (npm `package.json` and Tauri `tauri.conf.json`).

## [Unreleased]

### Changed

- Relicense from **GNU AGPL v3.0** to **MIT** (`LICENSE`, `package.json`, `src-tauri/Cargo.toml`, SPDX headers in sources, README).
- **WebLLM (local AI):** `App` calls `initWebLLM()` when **Local model** is selected; `MentorBubble` uses `useWebLLM()` to show download/init progress, disable input until the engine is ready, and reset the session while loading.
- **Concept nodes:** Removed **pinned** (`ConceptNodeData.pinned`, seed data, canvas indicator, and Inspector pin control / “drifting” label).

## [0.1.0-alpha.4] - 2026-05-06

### Added

- **Local in-browser AI (WebLLM):** Settings can switch **Remote API** (OpenAI-compatible `fetch`) vs **Local model** (WebGPU via `@mlc-ai/web-llm`, default Qwen2.5 1.5B with download/cache UI). `MentorBubble` uses the loaded MLC engine when `aiMode === 'local'`.
- **Mentor modes** in `MentorBubble`: **Review** (priority queue of low-confidence or stale concepts, rate-and-advance), **Exploration** (free chat with node/edge list + selection context), **Bootstrap** (load a `.txt` / `.md` excerpt for document-grounded discussion). Dynamic system prompt per mode; session reset on graph switch or mode tab change.
- `daysAgo()` helper in `src/types/graph.ts` for deriving “days since review” from `reviewedAt`.
- GitHub Actions workflow **Deploy to GitHub Pages** (push to `main` or manual): builds the Vite app with the correct `base` for project sites (`/<repo>/`) or root user/org pages (`<owner>.github.io`), uploads `dist`, and publishes via **GitHub Actions** Pages.

### Changed

- **Mentor:** Assistant replies render **Markdown** (`marked`) instead of minimal `*italic*` / `_italic_` HTML escaping.
- **README roadmap:** Mark dynamic system prompts / AI multi-mode complete; add items for persisting AI chats and richer output rendering (code blocks, etc.).
- **Concept review field:** `ConceptNodeData.reviewed` (days ago, integer) replaced by `reviewedAt` (Unix ms). Seed data still authors `reviewed` as days in `seedGraph` raw nodes; `makeSeedGraph` converts to timestamps. New nodes use `Date.now()`.
- **Spaced review shortcut:** **R** opens review mode (no Cmd/Ctrl); frees **⌘R** / **Ctrl+R** for the browser refresh habit.

### Fixed

- TopBar review button tooltip and README shortcuts table now match **R** for review mode.

## [0.1.0-alpha.3] - 2026-05-05

### Added

- Provider-agnostic AI: configure any OpenAI-compatible endpoint (Ollama, proprietary APIs, etc.) from the settings dialog (gear icon or **⌘,** / **Ctrl+,**).
- `scripts/license-header.mjs` (+ `pnpm license-headers` / `pnpm license-headers:check`) inserts or verifies one-line `SPDX-License-Identifier` headers from `package.json` `"license"` in `src`/Tauri/HTML/CSS roots.
- Keyboard shortcuts dialog (`ShortcutsDialog`): open with **?** or the keyboard icon in the top bar; Escape closes overlays including this dialog.
- **Graph I/O:** export current graph as JSON from the top bar; import creates a new graph from a Nesso JSON file (`importGraph` in the store).

### Changed

- **Relation types:** reference is a centered modal (`RelationTypesDialog`, same UX as shortcuts/settings), opened from the **lines icon** in the top-right toolbar; removed the persistent left edge-legend strip and persisted `relationTypesPanelOpen`.
- **Bottom dock:** replaces the legend toggle with primary **center** control (fit graph in view); zoom block unchanged.
- **Inspector:** moves to the **left**; graph canvas widens on the left (not right) while a concept or relation is selected.
- **AI:** mentor API key comes only from **Settings** (`aiApiKey`); removed **`VITE_AI_API_KEY`** / `.env.local` fallback.
- **AI defaults:** mentor targets local **Ollama** (`http://localhost:11434/v1`, model `gemma2:2b`) by default; remote endpoints remain configurable in Settings.
- **Auto-save:** graph-change debounce lowered from 800 ms to 500 ms (`useAutoSave`).
- **TopBar:** centered pill keeps brand, graph switcher, and search placeholder; review, theme, and shortcuts moved to a top-right pill.
- **Shortcuts:** **?** no longer toggles relation types (use the relation-types toolbar button).

### Fixed

- **Bottom dock zoom %:** stays in sync with the canvas for scroll/pinch zoom, fit/center, and graph switches — driven from the React Flow viewport via `GraphCanvas`, not timers on the +/- buttons only.
- **Viewport persistence:** pan/zoom/**center** (fit) updates are written to persisted `viewports` on `ReactFlow` `onMoveEnd`, not only when nodes/edges auto-save.
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

[Unreleased]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.4...HEAD
[0.1.0-alpha.4]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.3...v0.1.0-alpha.4
[0.1.0-alpha.3]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.2...v0.1.0-alpha.3
[0.1.0-alpha.2]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/cedoor/nesso/releases/tag/v0.1.0-alpha.1
