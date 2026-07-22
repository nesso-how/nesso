# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for published releases (npm `package.json` and Tauri `tauri.conf.json`).

## [Unreleased]

## [0.2.0-beta.0] - 2026-07-22

### Added

- **Beta data-at-rest compatibility baseline:** Introduced versioned migration ladders and immutable replay fixtures for all persisted surfaces — envelope (`GRAPH_FORMAT_VERSION 1`, `@nesso-how/schema`), vocabulary (`VOCABULARY.version 0.1.0`, `graphLoadNormalizer`), IndexedDB `GraphRecord` (`GRAPH_RECORD_VERSION 1`), and Zustand persist (`ZUSTAND_PERSIST_VERSION 1`) — establishing the first protected data baseline ahead of the `0.2.0-beta.0` release.

### Changed

- **Review ratings:** Rating-button intervals now use localized, readable minute, hour, day, month, and year labels instead of ambiguous abbreviations.
- **Review reminders:** Optional, dismissible per-graph reminders now appear once per local day for previously studied concepts that are due. Each reminder includes **Start review**, and reminder display is controlled independently by the **Learning** setting.
- **Security test and validation simplification:** CSP validation, desktop trust-boundary tests, and frontend Tauri test infrastructure were simplified. Existing web and filesystem security behavior remains unchanged.

- **Shared graph-load compatibility validation:** `graphLoadNormalizer` is now the single app-side compatibility boundary for files, seeds, IDB records, and the desktop workspace. Every versioned chokepoint rejects a newer stored version with a distinct error (`NewerGraphFormatError`, `UnsupportedGraphFormatError`) rather than interpreting it. Non-overwrite of unsupported files is enforced at the compatibility boundary — pre-baseline alpha documents with removed `examples`, `notes`, or image elaboration fields are rejected rather than silently migrated.

### Security

- **Web CSP/security headers:** Added a Content-Security-Policy for the web build and hardened the deploy headers so the browser build enforces script-src, object-src, and connect-src restrictions at the network boundary.
- **Loopback-only HTTP policy:** The desktop native HTTP transport (`src-tauri/`) now restricts outbound AI requests to loopback addresses only, preventing the app from connecting to arbitrary remote hosts through the Tauri IPC bridge.
- **Tauri filesystem/path-granting hardening:** Filesystem capabilities and path-scope grants were tightened — static recursive permissions removed and runtime grants validated against traversal escapes.

### Fixed

- **Desktop:** Opening the native project-folder picker no longer freezes macOS because it now uses Tauri's non-blocking callback API, while preserving Rust-side path validation, filesystem scope grants, and trusted-path persistence.
- **Desktop:** Native JSON export now uses Tauri's non-blocking callback save dialog so macOS remains responsive, while preserving Rust-owned destination selection and file writing.
- **Graph schema deserialization:** The deserialize trust boundary now rejects arrays and primitive values for record-shaped metadata fields, aligning runtime values with the public schema types. Mutation-testing coverage for optional fields and validation boundaries was strengthened.

## [0.1.0-alpha.41] - 2026-07-17

### Added

- **Telemetry:** Funnel-oriented events for onboarding completion/skip, graph lifecycle (creation with source, open), node/edge deletion, review and mentor session completion/abandonment with low-cardinality count buckets, and I/O import/export failures with bounded failure reasons. All events are privacy-safe — no graph IDs, names, content, chat messages, file paths, API keys, or raw errors are included in any payload. The existing opt-in and anonymous-only identity model remains unchanged.

### Fixed

- **Desktop AI:** Fixed native mentor requests failing when the HTTP capability scope contained unescaped IPv6 loopback patterns. Settings endpoint checks and local Ollama model pulls now share the native/browser transport boundary, preserve authentication, and discard stale results.

- **Canvas:** The left-side connection handle on concept nodes now starts relation creation again. The underlying fix normalizes connection direction in  so that the drag-start node always becomes the semantic source, regardless of which handle the gesture originated from. Both connection dots remain visually identical and fully usable. Regression from [0.1.0-alpha.40].


### Changed

- **ConceptElaboration:** Reduced from six fields (`definition`, `examples`, `notes`, `imageUrl`, `imageTitle`, `imageDescriptionUrl`) to just `definition` — a breaking alpha-only simplification ahead of Writing Mode. All UI (Inspector, Review Mode), serialization, validation, LLM context, MCP schema, seeds, docs, and tests updated accordingly. Old graph files with extended elaboration fields are unsupported.

- **Desktop:** Mentor requests now use Tauri's native HTTP transport, which reaches hosted HTTPS OpenAI-compatible endpoints and loopback Ollama without browser CORS restrictions; the browser transport is unchanged.

## [0.1.0-alpha.40] - 2026-07-16

### Added

- **README:** New "Development workflow" section documenting the OpenCode harness, agent pipeline, and continuous flow model, with a colour-coded top-down flowchart replacing the previous left-to-right layout.
- **Worktree support:** `.worktrees/` added to `.gitignore` so worktree working directories are not accidentally tracked.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Agent models:** Upgraded Nesso's agent model configuration (`opencode.json`) to GPT-5.6 family (Luna for planning/reviews/brainstorming, Sol for forensic debugging) and DeepSeek v4 Pro for orchestration and implementation, matching capability to cost per phase.
- **Work agent:** PRs created through the orchestration flow now have GitHub auto-merge enabled by default (`gh pr merge --auto --squash`), so they merge automatically once all required checks pass.

- **Edge encoding:** Dropped the per-type line style channel from `RelationTypeDef` (52 relation types). Edges now render with solid strokes in all encoding modes, using category colour + glyph as the two remaining visual channels. Touched `NessoEdge`, `RelationTypesDialog`, MCP payload, rules, and docs.

### Fixed

