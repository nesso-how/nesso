# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for published releases (npm `package.json` and Tauri `tauri.conf.json`).

## [Unreleased]

### Removed

- **Sidebar:** Recent concepts section (use ⌘K search to jump to nodes).

## [0.1.0-alpha.20] - 2026-05-20

### Added

- **`@nesso-how/types`** — new npm package exporting all shared graph types (`ConceptNodeData`, `NessoSettings`, `NessoEdgeData`, `GraphDisplaySettings`, helpers `nodeToCard`, `defaultGraphDisplay`, `mergeGraphDisplay`). `src/types/graph.ts` is now a re-export shim so no app imports change.
- **`@nesso-how/formats`** — new npm package with `NessoGraphFile` type, `serializeGraph`, and `deserializeGraph`; `GraphIO.tsx` now uses these instead of inline `JSON.stringify`/`JSON.parse`.

### Changed

- **Canvas:** Concept node target handle is larger (22px) with a radial ring for easier edge drops.

### Fixed

- **CI:** npm publish uses **Trusted Publishing** (OIDC) instead of `NPM_TOKEN`, avoiding 2FA / `EOTP` failures in release workflows.

## [0.1.0-alpha.19] - 2026-05-20

### Changed

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

- **Workspace packages:** **`@nesso-how/relation-types`** and **`@nesso-how/mcp`** declare **`publishConfig.access: public`** so `npm publish` targets the **public** registry for scoped packages (otherwise npm defaults scoped packages to **restricted / private**).

### Added

- **Docs (landing):** Marketing homepage shows release tag (**`vx.y.z…`**) linking to GitHub Releases for that tag (`package.json` version).

## [0.1.0-alpha.16] - 2026-05-16

### Changed

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

- **Inspector:** collapsed/expanded state for **Examples** and **Relations** is saved in app settings (persisted with other preferences).
- **Typography:** clearer Fraunces (concept copy) vs Inter (menus, dialogs chrome) split; tuned sizes in Inspector, Review mode, Search, Mentor, and Graph IO.

### Added

- **Seeds:** elaboration fields (definition, examples, notes) on every concept in the Plant biology and Italian Biologia vegetale demo graphs.

### Fixed

- **Graph:** ignore drag-to-self connections so the relation picker does not open for self-loops.

## [0.1.0-alpha.12] - 2026-05-14

### Changed

- **Brand:** nexus brandmark (SVG) in the sidebar; favicon and `public/icon/` assets; desktop app icons regenerated from the 512² tile artwork.

### Fixed

- **Favicon:** SVG tab icon follows `prefers-color-scheme` so the mark stays visible on dark browser chrome (e.g. Firefox).

## [0.1.0-alpha.11] - 2026-05-14

### Added

- **Graph:** multi-selection (Shift drag rectangle, **⌘/Ctrl** additive click); **`selectedIds`** in the store with **Delete selected** on the bottom dock; **Delete**/**Backspace** remove nodes via React Flow with undo history.

### Changed

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

[Unreleased]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.20...HEAD
[0.1.0-alpha.20]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.19...v0.1.0-alpha.20
[0.1.0-alpha.19]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.18...v0.1.0-alpha.19
[0.1.0-alpha.18]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.17...v0.1.0-alpha.18
[0.1.0-alpha.17]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.16...v0.1.0-alpha.17
[0.1.0-alpha.16]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.15...v0.1.0-alpha.16
[0.1.0-alpha.15]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.14...v0.1.0-alpha.15
[0.1.0-alpha.14]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.13...v0.1.0-alpha.14
[0.1.0-alpha.13]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.12...v0.1.0-alpha.13
[0.1.0-alpha.12]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.11...v0.1.0-alpha.12
[0.1.0-alpha.11]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.10...v0.1.0-alpha.11
[0.1.0-alpha.10]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.9...v0.1.0-alpha.10
[0.1.0-alpha.9]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.8...v0.1.0-alpha.9
[0.1.0-alpha.8]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.7...v0.1.0-alpha.8
[0.1.0-alpha.7]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.6...v0.1.0-alpha.7
[0.1.0-alpha.6]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.5...v0.1.0-alpha.6
[0.1.0-alpha.5]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.4...v0.1.0-alpha.5
[0.1.0-alpha.4]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.3...v0.1.0-alpha.4
[0.1.0-alpha.3]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.2...v0.1.0-alpha.3
[0.1.0-alpha.2]: https://github.com/cedoor/nesso/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/cedoor/nesso/releases/tag/v0.1.0-alpha.1