- **Desktop:** The external file-conflict banner no longer fires when nothing actually changed on disk. `reconcileDiskWithIdb` previously pushed a record into its persist queue on a timestamp-only bump (e.g. self-healing name/id normalisation, or the app's own save during the disk-before-fingerprint window); it now requires actual content or name divergence. `handleWatchEvent` additionally compares the freshly-synced disk fingerprint against `savedFingerprint` (using `mergeGraphDisplay` for settings parity) and skips spurious notifications entirely.

- **Canvas:** Dragging a connection from a node's left-side (target) handles no longer silently reverses the relation's source/target direction. Target handles now have `isConnectableStart={false}`, preventing a connection drag from starting there.

- **Inspector:** Multiline `InlineEdit` fields (definition, notes, examples) no longer crash with a `ResizeObserver loop` error or clip the last line of text when they grow past one line. `syncScrollHeight` now short-circuits the write when the measured height already matches, preventing the self-observation loop that triggered the browser's loop limit warning.
- **Graph:** Newly created concept nodes now immediately receive keyboard focus on their text input. The focus mechanism uses a bounded `requestAnimationFrame` retry loop that survives React StrictMode double-mount and React Flow pane focus-stealing, so users can type the label without an extra click. Added Playwright e2e coverage for all four creation paths (double-click, `N` shortcut, context menu, sequential creation).

- **Heatmap:** The recall heatmap no longer briefly flashes on during app startup or persists incorrectly when a graph load fails. Store initialization now passes the app settings into the display helper so the canvas starts with the correct default, and a failed `loadGraph` resets stale heatmap state to the current setting. Overlapping load requests are guarded against stale async writes.

## [0.1.0-alpha.39] - 2026-07-02

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Desktop (macOS):** GitHub Releases builds are now code-signed with a Developer ID certificate and notarized by Apple, so Gatekeeper no longer blocks first launch after install.

## [0.1.0-alpha.38] - 2026-06-26

### Added

- **MCP graph tools:** `@nesso-how/mcp` exposes `validate_graph` (non-throwing document validation with errors/warnings) and `build_graph` (structured concepts/relations → importable JSON with dagre layout). Docs updated in the MCP integration guide.
- **First-run onboarding:** Fresh installs open an empty **Tutorial** graph and walk through a welcome dialog, an eleven-step coachmark tour on the real UI (each step gated by the matching action), and a one-time telemetry consent banner. Tour progress survives reload; **About → Show tutorial again** replays from the welcome dialog. Documented in the getting-started guide.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **First launch:** Demo seed graphs are no longer auto-loaded on first launch; a locale-appropriate seed map opens when onboarding ends (skipping removes the Tutorial graph, completing keeps it).

## [0.1.0-alpha.37] - 2026-06-25

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Socrates avatar:** Simplified portrait with warmer skin tones, softer beard, and theme-aware inline SVG in the app (status bar and mentor panel). Removed the status-bar breathing halo; landing docs icon updated to match.

## [0.1.0-alpha.36] - 2026-06-24

### Added

- **Opt-in telemetry:** Settings → **Privacy** adds a telemetry toggle (default off). When enabled, Nesso sends anonymous crash reports (Sentry) and coarse usage events (PostHog, EU region) — no graph content, Socrates chat, file paths, or API keys. Release builds pick up `VITE_SENTRY_DSN` / `VITE_POSTHOG_KEY` from repo secrets; local dev works without them.
- **Feedback shortcut:** Status bar button opens GitHub issue chooser for user feedback.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Docs — privacy:** Introduction page clarifies that graph data stays local and telemetry is opt-in.

## [0.1.0-alpha.35] - 2026-06-24

### Added

- **`@nesso-how/schema` package:** Vocabulary-agnostic graph document envelope (`GRAPH_FORMAT_VERSION`, serialize/deserialize, structural validation). Learning-specific validation (relation catalog, concept params) lives in `@nesso-how/vocab-learning` via `NessoGraphDocument`.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Graph document model:** Graph JSON files now persist as `concepts`/`relations` (replacing the old `nodes`/`edges` shape). React Flow state is mapped at load/save through `graphDocumentMapping` / `documentToRenderGraph`. Shared graph files no longer carry FSRS fields — review progress persists in a separate IndexedDB `reviewState` store with independent content/review fingerprints, fixing review-only autosave.
- **Strict deserialize validation:** Unknown relation types and structural issues on concepts/relations are rejected at the trust boundary in `schema` + `vocab-learning` (closes #20).
- **Relation naming:** `Edge*` types renamed to `Relation*`; `RELATION_CATEGORY_META` dropped in favour of `RELATION_CATEGORIES`. `@nesso-how/graph` embed mode is now uncontrolled via a `graph` prop.

### Removed

- **`@nesso-how/types` and `@nesso-how/formats`:** Superseded by `@nesso-how/schema` and the expanded `@nesso-how/vocab-learning` package.

## [0.1.0-alpha.34] - 2026-06-23

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Socrates mentor avatar:** Replaced the stroke-based `SocratesGlyph` with a 32×32 coloured portrait in the status bar and mentor sheet header. Landing preview and the AI mentor guide entry point updated to match.

### Added

- **End-to-end test lane (tauri-driver, native):** The desktop half of #28, completing the two-lane e2e plan (the Playwright web lane shipped in 0.1.0-alpha.33). A WebdriverIO + tauri-driver suite drives the real Tauri shell to cover what the browser lane structurally cannot reach (`isDesktop() === true`): the real fs plugin, the file watcher (`useGraphFileWatch`), and `desktop-sync`. Four specs in `e2e-native/*.e2e.ts` assert disk-first autosave, rehydration from disk across an app relaunch, the watcher reconciling an externally added graph, and the active graph reloading after an external edit — talking to the same on-disk workspace the app uses. It runs inside a **pre-baked Docker image** (`e2e-native/Dockerfile`: the full WebKit runtime closure + WebKitWebDriver + xvfb + Rust + tauri-driver); the `e2e-native` CI job builds that image with a GHA layer cache and runs the lane in it, and developers run the identical image on **macOS via `e2e-native/run-local.sh`** (host-safe). Not yet a required check. Native OS dialogs and the menu bar are not WebDriver-drivable, so multi-project/native import-export stay on Vitest; the external-conflict banner branch is a follow-up. Graphs are identified by their on-disk node content (the inline-rename flow is timing-fragile under WebKitGTK), so no new production selectors were needed.
- **Disable review mode:** A new _Review mode_ toggle (on by default, backed by a `reviewEnabled` setting) in **Settings → Learning** turns spaced-repetition review on or off. When off, the **Review** pill in the top bar, the `R` shortcut, and the review row in the shortcuts dialog are all hidden. Older persisted settings default to on via the shallow settings merge.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Settings → Learning section:** The _Review_ settings tab was renamed **Learning** (and moved before _AI_) and restructured into a labelled **Review** group that opens with a short spaced-repetition/FSRS description; the _Target retention_ / _Max interval_ controls now appear only when review is on. `SettingsFormRow` gained an optional `description` and a `divider` prop, and the Appearance / Learning / AI tabs were unified onto it — grouped rows are now separated by spacing rather than internal dividers, with dividers reserved for top-level rows.

### Removed

- **Legacy persisted-settings stripping:** Dropped the localStorage `merge` shim that pruned renamed/removed keys from old persisted blobs (`reviewBatchMax`, `fsrsMaxInterval`, `graphWorkspacePath`, `accent`, `showLabels`, `showConfidence`, `aiMode`, and the top-level `relationTypesPanelOpen` / `sidebarStatsOpen`). Per the alpha no-backwards-compatibility policy the merge now only shallow-merges `settings` so new keys still pick up defaults; stale keys from older blobs are simply ignored rather than actively stripped.

## [0.1.0-alpha.33] - 2026-06-19

### Added

- **End-to-end test lane (Playwright, web UI):** A new Playwright suite drives the real web app in a headless browser, covering the core flows Vitest cannot reach (`isDesktop() === false`): creating and connecting concepts, changing and deleting relations, undo/redo, multi-select delete, graph create/switch/delete, JSON export/import, persistence across a reload, and dark-mode/language settings. Specs live in `e2e/*.spec.ts` with shared helpers and a JSON import fixture, run serially against a Vite dev server, and are gated by a dedicated `e2e` CI job (alongside `js`/`rust`) that uploads the Playwright HTML report on failure. Four small `data-testid` anchors were added to production components for stable, language-independent selectors. This is the web half of the two-lane plan in #28; the native tauri-driver lane (real fs / IPC / file watching) is a follow-up.
- **Mutation testing (StrykerJS):** A new opt-in analysis layer grades whether the test suite would actually _catch_ a regression, not just execute the code — Stryker mutates the source and reruns the tests per mutant, scoring each killed (a test failed, good) or survived (the behaviour is unasserted). Wired as **per-area configs** (`stryker.<area>.mjs` over a shared `stryker.base.mjs`) each with its own `break` ratchet, so a small well-tested package can't mask a larger less-tested one: `formats` 95.7%, `types` 97.1%, `mentor` 86.5%, `store` 71.4%, `workspace` 63.1%. It is **not** a per-PR gate (the per-mutant reruns are too slow) — it runs via `pnpm run analyze:mutation` (or `…:<area>`) locally and a non-blocking scheduled CI job (`.github/workflows/mutation.yml`), one step per area. Establishing the baselines hardened the regression-prone suites (store slices, mentor/FSRS context, workspace sync), which in turn raised the `vitest.config.ts` coverage floors.
- **`@nesso-how/theme` design-tokens package:** A new workspace package is the single source of truth for theme tokens — surface/ink colours, accent/highlight, the recall heatmap, shadows, fonts, and the type/spacing/radii scales. The app injects them into `<head>` at build time through a `nessoTheme()` Vite plugin (so they exist at first paint); the docs and landing consume them through a generated Starlight adapter (`starlightCss`) and an app-namespace stylesheet. Packs derive from the default via `defineTheme` (light is the full set, dark a diff over it). Category colours stay in `@nesso-how/relation-types` and remain orthogonal to the theme.
- **Mentor reply streaming:** The Socratic mentor streams replies token-by-token over the OpenAI-compatible SSE endpoint. `fetchCompletion` gained an optional `onToken`; `MentorPanel` appends the deltas live with a blinking caret (the real stream replaces the fixed-speed typewriter in chat — `ReviewMode` keeps its single-shot question fetch). A new co-located test covers the SSE parser (delta accumulation, lines split across chunks, `[DONE]`, and the non-streaming path). Also added a `qwen3:8b` model preset.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Theme tokens single-sourced:** Surface, ink, accent, shadow, font, spacing and radius values that were duplicated across `src/index.css`, the docs `custom.css`, and the landing page now all resolve from `@nesso-how/theme`. Component inline styles consume the tokens: spacing/radii/size values matching a scale step became `var(--space-*)`/`--radius-*`/`--text-*`, off-scale border radii were snapped to the nearest step, and `font:` shorthands were decomposed into `fontFamily: var(--font-*)` longhands so a missing font variable degrades only the family, never the size. The only visible change is the docs landing surface shifting from pure white to the warm `#fbfaf8` paper tone, matching the app.
- **Code-quality tooling:** Linting and formatting moved to **Biome** (JS/TS/JSON/CSS), with **Prettier** retained for Markdown/YAML/HTML; ESLint and its plugins were removed (the four intentional `react-hooks/exhaustive-deps` suppressions became `biome-ignore`). Added a strict **type-coverage** ratchet (gates at 99%, app currently ~99.7%) and **fallow** static analysis wired into `preflight` and CI as gates — dead code and architecture cycles are zero-tolerance, while duplication and complexity ratchet against committed identity baselines (`fallow-baselines/`).
- **Test-coverage ratchet:** `test:coverage` now gates on `coverage.thresholds` in `vitest.config.ts` — a snapshot floor set just below today's numbers, so CI is green now and red on any drop. Low global floors are backed by stricter per-directory/per-file globs over the regression-prone logic (`packages/formats`, `packages/theme`, `geometry.ts`, `graphClipboard.ts`/`graphId.ts`, the workspace layer, and the store slices); files only covered incidentally get no floor. No new CI wiring (`test:coverage` already ran); re-baseline the floors when intentionally lowering coverage. `preflight` now runs `test:coverage` too, closing a gap where it skipped the gate CI enforces.
- **fallow backlog reduction:** Drove the committed `fallow-baselines/` down by consolidating genuine duplication (a shared `Icon` set in `ui/icons`, the inspector collapse/close header, `SearchDialog`/`ReviewMode` row components, a `buildRelationGroups` helper, shared hover handlers) and by lifting pure, testable logic out of large files — keyboard dispatch (`resolveShortcut`), selection-pan geometry (`computeSelectionPan`), elaboration rendering (`elaborationParts`), edge sibling-indexing (`styleEdges`), and two `GraphCanvas` hooks (`useGraphContextMenu`, `useConnectRelation`). Duplication dropped from 20 clone groups (504 lines, 2.5%) to 11 (134 lines, 0.7%) and complexity findings from 98 to 94; the two highest-CRAP functions (`onKey`, the selection-pan effect) are now thin dispatchers over tested helpers. Behaviour is unchanged; the extracted logic gains co-located tests and both baselines were re-saved at the lower floor.
- **AI mentor is experimental and endpoint-only:** The mentor now uses a single transport — any OpenAI-compatible `chat/completions` endpoint (local Ollama by default, model `gemma3:4b`, or a cloud provider) — configured under **Settings → AI**; the `aiMode` local/remote toggle was dropped and the AI tab shows the endpoint config directly. `MentorBubble` was renamed to `MentorPanel`. Model presets were reordered by efficiency (`llama3.2:3b` → `gemma3:4b` → `qwen3:8b`) and `qwen2.5:7b` removed (superseded by `qwen3:8b`). `MENTOR_MAX_TOKENS` was raised 380 → 2048 (a ceiling, not a target — the ~180-word reply length stays a soft prompt cap) so reasoning models such as qwen3 thinking have headroom. Docs, landing, and README were updated to match.

### Removed

- **Built-in in-browser model:** Removed the WebGPU mentor engine (`@mlc-ai/web-llm`, Qwen2.5 1.5B) — `src/llm/webllm.ts`, `LocalModelPanel`, the `local` completion branch, the local/remote mode toggle, and the `@mlc-ai/web-llm` dependency. It was too small and slow to be useful, and WKWebView's WebGPU support is incomplete on desktop; a native on-device model for the desktop build is tracked in [#62](https://github.com/nesso-how/nesso/issues/62). Persisted `aiMode` values are stripped on settings merge.

## [0.1.0-alpha.32] - 2026-06-16

### Added

- **Status bar:** A full-width bottom **status bar** replaces the floating BottomDock (`StatusBar`, `STATUS_BAR_HEIGHT_PX`). On the left it anchors the Socrates entry plus the concept/relation counts; on the right it carries undo/redo, zoom −/%/+, and fit. The graph counts and the zoom readout move here from the sidebar (the old Stats section is gone).
- **Right-click context menu:** New `GraphContextMenu`, wired through React Flow's pane/node/edge context-menu callbacks (`reactFlowProps`). Node → Copy/Cut/Duplicate/Delete; relation → Flip direction / Delete; empty canvas → Paste / Add concept here / Center·fit. Paste from the menu drops the clipboard at the cursor (recentering the cluster there) and selects it, while ⌘V keeps the cascading offset. Two new `graph-editing` mutations back it: `duplicateSelection` (also ⌘D) clones the selection with an offset without touching the copy/paste clipboard, and `reverseEdge` swaps an edge's source/target.
- **Inspector rail + Memory:** The detail panel now docks flush on the **right**, full height between the top bar and status bar, and collapses to a **52px rail** (new `inspectorCollapsed` UI state) that keeps the selection with a bottom action toolbar (copy/cut/duplicate/delete). The node inspector gains a collapsible **Memory** section (Due / Stability / Last rating / Reviews / Last reviewed).
- **Sidebar Projects (desktop):** The desktop project switcher moved from a header dropdown into a collapsible **Projects** section in the sidebar body (`SidebarProjects`): switch on click, reveal-in-Finder / remove on hover, `+ New` and `Open project…`. The sidebar header is now always the brand.
- **Empty state & creation:** An empty graph shows a centered **"Your first concept"** hint (`EmptyCanvasHint`, pointer-events through). Double-click the canvas creates a concept at the cursor.
- **Pan-on-select:** Selecting a node or edge nudges the viewport so the element stays clear of the right-docked inspector (never fights manual panning or search re-centering).

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Visual direction — Notion + Oxblood:** Adopted the Notion surface (warm off-white paper, Fraunces display serif) with the Oxblood accent, and introduced a `--highlight` token decoupled from `--accent`: Oxblood is now reserved for the mentor, live recall, selection, and due states, while **actions use ink** (e.g. the review *Reveal* and local-model *Download & use* buttons are ink-filled). Aligned the border-radius scale (chip 4 · standard 6 · prominent 7 · menu 8 · popover/toast 12 · modals 14) and a hover rule (compact buttons change color only; full-width rows keep the background fill).
- **Mentor:** Retired the floating Socrates FAB. The mentor now lives as an inline **Socrates entry in the status bar** (with a soft breathing halo) that opens a **slide-up chat sheet** above the bar, which dodges the docked inspector. All completion logic (`fetchCompletion`, history, new-chat) is unchanged.
- **Top bar:** Shows a **`Project / Graph` breadcrumb** (project segment desktop-only), drops the inline counts, and aligns the Review/⋯ buttons to the design (radius 7, prototype Review glyph, ⋯ as a square icon button); raised above the inspector so its dropdown is no longer clipped.
- **Settings:** Reworked to the redesign — **switches** for true on/off (Heatmap, Auto-flip), a **dropdown** for Language, and **segmented controls shared with the sidebar** for the rest (Theme, Edges, Curve, AI source); model presets are bordered buttons, inputs use the 6px radius, and the active tab uses the `--paper-deep` fill. New shared `Switch` and `Select` primitives; the now-unused `PillToggle` was removed.
- **Display defaults:** The per-node **Heatmap now ships off** by default (was on), and the always-on per-node **confidence underline** was removed together with its `showConfidence` setting (it duplicated the heatmap) — `showConfidence` is gone from `NessoSettings`, the graph display context, and `ConceptNodeBody`.
- **Inspector details:** Concept image is a compact 48px button, the title is smaller (18px), section carets/labels match the sidebar, the relations list shows each connected concept with the relation glyph in a chip and the type on the right (incoming dimmed), and example bullets are small grey dots. Pressing `Backspace` in an empty example row removes it (unless it is the only one).
- **Banners & toasts:** `ActionBanner` gains an optional corner **X** (`onClose`, reusing `CloseButton`) for dismissal instead of a labelled button; toasts auto-dismiss and use the X, and the `UpdateBanner` drops its *Later* / *Dismiss* / *Got it* pills in favour of it (install-in-progress stays non-dismissible). The banner card is restyled to the redesign surface (radius 14, `--bg-card`, `--shadow-lg`) with Inter action buttons.

### Removed

- The floating **BottomDock** and the header **ProjectSwitcher** dropdown (their functions moved to the status bar and the sidebar Projects section); the sidebar **Stats** section.

## [0.1.0-alpha.31] - 2026-06-13

### Added

- **Desktop:** Reintroduced graph-level **Cut** (⌘X) and **Select All** (⌘A), the two predefined Edit items dropped in #45, coherently across the native Edit menu, the BottomDock, and the JS keyboard shortcuts (follow-up #42). Two new `graph-editing` store mutations back every surface: `selectAll` marks every node and edge selected (so a follow-up copy/cut captures the whole graph), and `cutSelection` is copy-then-delete. Cut joins the dock's clipboard group (scissors icon); Select All stays menu- and keyboard-only, as toolbars conventionally omit it. These extend the same graph-owned accelerator model as the existing ⌘C/⌘V/⌘Z — making ⌘X/⌘C/⌘V/⌘A/⌘Z context-aware so they fall through to native editing while a text field is focused on desktop remains the open part of #42.

## [0.1.0-alpha.30] - 2026-06-12

### Added

- **Desktop:** Fleshed out the native menu bar with a coherent structure and a single accelerator strategy (follow-up to #17). Beyond the previous minimal menu it adds Settings (⌘,), New Graph (⌘N), JSON/PNG export and import, graph Undo/Redo/Copy/Paste (⌘Z/⌘⇧Z/⌘C/⌘V, routed to the store), View zoom in/out/fit, live Heatmap/Edges/Curve toggles and full screen, and a Help menu (Documentation, Website, Report an Issue, Keyboard Shortcuts, About on Win/Linux). Menu labels and the View check marks follow the in-app language and display settings: the frontend rebuilds the menu through a new `set_app_menu` Tauri command on every language or display change, and every custom item routes through `menu:*` events into existing store actions and dialogs (reusing the extracted `src/lib/graphIO.ts` export/import helpers). The ⌘Z/⌘C/⌘V "split-brain" is resolved by giving the graph the document accelerators; native Cut/Select All were dropped for now (follow-up #42).
- **CI:** A dedicated `rust` job now gates the native Tauri layer (`src-tauri/`) on every PR, in parallel with the renamed `js` job (was `check`): `cargo fmt --all --check`, `cargo clippy --all-targets -- -D warnings`, `cargo check --all-targets`, and `cargo test`. It installs the stable toolchain (rustfmt + clippy), caches `~/.cargo`/`target` via `swatinem/rust-cache`, installs the Tauri Linux system deps, and generates the gitignored bundle icons first (`tauri::generate_context!` embeds them). Previously the Rust side was invisible to CI and only failed at desktop-build/release time. The `preflight` skill mirrors the new steps for local parity.
- **Testing:** Introduced **Vitest** for fast, deterministic unit/integration tests on pure logic — the base of the testing pyramid (complements e2e, #28). Covers graph serialization (`@nesso-how/formats`), edge geometry and rating colors (`@nesso-how/graph`), FSRS/display types (`@nesso-how/types`), id generation, the canvas clipboard, the Zustand `graph-editing` and `graph-management` slices, and the regression-prone workspace disk↔IndexedDB layer (manifest, paths, file naming/dedup, two-phase sync) exercised as real integration against an in-memory Tauri-fs boundary plus `fake-indexeddb`. Added `test` / `test:watch` / `test:coverage` scripts and a required `test` step in CI that gates PRs. Test conventions live in `.rules/testing.md`.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Sidebar:** Removed the redundant info (About) button from the footer — About stays reachable from the always-visible ⋯ menu and, on desktop, the native Help/app menu.

## [0.1.0-alpha.29] - 2026-06-12

### Added

- **Settings:** The Appearance tab now exposes the graph display defaults (heatmap, edge encoding, curve style, auto-flip) that were previously hardcoded and unreachable from the UI. These seed new graphs and graphs without their own stored display (via `defaultGraphDisplay`/`mergeGraphDisplay`); existing graphs and per-graph sidebar overrides are unaffected, so a user's baseline preference no longer has to be re-applied on every new graph.
- **UI:** Two themed, localized in-app primitives replace native browser dialogs. A non-blocking toast (auto-dismissing, stackable, manually dismissible, reduced-motion aware; built on the existing banner design) now surfaces transient messages — a failed graph import and the "project folder not found" notice, both previously `window.alert`. A blocking confirmation dialog now guards destructive actions: deleting a graph (previously `window.confirm`) and removing a project from the list (previously a single click with no prompt). The dead per-app export-overwrite `window.confirm` — unreachable on desktop (native save dialog) and on web (the browser auto-renames) — is removed along with its plumbing. No native `window.alert`/`window.confirm` calls remain.

### Fixed

- **Graphs:** Edits made within the autosave debounce window are no longer lost when switching graphs — `loadGraph` flushes the pending save first. A save still in flight during a switch can no longer leak the previous graph's saved-state fingerprint onto the newly loaded one (which faked or masked external-file conflicts).
- **Desktop:** The app's display name is now capitalized (`Nesso`) — `productName` was lowercase, so the menu bar, Dock and `.app` bundle showed `nesso`. The window title was already `Nesso`.
- **Desktop sync:** External edits to a graph file that don't bump its embedded `updatedAt` (e.g. hand edits in a text editor) are now detected via content comparison instead of being silently overwritten on the next in-app save. The conflict check also re-reads the live store right before deciding, closing a window where edits made during the reconcile could be reloaded over.
- **Canvas:** Escape while renaming a concept on the canvas now cancels the edit (it used to commit, unlike the inspector). Releasing a new connection over an edge no longer creates an invisible ghost edge (only nodes are valid drop targets). Node/edge ids are now collision-checked on create and paste. Deleting a mixed selection removes explicitly selected edges too.
- **Shortcuts:** Editing shortcuts (Backspace/Delete, ⌘C/V/Z, Enter, n, f, r) are disabled while any dialog is open — Backspace during a review no longer deletes the canvas selection underneath.
- **Sidebar:** Deleting a graph now asks for confirmation (the file on disk is removed too).
- **Import:** Graph files are structurally validated per element on import and on disk load (a node without id/position used to crash the canvas and get re-persisted); a failed import now shows an error instead of doing nothing. Partial hand-written node data is normalized with fresh review fields.
- **Mentor/AI:** Replies can no longer land in the wrong conversation after "New chat" or a graph switch; aborting now actually interrupts local WebLLM generation, and concurrent local generations are serialized. Ollama model pulls tolerate malformed progress lines, release the connection, and stop when Settings closes.
- **Review:** FSRS `learning_steps` is now persisted per concept, so Learning/Relearning cards no longer restart their step ladder on every rating.
- **Misc:** The max-interval stepper field can be cleared while retyping; saved viewports are removed when their graph is deleted; UNC paths survive `joinPath`; the "Untitled" fallback on save is localized.
- **Viewport:** A window reporting 0×0 at startup (embedded WebViews before first layout) no longer collapses the initial fit to minimum zoom and persists it, which kept the graph invisible on every later launch. The initial fit now waits for a usable window size, computed fits are no longer persisted (only user pan/zoom is), and `saveViewport` ignores viewports observed in a zero-sized window.
- **Projects (desktop):** A project whose folder is deleted, moved or renamed on the filesystem is now kept in the list and flagged "not found" (greyed) instead of vanishing — detected at startup, when clicked in the switcher (with a message), and live via the file watcher. Removing a project from the list stays an explicit user action ("Remove from list"). Previously the entry was silently pruned, so renaming a project's folder looked like losing the project. When the active project's folder vanishes, the app still switches to a present project (or the bundled default) without writing to the old location — so the disk reconcile can't recreate it from the IndexedDB cache — while the missing entry stays flagged. If the folder reappears (e.g. renamed back), clicking it clears the flag and loads it.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Performance:** The autosave fingerprint (full-graph JSON) is computed once per debounced save instead of inside a store selector on every update (including each drag frame). The app shell no longer subscribes to the node array or zoom level, so the sidebar, top bar, dock, and mentor bubble stop re-rendering during drags and zooms. Nodes subscribe to connection state with a selector (no per-mousemove re-render of every node). The file watcher ignores echoes of the app's own writes via a self-write path registry, so autosaves no longer trigger full-workspace re-reads.
- **Security (desktop):** A Content-Security-Policy replaces `csp: null`; the static `$HOME`/`$DOWNLOAD` recursive filesystem permissions are removed in favour of runtime scope grants for user-chosen folders; the `grant_fs_scope` command validates its input (absolute, no `..`, no filesystem roots, no home dir itself, no hidden directories outside the app's data dirs); "Show in Finder" uses `revealItemInDir` instead of `openPath`.
- **Settings:** Removed the unused `accent` and `showLabels` settings (never read; the accent color is set by the theme).
- **CI/builds:** Vercel now skips the docs and app deploys when a change doesn't touch their inputs — an Ignored Build Step anchored at the last successful deploy (`scripts/vercel-ignore.sh`, fail-open so it never skips a build that's actually needed). CI also cancels superseded PR runs (`concurrency`) and drops the redundant standalone `tsc -b` step, which `pnpm build` already runs.

## [0.1.0-alpha.28] - 2026-06-08

### Added

- **Desktop:** Multi-project support — open and switch between any number of project folders, each holding its own `.json` graphs and `.nesso/manifest.json` (VS Code-style explicit "Open Folder…", no auto-discovery). The sidebar brand slot becomes a project switcher (name + chevron, dropdown with known projects, "Open Folder…", "Close Project"); a native File menu mirrors these (⌘O / ⌘W).

### Fixed

- **Canvas:** Connection handles on concept nodes show on hover again — `nesso-node` now wraps the full node (including handles), matching the CSS selector.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Desktop:** The on-disk project folder is now the source of truth and IndexedDB acts only as a cache of the active project — inverted from the previous model where IDB was authoritative and disk a reconciled mirror. Saves are disk-first write-through (write to disk, then mirror the persisted record into IDB), so the only possible divergence is "IDB behind disk", always recoverable by reloading. Settings: `graphWorkspacePath` is replaced by `knownProjects` + `activeProjectPath`. The Settings → Data tab is removed — opening, switching, closing, and revealing project folders now lives entirely in the project switcher and File menu.

## [0.1.0-alpha.27] - 2026-06-07

### Added

- **About:** "About Nesso" dialog (version, description, links to GitHub, site, changelog, and license), reachable from the native desktop menu (app menu on macOS, Help on Windows/Linux), the info button in the Sidebar, and the ⋯ menu. Version is injected at build time from `package.json`.
- **`@nesso-how/graph`:** New package `packages/graph/` — embeddable `<NessoGraph />` React component with shared `NessoEdge`, `ConceptNode`, `ConceptNodeBody`, geometry, and `GlyphSVG`. Read-only by default; controlled/uncontrolled modes; `display`/`palette`/`categoryColorMode` context; optional `getRelationLabel` and `isItemSelected` for host apps. Peer deps: `react`, `react-dom`, `@xyflow/react`.
- **Docs:** "Embedding graphs" guide; landing hero graph via `HeroGraph` + `@astrojs/react`; `docs/` added to the pnpm workspace; `docs/vercel.json` for monorepo installs on Vercel. Hero graph supports pan and zoom.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Codebase:** Reorganize components into feature folders (`canvas/`, `layout/`, `mentor/`, `dialogs/`, etc.), extract shared `inspector/` and `ui/` modules, and split the Zustand store into composable slices. No user-visible behavior changes.
- **Canvas:** `GraphCanvas` delegates to `NessoGraph`; app `ConceptNode` wraps `ConceptNodeBody` for inline edit and connection handles; duplicate `NessoEdge`/`GlyphSVG`/geometry/palette code removed from `src/`.
- **`@nesso-how/relation-types`:** `PALETTES` and `GLYPH_PATHS` moved here for sharing with the graph package and app palette switching.

## [0.1.0-alpha.26] - 2026-06-02

### Added

- **Tooling:** Prettier (root config, `format` / `format:check`) and ESLint flat config (`typescript-eslint`, React presets, `eslint-config-prettier`) for `src/` and `packages/*`, with `lint` / `lint:fix` scripts.
- **CI:** `.github/workflows/ci.yml` on pull requests and pushes to `main` — `format:check`, `lint`, `tsc -b`, `build`, `license-headers:check`.
- **Git hooks:** Husky pre-commit with `lint-staged` (Prettier, ESLint `--fix`, in-scope license headers on staged files only).

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Codebase:** Apply Prettier formatting across `src/`, `packages/`, `docs/`, and related config; fix a small set of ESLint errors in `src/`.
- **Developer:** Cursor rule for AI-authored PR bodies aligned with `.github/PULL_REQUEST_TEMPLATE.md`.

## [0.1.0-alpha.25] - 2026-06-02

### Added

- **Desktop:** Auto-updates — on launch the macOS app checks GitHub Releases and, when a newer signed build exists, offers to install it and relaunch (Tauri updater + `latest.json`).

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Positioning:** Tagline reframed as an app for building typed knowledge graphs (README, docs site, browser title, Tauri description, mentor prompt, Cursor rules).
- **Desktop release:** macOS now ships a single universal `.dmg` (Apple Silicon + Intel) published as a full release (no longer pre-release), so the updater endpoint `releases/latest/download/latest.json` resolves.

## [0.1.0-alpha.24] - 2026-05-29

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Repository:** GitHub org moved to `nesso-how/nesso`; README, docs, Cargo.toml, issue templates, and changelog compare links updated.
- **Code of Conduct:** Enforcement contact email set to `nesso-how@proton.me`.
- **Demo seed:** Slightly wider auto-fit on first load (Understanding / Comprensione) when no viewport is saved yet; manual Fit unchanged.
- **README:** Tagline and positioning (`typed knowledge graph for active learning`); alpha mentor caveat; quick start, project structure, and package table; nav links to nesso.how/docs.
- **CONTRIBUTING:** Slim intro; setup moved to README.
- **Docs:** Starlight site description aligned with README tagline; minor punctuation in mentor, concepts, and MCP guides.
- **App / desktop:** Browser tab title and Tauri crate description use the new tagline; mentor system prompt wording updated.
- **Cursor rules:** `project.mdc` description, WebGPU-first AI stack, and monorepo layout match README.

## [0.1.0-alpha.23] - 2026-05-22

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Relation model:** Drop redundant `symmetric` on `EdgeTypeDef`; symmetric types use `inverse: 'self'` (app, MCP, rules).
- **Docs:** Relation-types reference expanded with category narratives, coefficient rationale, citations, and alpha note; concepts guide cross-link softened; note callouts use warm accent.
- **Docs:** Light-mode paper/ink/elevation tokens and paper texture aligned with the app bone palette (`src/index.css`).

## [0.1.0-alpha.22] - 2026-05-22

### Added

- **Relation model:** **Epistemic** category — `supports` / `supported-by`, `contradicts`, `explains` / `explained-by`, `defines` / `defined-by`.
- **Relation model:** Causal negative types — `disables` / `disabled-by`, `consumes` / `consumed-by`, `delays` / `delayed-by`; temporal — `during` / `spans`, `overlaps-with`, `derives-from` / `gives-rise-to` (**52 types** across 8 categories).
- **Relation model:** 13 inverse relation types (e.g. `has-subtype`, `caused-by`, `follows`) so asymmetric edges are first-class in both directions; **34 types** before epistemic, across 7 categories.
- **Relation model:** Per-type semantic coefficients on `EdgeTypeDef` — `transitive`, `inverse`, `strength`, `polarity`, `cardinality` — for future graph-analysis algorithms.
- **Relation picker:** Search, primary-direction defaults, and graph-aware frequently-used shortcuts; `isPrimaryRelationType` exported from `@nesso-how/relation-types`.
- **Relation types dialog:** Footer link to the full relation-types reference on nesso.how (EN/IT).
- **MCP (`get_relation_types`):** Tool output includes semantic coefficients alongside visual encoding.
- **GitHub:** `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue templates (bug, feature, graph model), and PR template with changelog checklist; graph-model issue template asks for coefficient fields and links to the relation-types reference.
- **npm packages:** Minimal READMEs with install/usage for `@nesso-how/types`, `formats`, `relation-types`, and `mcp`.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Relation model:** Removed `is-a`; taxonomic hierarchy uses `subtype-of` / `has-subtype` and `instance-of` / `has-instance`.
- **Seeds, app i18n, docs, landing, README:** Updated for the expanded vocabulary and `subtype-of` in place of `is-a`.
- **Understanding demo seed:** Star topology with elaborations (definitions/examples); hero SVG and landing aligned; contrasts Understanding with Passive consumption.
- **Docs, GitHub:** Hero graph SVGs and graph-model issue template no longer reference removed `is-a` type.
- **Relation model docs:** Reference clarifies symmetric types and distinctions among `prevents` / `inhibits` / `disables`, `derives-from` / `subtype-of`, and `consumes` vs `uses`; README and graph-model issue template cite **52** types.
- **MCP (`@nesso-how/mcp`):** Pin `@modelcontextprotocol/server` and `zod` semver ranges; use `workspace:*` for `@nesso-how/relation-types` in the monorepo (resolved on publish).
- **Cursor rules:** Document expanded `EdgeTypeDef` schema and alpha no-backwards-compat constraint.

### Removed

- **Seeds:** Plant biology demo graphs.

## [0.1.0-alpha.21] - 2026-05-21

### Added

- **Desktop:** Graph workspace sync — each graph is dual-written to IndexedDB and a `.json` file under a workspace folder (default app data; optional custom folder in **Settings → Data**), with `.nesso/manifest.json` for filenames and ids.
- **Desktop:** Recursive file watch reconciles disk ↔ IndexedDB; when the **active** graph file changes externally while you have unsaved edits, an `ActionBanner` offers **Reload from disk** or **Keep my changes**.
- **Desktop:** Tauri `fs` + `dialog` plugins for folder picker, scoped read/write, and save-dialog export.
- **Graph ids:** Opaque `g…` ids for new graphs and seeds; workspace autosave persists `id` + `updatedAt` in JSON.
- **`@nesso-how/formats`:** `nodesForGraphShareExport` / `nodesFromGraphShareImport` strip or reset FSRS fields on manual export/import.
- **`ActionBanner`:** Shared fixed bottom banner with pill actions (used by file-conflict UI).

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Settings → Data (desktop):** Workspace folder picker, open in Finder, reset to default; **Delete local data** control removed from this tab.
- **Graph menu:** Export/import JSON is share-safe (no personal review history); desktop export uses a native save dialog.
- **Import:** Respects `id` when valid; de-duplicates graph names (`Foo-2`, …); import merge no longer creates duplicate sidebar entries for the same id.
- **Docs / README:** Desktop workspace storage and share-safe import/export described in introduction and MCP guide.
- **Theme:** Refreshed bone light palette — paper/ink/elevation tokens, softer paper texture, `bg-card` / `bg-elev` on chrome surfaces, slightly larger sidebar metadata type.

### Fixed

- **Desktop (macOS):** Concept node labels no longer blur or “refocus” on hover in the Tauri app (WKWebView); connection handles use CSS `:hover` instead of React state + opacity transitions.
- **Desktop (macOS):** Canvas drag no longer selects node labels or edge text (WKWebView); inline edit inputs still allow selection.
- **Desktop:** **Keep my changes** always writes the canvas to disk (forced save); autosave paused while a file conflict is open.
- **Desktop:** File-conflict banner only appears when the **active** graph’s file changed on disk, not when another graph in the folder was edited externally.
- **Canvas:** Initial graph load no longer flickers — viewport is computed and applied before first paint when no saved viewport exists.
- **Sidebar:** Selecting a node or edge after switching graphs no longer bumps `updatedAt` or reorders the graph list — autosave ignores React Flow selection flags.

### Removed

- **Sidebar:** Recent concepts section (use ⌘K search to jump to nodes).

## [0.1.0-alpha.20] - 2026-05-20

### Added

- **`@nesso-how/types`** — new npm package exporting all shared graph types (`ConceptNodeData`, `NessoSettings`, `NessoEdgeData`, `GraphDisplaySettings`, helpers `nodeToCard`, `defaultGraphDisplay`, `mergeGraphDisplay`). `src/types/graph.ts` is now a re-export shim so no app imports change.
- **`@nesso-how/formats`** — new npm package with `NessoGraphFile` type, `serializeGraph`, and `deserializeGraph`; `GraphIO.tsx` now uses these instead of inline `JSON.stringify`/`JSON.parse`.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Canvas:** Concept node target handle is larger (22px) with a radial ring for easier edge drops.

### Fixed

- **CI:** npm publish uses **Trusted Publishing** (OIDC) instead of `NPM_TOKEN`, avoiding 2FA / `EOTP` failures in release workflows.

## [0.1.0-alpha.19] - 2026-05-20

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Canvas:** Edge connection preview uses the same arc exit geometry as rendered edges (including curve flip), a dashed accent stroke, and a dotted ring on the hovered target node; source handle hit area is larger with a radial dot.

## [0.1.0-alpha.18] - 2026-05-20

### Fixed

- **Canvas:** **Contrasts with** (`wavy`) renders as a single dashed stroke (matches the homepage hero; no duplicate offset line).
- **Canvas:** Marquee multi-select no longer crashes — stable edge references during selection and batched `syncFlowSelection`; **⌘** no longer conflicts with zoom (`zoomActivationKeyCode` → **Alt**).
- **Canvas:** **Del** / dock delete removes selected concepts (and their relations) when nodes are in the selection; edge-only delete when only relations are selected (fixes marquee where React Flow also highlights edges). One undo step for mixed node+relation deletes (no longer split via React Flow’s separate remove handlers).
- **Canvas:** After paste, arrow-key nudge works immediately (focus on the new node).
- **Canvas:** **Enter** on a selected concept opens inline edit; **Enter** / **Esc** in edit mode save the label (blur still saves too).
- **Canvas:** Bottom-dock delete no longer keeps a hover/focus highlight on the trash button after the selection is cleared.
- **Canvas:** Bottom-dock delete and **Del** / **Backspace** remove selected relations as well as concepts; selecting a relation clears any selected concept (and vice versa).
- **Canvas:** After canceling or committing inline rename (**Esc** / **Enter**), keyboard focus returns to the selected concept so arrow-key nudge works immediately.
- **Canvas:** **N** / **+ concept** place new nodes centred on the visible canvas (matching double-click) and nudge diagonally when the centre spot is already occupied; viewport pan targets the node centre.
- **Docs (landing):** Emphasis marked with `<em>` in translations (`set:html`) gets the accent colour again; scoped Astro CSS no longer requires compiler-generated `<em>` nodes for that rule.

### Added

- **Canvas:** Copy and paste for selected concepts and relations — bottom-dock buttons and **⌘C** / **⌘V** (**Ctrl+C** / **Ctrl+V**). Supports single and multi-select (marquee or **⌘**/**Ctrl**-click); copying concepts includes interconnecting relations; copying a relation includes its endpoints. Paste offsets the duplicate and supports undo.
- **Inspector:** **Flip curve** on a selected relation when **Display → Curve** is **Arc** — mirrors the arc to the opposite side; persisted per edge.
- **Shortcuts:** Arrow keys (and **Shift** + arrows for a larger step) to nudge a selected concept are listed in the keyboard shortcuts dialog and docs.
- **Canvas:** Double-click empty canvas to add a concept at the pointer (replaces default React Flow double-click zoom); **`N`** adds at viewport centre; new concepts open in edit mode.
- **Canvas:** PNG export from the **Graph menu → Export as PNG** — captures the full graph (auto-fit bounds, current theme background, hides handles) and downloads `<graph-name>.png`.
- **Demo seeds:** **Understanding** / **Comprensione** — six-concept starter graph matching the marketing homepage hero (hub concept plus five typed relations).

### Removed

- **Demo seeds:** **Solar system** / **Sistema solare** bundled graphs removed for now.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Demo seeds:** Bundled graph JSON may include a `display` block (curve, encoding, etc.); seed bootstrap now persists it instead of dropping it.
- **Canvas:** Sidebar **Display** options (heatmap, edge encoding, curve, auto flip) are **per graph** — saved in IndexedDB with the graph and included in JSON export; new graphs inherit app defaults until changed.
- **Canvas:** New arc relations auto-flip from source/target layout (above when the target is to the right, below when to the left); **Display → Auto flip** (on by default) keeps curves updated while you move nodes. **Flip curve** in the Inspector is **Off | Auto | On** when auto flip is on ( **Off | On** when off); **Auto** returns a pinned edge to layout-driven bending.
- **Graph menu:** JSON export opens the native save dialog (Chrome, Edge, and other browsers with the File System Access API); choosing an existing file prompts to overwrite. Re-exporting the same graph reuses the last path and asks before overwriting.
- **Docs (landing):** Below the credo lines (“The user…”), the divider stays tight under the quote; the final CTAs sit in a short band below so they stay vertically centred in that space.
- **README:** Hero concept-graph illustration is shared with the marketing homepage (`docs/public/hero-graph.svg`) instead of a separate screenshot.

## [0.1.0-alpha.17] - 2026-05-16

### Fixed

- **MCP (`@nesso-how/mcp`):** Published tarball listed **`workspace:*`** for **`@nesso-how/relation-types`**, which **`npm` / `npx`** cannot resolve — declare a **semver** range on **`@nesso-how/relation-types`** so **`npx -y @nesso-how/mcp`** installs cleanly.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Workspace packages:** **`@nesso-how/relation-types`** and **`@nesso-how/mcp`** declare **`publishConfig.access: public`** so `npm publish` targets the **public** registry for scoped packages (otherwise npm defaults scoped packages to **restricted / private**).

### Added

- **Docs (landing):** Marketing homepage shows release tag (**`vx.y.z…`**) linking to GitHub Releases for that tag (`package.json` version).

## [0.1.0-alpha.16] - 2026-05-16

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Mentor:** Graph snapshot sorting and persona emphasise FSRS **stability** and **last review** (rating + days elapsed); **DUE** stays visible on nodes but only nudges order slightly. System prompt includes an explicit **legend** for how to read node tags (`s=`, `since review`, ratings, `DUE`, `(new)`).

- **MCP (`@nesso-how/mcp`):** Removed **`build_graph`** — URL-based graph handoff was unwieldy for models and users; MCP documents **Import JSON** instead.

- **App:** Removed **`?import=`** query-string graph import; use **Graph menu → Import JSON** (file or paste) only.

- **MCP (`@nesso-how/mcp`):** Depend on **`@cfworker/json-schema`** (`^4.1.1`) so **`@modelcontextprotocol/server`** resolves its optional peer under pnpm (fixes Claude Desktop **`ERR_MODULE_NOT_FOUND`** when spawning **`node dist/index.js`**).

- **Workspace:** `@nesso-how/relation-types` holds **`RELATION_CATEGORY_META`** (labels + subtitles); app merges **`RELATION_CATEGORIES`** with **`var(--cat-<category>)`**; MCP imports category meta from the shared package (removed **`packages/mcp/src/data/relation-types.ts`**).
- **Contributor docs:** Cursor rule `docs-sync.mdc` (`alwaysApply`) plus `maintenance.mdc` cross-reference — MCP changes and Starlight-documented features stay aligned (`docs/` + **`pnpm build`** in `packages/mcp` for **`dist/starlight-docs.pages.json`**).
- **MCP (`@nesso-how/mcp`):** `get_nesso_docs` reads **`dist/starlight-docs.pages.json`** produced by **`pnpm build`** (auto-discovers Markdown under **`docs/src/content/docs/docs/`**).

### Added

- **Docs:** MCP guide (`docs/guides/mcp-integration`) — setup, **`get_nesso_docs`**, **`get_relation_types`**, and **Import JSON** graph shape.

- **Docs:** new guides — **Concepts & Inspector** (canvas + selection + notes + Wikimedia image search), **AI mentor** (local vs remote, WebGPU, Socratic persona, context window), **Review mode** (FSRS flow, retention/max-interval settings, keyboard shortcuts); Getting started rewritten — local WebLLM (default) vs Remote API, full keyboard shortcuts table; MCP guide adds **Install** section with Claude Desktop config snippet.

- **MCP package** (`packages/mcp`) — `@nesso-how/mcp` MCP server with **`get_nesso_docs`** (Markdown pages bundled at **`pnpm build`** into **`dist/starlight-docs.pages.json`**, one MCP block per page) and **`get_relation_types`**. MCP-specific prose lives in the docs guide above — not duplicated in the package code beyond bundling.

## [0.1.0-alpha.15] - 2026-05-15

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Review:** AI recall questions use inspector elaboration (definition, examples, notes) and graph relations; the system prompt steers questions without spoiling active recall; the question is shown beside a circular Socrates avatar so AI-authored text is easy to recognize.
- **Mentor:** Opening message uses context-aware synthetic prompts (selected concept, selected relation only, or whole-graph weak spots); header **New chat** (reload) clears the thread and refetches that opener; persona instructions distinguish node vs edge vs empty selection.
- **AI (local):** Cached WebLLM weights auto-load when Local mode is selected; Settings shows saved-on-device state and probes the browser cache; first run without cache still uses **Download & use**.
- **Settings → AI:** Single flow: **Mode** row (Local left, default) matching Appearance controls, then fields for the active mode.
- **Mentor:** Friendly copy when the local model is missing, loading, or failed; short loading line in chat; system prompt asks the model to avoid em dashes in replies.

## [0.1.0-alpha.14] - 2026-05-15

### Added

- **Settings:** **Data** tab — **Delete** + native confirm erases IndexedDB graphs, Zustand persist + layout keys (\`src/data/storageKeys.ts\`), then reloads (desktop offline reset; WebGPU model cache unchanged).

## [0.1.0-alpha.13] - 2026-05-15

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Inspector:** collapsed/expanded state for **Examples** and **Relations** is saved in app settings (persisted with other preferences).
- **Typography:** clearer Fraunces (concept copy) vs Inter (menus, dialogs chrome) split; tuned sizes in Inspector, Review mode, Search, Mentor, and Graph IO.

### Added

- **Seeds:** elaboration fields (definition, examples, notes) on every concept in the Plant biology and Italian Biologia vegetale demo graphs.

### Fixed

- **Graph:** ignore drag-to-self connections so the relation picker does not open for self-loops.

## [0.1.0-alpha.12] - 2026-05-14

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Brand:** nexus brandmark (SVG) in the sidebar; favicon and `public/icon/` assets; desktop app icons regenerated from the 512² tile artwork.

### Fixed

- **Favicon:** SVG tab icon follows `prefers-color-scheme` so the mark stays visible on dark browser chrome (e.g. Firefox).

## [0.1.0-alpha.11] - 2026-05-14

### Added

- **Graph:** multi-selection (Shift drag rectangle, **⌘/Ctrl** additive click); **`selectedIds`** in the store with **Delete selected** on the bottom dock; **Delete**/**Backspace** remove nodes via React Flow with undo history.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Inspector:** collapsible sections and inline edit pattern; canvas gutter aligned to panel edge inset (12px × 2).
- **Review mode:** session progress bar and counter; FSRS next-interval hints on rating buttons; elaboration (definition, examples, image) and link layout; keyboard shortcuts via `ReviewKeyHandler`.
- **Relation picker:** scroll area and horizontal padding for category groups.
- **Theme / graph:** light paper and card tones; `--grid-dot` for React Flow dots (light/dark); slightly larger dots on the canvas.
- **i18n (en / it):** review rating labels and related copy.
- **Bottom dock:** unified icon-only actions (including add concept); larger buttons.

### Fixed

- **Scroll areas:** themed `.nesso-scrollbar` on Sidebar body, Search palette, Settings content, mentor transcript, and Relation picker (consistent with Inspector and Relation types dialog).

### Documentation

- **README:** roadmap — Inspector and Review dialog design items marked complete; multiple selection marked complete; edge relation model — 21 types, 7 categories (including similarity).

## [0.1.0-alpha.10] - 2026-05-14

### Added

- **i18n:** English and Italian (`src/i18n`, `useT()`), language from Settings; Italian demo seeds (**biologia vegetale**, **sistema solare**); browser language used on first launch when the store is empty.
- **Sidebar:** collapsible **Stats** (concept count, link count, zoom %).
- **`avgRetention`:** `src/data/fsrsDueQueue.ts` helper averaging FSRS retrievability across reviewed concepts (evaluated at due vs now).

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Bottom dock:** **Undo** / **Redo** live in the dock (removed floating **UndoRedoControls**); zoom **+**/**−** and percentage readout removed from the dock — **Center / fit (F)** remains.
- **Top bar:** inline concept / link counts next to the graph title removed (counts moved under Sidebar **Stats**).
- **i18n (en / it):** additional tooltips for dock, sidebar chrome, GraphIO overflow menu, Inspector resize handle, mentor FAB toggle.

### Documentation

- **Cursor rules:** `project.mdc` nudges updating `CHANGELOG.md` → **`[Unreleased]`** for notable changes (details in `changelog.mdc`).

## [0.1.0-alpha.9] - 2026-05-13

### Added

- **Graph undo/redo:** snapshot history (50 steps) before structural edits and on drag-start; **⌘Z** / **Ctrl+Z** and **⌘⇧Z** / **Ctrl+Shift+Z**; floating **UndoRedoControls**; shortcuts dialog entries. History clears on load, new graph, or import.

### Documentation

- **README** roadmap: undo/redo marked complete.

## [0.1.0-alpha.8] - 2026-05-12

### Added

- **Per-node elaboration** in the Inspector: definition, examples, notes, and optional Wikimedia Commons thumbnail + attribution fields on `ConceptNodeData`.
- **Resizable Inspector** panel with width persisted in `localStorage`; shared layout constants (`INSPECTOR_CANVAS_LEFT_GUTTER`, clamp/read/write helpers) so fit-to-view, new-node placement, and canvas insets track the live panel width.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Theme scrollbars:** `.nesso-scrollbar` utility for on-theme thin scrollbars (Inspector body).
- **Top bar:** exported `TOPBAR_HEIGHT_PX` so layout chrome stays aligned with the Inspector.

### Fixed

- **Settings → AI:** clearer Ollama / CORS guidance when the app is not served from `localhost` (uses the current origin in the `OLLAMA_ORIGINS` hint).

### Documentation

- **README** roadmap: Design section (Inspector + Review dialog), Wikipedia/Wikidata AI item, per-node elaboration marked complete.

## [0.1.0-alpha.7] - 2026-05-11

### Added

- **AI-guided review:** **ReviewMode** generates a Socratic question from the current card’s semantic edges (outgoing + incoming), then a short explanatory answer; works with remote Ollama or local WebLLM via a shared completion path.
- **`src/llm/completion.ts`:** `fetchCompletion` and `isAiReady` for OpenAI-compatible `chat/completions` and the in-browser MLC engine.
- **Settings → AI (remote):** Ollama model preset chips (`gemma3:4b`, `llama3.2:3b`, `qwen2.5:7b`), model availability check (`/models`), and **Pull** with progress when the model is missing locally.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Default remote model:** `gemma3:4b` (was `gemma2:2b`); README quick-start example updated.
- **Socrates (mentor):** Graph snapshot prefers weaker / due nodes; node lines show stability, last FSRS rating, and **DUE**; larger reply budget and guidance to open on weak spots when nothing is selected.
- **Local WebLLM:** **App** no longer auto-runs `initWebLLM()` when local mode is selected; initialise from **Settings** (existing Download / Initialise controls).

### Documentation

- **README** roadmap: AI-guided spaced repetition marked done; Transformers.js / small local models added as future work.

## [0.1.0-alpha.6] - 2026-05-11

### Added

- **FSRS v6 review scheduling (`ts-fsrs`):** Replaced the day/confidence heuristic with principled spaced repetition. Per-node `stability`, `difficulty`, `lapses`, `reps`, `due`, and `lastRating` are persisted. Rating UI: Again / Hard / Good / Easy in **ReviewMode**. Settings → Review exposes **`fsrsRetention`** and **`maximumInterval`**. `conf` / `reviewedAt` removed from node data.
- **Confidence heatmap:** Concept nodes can be tinted by confidence (`--conf-1` … `--conf-5` overlay); `NessoSettings.showHeatmap` (default **on** for new sessions, persisted).
- **Demo seeds:** Bundled **Plant life cycle** and **Solar system** graphs (`src/data/seeds/*.json`); on first launch, an empty IndexedDB is populated with both. `seedGraph.ts` exports `SEEDS` with stable ids derived from each seed’s display name.
- **`CloseButton`:** Shared header dismiss control for Settings, shortcuts, and relation-type modals.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

- **Review scheduling:** Removed **Cards per session** (`reviewBatchMax`). The Review overlay lists **all** due concepts allowed by FSRS subject to **New cards / day** (`sortedDueConceptNodes` + `dailyStudyCounters`).
- **FSRS:** Review scheduling uses **`maximumInterval`** (days) and **`fsrsRetention`** from Settings → Review (`fsrs({ request_retention, maximum_interval })` in **ReviewMode**).
- **Daily study caps (Anki-style):** Settings → Review adds **New cards / day** (default 20, **0** = unlimited). Due queues (`sortedDueConceptNodes` + `dailyStudyCounters`) cap how many never-rated cards appear **per local calendar day**; counts persist and reset at local midnight.
- **First-run / onboarding:** Removed the tutorial overlay; **?** still toggles keyboard shortcuts.
- **Top bar:** **Review** is a pill with icon + **R** hint; relation types, JSON export/import, and keyboard shortcuts are grouped under a single **⋯** menu (`GraphIO`, theme tokens instead of a fixed black pill).
- **Sidebar:** Footer is one full-width **Settings** row (⌘,); theme toggle lives under Settings → **Appearance** (not Display). Shortcuts open via **?** or the top-bar menu.
- **Modals:** Settings, shortcuts, and relation types are wider (~520px), with a header close control instead of a footer **Close** button.
- **Defaults:** Sidebar starts expanded with the Display section open.
- **Fit / viewport:** After switching graphs, the saved viewport applies only once nodes are present; if there is no saved view, fit runs after layout via `requestAnimationFrame`, using UI chrome insets and slightly tighter padding.
- Light-theme `--conf-4` and `--conf-5` values for clearer distinction on the heatmap.
- **Socrates (AI panel):** Single graph-focused chat — removed Review/Bootstrap mode tabs and FSRS grading from the mentor card; spaced repetition stays in **Review** (**R**).
- **Housekeeping:** Removed unused **`GraphSwitcher`** component; dropped persisted **`reviewRated`** (only **`newRated`** drives the daily new-card cap); simplified **`ReviewMode.advance`** (no skip/`null` path); removed unused **`viewport`** field from **`GraphRecord`**; dropped unused CSS **`--shadow-sm`**; **`SocratesGlyph`** no longer exposes a **`mood`** prop.

### Fixed

- **Mentor FAB:** Outer `MentorBubble` shell uses `pointer-events: none` and the FAB `pointer-events: auto` so the expanded panel does not block clicks on the canvas.
- **Auto-save / graph list:** Switching graphs no longer bumps `updatedAt` or reorders the sidebar from a spurious save (`loadGraph` increments `loadedToken`; `useAutoSave` skips the debounced run triggered by that load).

## [0.1.0-alpha.5] - 2026-05-06

### Added

- **Concept search:** `SearchDialog` — **⌘K** / **Ctrl+K** or TopBar control; filter concepts by label, **Enter** or click to select and center the canvas on the node.

### Changed

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

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

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

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

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

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

- **Desktop:** "Open Project" and "Create Project" are now unified into a single "Add Project" flow. The sidebar "+" button and the native File → "Open or Create Project…" menu item both open the same native folder picker, where users can pick an existing project or create a new folder in one interaction. Removed the separate `createProjectFolder` dialog, the `new-project` native menu item with `CmdOrCtrl+Shift+N`, and the two-item dropdown in the sidebar. i18n keys consolidated from three to two.

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

[Unreleased]: https://github.com/nesso-how/nesso/compare/v0.2.0-beta.0...HEAD
[0.2.0-beta.0]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.41...v0.2.0-beta.0
[0.1.0-alpha.41]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.40...v0.1.0-alpha.41
[0.1.0-alpha.40]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.39...v0.1.0-alpha.40
[0.1.0-alpha.39]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.38...v0.1.0-alpha.39
[0.1.0-alpha.38]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.37...v0.1.0-alpha.38
[0.1.0-alpha.37]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.36...v0.1.0-alpha.37
[0.1.0-alpha.36]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.35...v0.1.0-alpha.36
[0.1.0-alpha.35]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.34...v0.1.0-alpha.35
[0.1.0-alpha.34]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.33...v0.1.0-alpha.34
[0.1.0-alpha.33]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.32...v0.1.0-alpha.33
[0.1.0-alpha.32]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.31...v0.1.0-alpha.32
[0.1.0-alpha.31]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.30...v0.1.0-alpha.31
[0.1.0-alpha.30]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.29...v0.1.0-alpha.30
[0.1.0-alpha.29]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.28...v0.1.0-alpha.29
[0.1.0-alpha.28]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.27...v0.1.0-alpha.28
[0.1.0-alpha.27]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.26...v0.1.0-alpha.27
[0.1.0-alpha.26]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.25...v0.1.0-alpha.26
[0.1.0-alpha.25]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.24...v0.1.0-alpha.25
[0.1.0-alpha.24]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.23...v0.1.0-alpha.24
[0.1.0-alpha.23]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.22...v0.1.0-alpha.23
[0.1.0-alpha.22]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.21...v0.1.0-alpha.22
[0.1.0-alpha.21]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.20...v0.1.0-alpha.21
[0.1.0-alpha.20]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.19...v0.1.0-alpha.20
[0.1.0-alpha.19]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.18...v0.1.0-alpha.19
[0.1.0-alpha.18]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.17...v0.1.0-alpha.18
[0.1.0-alpha.17]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.16...v0.1.0-alpha.17
[0.1.0-alpha.16]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.15...v0.1.0-alpha.16
[0.1.0-alpha.15]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.14...v0.1.0-alpha.15
[0.1.0-alpha.14]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.13...v0.1.0-alpha.14
[0.1.0-alpha.13]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.12...v0.1.0-alpha.13
[0.1.0-alpha.12]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.11...v0.1.0-alpha.12
[0.1.0-alpha.11]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.10...v0.1.0-alpha.11
[0.1.0-alpha.10]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.9...v0.1.0-alpha.10
[0.1.0-alpha.9]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.8...v0.1.0-alpha.9
[0.1.0-alpha.8]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.7...v0.1.0-alpha.8
[0.1.0-alpha.7]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.6...v0.1.0-alpha.7
[0.1.0-alpha.6]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.5...v0.1.0-alpha.6
[0.1.0-alpha.5]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.4...v0.1.0-alpha.5
[0.1.0-alpha.4]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.3...v0.1.0-alpha.4
[0.1.0-alpha.3]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.2...v0.1.0-alpha.3
[0.1.0-alpha.2]: https://github.com/nesso-how/nesso/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/nesso-how/nesso/releases/tag/v0.1.0-alpha.1
