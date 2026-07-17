# Testing

Unit/integration tests run on **Vitest**. They cover pure, side-effect-free logic — the base of the pyramid. Browser/e2e flows are a separate layer ([E2E](#e2e-playwright-web-ui), issue #28), so Vitest never touches Tauri, the network, or real rendering.

## When to add tests

When a change adds or alters logic this layer can reach, extend the co-located tests **in the same change**: pure functions (packages, `src/lib/**`), store mutations/selectors, and the workspace disk↔IDB layer. This is a judgement call, not a mandate to test everything — weigh it by regression risk:

- **Default to a test** for branchy or stateful logic: validation, serialization, name/id dedup, merge/reconcile, undo/redo, collision handling.
- **Usually skip** a one-obvious-path helper, a thin pass-through, or pure UI wiring.
- **Out of scope here:** component rendering and real Tauri/network — those belong to e2e (#28).

Regression-prone logic landing without a test should be the exception, and worth a line in the PR when it happens.

## Layout and scripts

- Co-locate `*.test.ts` next to the code under test (e.g. `packages/schema/src/index.test.ts`, `src/lib/workspace/paths.test.ts`).
- Import the test API explicitly (`import { describe, expect, it } from 'vitest'`) — there is no `globals: true`, so no tsconfig `types` entry is needed.
- Scripts: `pnpm test` (run once, CI), `pnpm test:watch` (watch), `pnpm test:coverage` (v8 coverage report).

## Environment split

Default environment is **`node`**. A file that touches the store, React, or the DOM opts into jsdom with a first-line docblock:

```ts
// @vitest-environment jsdom
```

Only the store-slice test needs jsdom today (the editing slice imports `@xyflow/react`). Everything else — package logic, geometry, ids, clipboard, workspace path/manifest helpers — stays in `node`.

## Module resolution (`vitest.config.ts`)

- `@/…` → `src/…`.
- `@nesso-how/schema`, `@nesso-how/vocab-learning`, `@nesso-how/graph`, and `@nesso-how/theme` are all aliased to their **source** (`packages/*/src/index.ts`) so tests run against source without a build. `prepare` still rebuilds every package's `dist` on `pnpm install` for the app build. In `@nesso-how/graph`'s own package tests, import geometry/helpers from the specific source file (`./geometry.js`) rather than the React-pulling barrel.

## Keeping test files out of published packages

Each package's `tsconfig.json` (`include: ["src"]`) also lists `"exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]`, so `pnpm --filter … build` never emits test files into `dist` (and `files: ["dist"]` never publishes them). Add the same exclude when giving a new package its first test.

## Conventions

- App-side test files live under `src/`, so they need the SPDX header like any other `src` file (license-headers gate).
- Test pure functions and store mutations directly; for store slices, compose a headless vanilla store from the slice creators (`zustand/vanilla` `createStore`) instead of importing the persisted `useGraphStore`.
- Reset module-level singletons (e.g. the graph clipboard via `setGraphClipboard(null)`, the disk-sync cache via `setDiskSyncCache(...)`) in `beforeEach`.

## Workspace / IndexedDB integration

The workspace layer (`src/lib/workspace/**`, `src/store/db.ts`) is the most regression-prone area, so test it as real integration rather than mocking each helper:

- **IndexedDB** — `import 'fake-indexeddb/auto'` as the **first** import (before any module that loads `@/store/db`, which opens the DB at module scope). Clear it with `dbClearGraphs()` in `beforeEach`. `db.ts` and the store run unmodified against a real in-memory IDB.
- **Tauri fs** — mock only at the boundary, reusing the shared in-memory filesystem in `src/test/fakeTauriFs.ts`: `vi.mock('@tauri-apps/plugin-fs', async () => (await import('@/test/fakeTauriFs')).fakeFsPlugin)` (and `…fakePathApi` / `…fakeCoreApi` / `…fakeDialogApi`). The static `import { tauriFsState }` and these dynamic imports resolve to the same instance, so assertions read the same disk the mocks mutate. Everything above the plugin (`sync`, `graphFiles`, `manifest`, `paths`) then exercises the real merge logic. `reset()` it in `beforeEach`. See `src/lib/workspace/sync.test.ts`.
- **Store IO in web mode** — `isDesktop()` is false under jsdom, so graph-management mutations persist through IndexedDB only and need no fs mock. Seed `loadGraphList()` first so every `graphList` meta has a backing record.
- **Store IO in desktop mode** — set `window.__TAURI_INTERNALS__ = {}` in `beforeEach` to flip `isDesktop()` true; the store then drives the real workspace layer against the fake fs + fake-indexeddb (disk is the source of truth). See `src/store/slices/graph-management.desktop.test.ts`.

## CI

`pnpm test:coverage` runs as a required step in `.github/workflows/ci.yml`, gating PRs alongside the checks described in [static-analysis](static-analysis.md). Package `dist` is in place because the prior `pnpm install --frozen-lockfile` step runs `prepare`.

### Coverage thresholds (ratchet)

`vitest.config.ts` sets `coverage.thresholds` as a **ratchet floor**, not an aspirational target — the same honest-baseline pattern as `type-coverage` (99%) and the fallow baselines. Each number is the current measured coverage rounded down a couple of points (v8 counts drift slightly between the local and CI Node), so CI is green today and red on any real drop. The global floors stay low because the included-but-untested UI sits in the denominator; **per-directory globs** hold the regression-prone logic to a far higher bar: `packages/schema/**`, `packages/theme/**`, `src/lib/workspace/**`, and `src/store/slices/**`. Globs are an _additional_ check: Vitest 4 still counts those files in the global numbers too.

Glob granularity is deliberate. A folder gets a directory floor only when it is pure testable logic end to end. Where a folder mixes tested logic with code this layer cannot reach, the floor targets the **file**, not the folder: `packages/graph/src/geometry.ts` (edge-curve math — the rest of `packages/graph` is React rendering only the e2e layer #28 reaches), `src/lib/graphClipboard.ts` / `src/lib/graphId.ts` (the rest of `src/lib` is untested desktop/IO glue), and `src/llm/context.ts` / `src/data/fsrsDueQueue.ts` (the rest of those folders — `completion.ts`'s network transport, `src/data`'s seed/storage glue — isn't held to the same bar). An aggregate floor over those folders would be diluted to ~31% / ~33% and guard nothing. Same reason the store glue `src/store/index.ts` sits outside the `src/store/slices/**` floor. Files covered only **incidentally** by other suites (`src/data/seedGraph.ts`, parts of `src/store/db.ts`) get no floor — their numbers move with unrelated tests. Packages with no meaningful unit surface stay global-only: `mcp` (loaders/tooling), `vocab-learning` (static vocabulary + thin serialize wrapper).

**Re-baseline habit:** raise the floors as coverage climbs. When a change _intentionally_ lowers a number — deleting tested code, or a measured-surface shift once the e2e layer (#28) lands — re-snapshot from a fresh `pnpm test:coverage` and update `vitest.config.ts` in the **same change**, rather than leaving the gate red. This mirrors `--save-baseline` for the fallow ratchets.

## E2E (Playwright web UI + tauri-driver native)

The top of the pyramid: real-rendering flows that Vitest cannot reach. Split along the product's own `isDesktop()` boundary (issue #28), there are two disjoint lanes with **no shared spec code** — Playwright owns the web UI, a tauri-driver lane owns the native layer.

- **Playwright** (`playwright.config.ts`, specs in `e2e/*.spec.ts`) drives the Vite **web build** — every flow that works in a plain browser (`isDesktop() === false`). It boots its own dev server (`webServer: pnpm dev`, reused locally / fresh in CI) and targets `chromium`. Run with `pnpm test:e2e` (or `pnpm test:e2e:ui` for the trace viewer). Shared actions (new empty graph, create concept, drag-connect, select edge) live in `e2e/helpers.ts`; import fixtures in `e2e/fixtures/`.
- **tauri-driver + WebdriverIO** (`e2e-native/wdio.conf.ts`, specs in `e2e-native/*.e2e.ts`) drives the **native Tauri shell** — what the browser lane structurally cannot reach (`isDesktop() === true`): the real fs plugin, the fs watcher (`useGraphFileWatch`), and `desktop-sync`. **Local-only** (not a CI gate): run via `e2e-native/run-local.sh` on macOS (streams the working tree into a pre-baked Docker image — full WebKit runtime + WebKitWebDriver + xvfb + Rust + tauri-driver) or `pnpm test:e2e:native` on a Linux host with the deps installed. Failure diagnostics land in `e2e-native/artifacts/`. `wdio.conf.ts` builds the debug binary in `onPrepare` (`tauri build --debug --no-bundle`), starts **one long-lived `tauri-driver`** (waits on its port; `--native-driver` passed explicitly; path resolved via `TAURI_DRIVER_BIN` → `~/.cargo/bin` → PATH) and resets the workspace per spec; helpers (`e2e-native/helpers.ts`) talk to the same on-disk workspace (`~/.local/share/dev.nesso.desktop/graphs/`) the app reads and writes.

Web coverage (Playwright): graph editing (create node, drag-connect a relation, change relation type, delete edge), selection + history (undo/redo, multi-select delete), graph management (create/switch/delete, JSON export/import), persistence across reload, settings (dark mode, language), and inline-edit (multiline auto-grow + ResizeObserver).

Native coverage (tauri-driver): disk-first autosave (concept lands in a workspace `.json`), rehydration from disk across an app relaunch, the real fs watcher reconciling an externally added graph, and desktop-sync reloading the active graph after an external edit.

**WebDriver cannot drive native OS windows** — the folder/save **dialogs** (`pickWorkspaceFolder`) and the **native menu bar** are not DOM, so multi-project switching, native import/export, and menu commands stay covered by Vitest (`graph-management.desktop.test.ts`, `useDesktopMenu`), not this lane. The external-conflict **banner** branch (unsaved local edits + an external write) needs deterministic timing control and is a follow-up; the no-local-edits reload branch is covered.

Conventions:

- **Selectors:** prefer React Flow's stable DOM classes (`.react-flow__pane`, `.react-flow__node`, `.react-flow__edge`, `.react-flow__handle-right`, `.react-flow__handle-left`, and the edge glyph badge `.react-flow__edge circle` for selecting an edge); both lanes share them. Add a `data-testid` only where the existing handle is localized/fragile — today `relation-chip-<id>` (`RelationPicker`), `sidebar-new-graph` (`Sidebar`), `graph-io-menu` (`GraphIO`), and `edge-current-relation` (`EdgeInspector`).
- **Serial:** `playwright.config.ts` sets `workers: 1` / `fullyParallel: false` — the specs share one dev server, which gets flaky under several concurrent React Flow contexts. The native lane is likewise `maxInstances: 1`: tauri-driver stays alive across specs, so `beforeSession` runs only once per worker; `wdio.conf.ts` resets the on-disk workspace in `before` (once per `*.e2e.ts`, including deferred retries) so graph files cannot leak between specs. They work with the default-named graph a fresh "new graph" produces and identify graphs by their on-disk node content rather than driving the timing-fragile inline-rename input; `afterTest` dumps the rendered DOM + a screenshot to `e2e-native/artifacts/` on failure (written to the host on a local `run-local.sh` run). `specFileRetries: 2` covers the **cold first WebDriver session** (tauri-driver launches WebKitWebDriver for the first time, so the first spec can time out on a slow autosave/render); tauri-driver stays alive across specs, so the re-run executes warm and passes, and later specs run warm and pass first try.
- **Timing:** the autosave is debounced 500ms (`useAutoSave`) and the fs watcher 400ms (`useGraphFileWatch`); selection syncs via `requestAnimationFrame`. A flow that reloads/switches graphs or asserts on disk must wait for the flush — the native helpers poll the filesystem (`waitForCondition`). Chromium's File System Access API (`showSaveFilePicker`) blocks driving a real JSON export in the web lane — the export spec deletes it via `addInitScript` to force the anchor-download fallback.
- **Naming:** Playwright specs are `*.spec.ts`, native specs `*.e2e.ts` (and `e2e-native/` is a separate dir), so neither the Vitest runner nor the Playwright `testMatch` picks up the other. Both `e2e/` and `e2e-native/` sit outside `tsconfig.app.json`, the license-header roots, and `coverage.include`, so they do not feed the Vitest coverage ratchet or the build/type gates. Each has its own `tsconfig.json`, and both are excluded from fallow via `.fallowrc.jsonc` (`ignorePatterns` + `@playwright/test` / the `@wdio/*` stack in `ignoreDependencies`).
- **CI:** three gated lanes in `.github/workflows/ci.yml` (`js`, `rust`, `e2e`) plus a path-filter job (`changes`) and an aggregator (`ci`, `re-actors/alls-green`). On **PRs**, each lane runs only when relevant paths change; on **push to `main`** every lane runs (cache warming for pnpm and `rust-cache`). The sole **required merge gate** on `main` is the `ci` job (ruleset _main protection_). `e2e` uploads the HTML report on failure.

Canvas drag-connect is covered for both origin handles: `e2e/graph-editing.spec.ts` tests right-to-left (existing) and left-to-right (issue #127 regression). Both verify the relation picker opens and the edge inspector shows the correct source→target orientation. The shared `dragConnect` helper in `e2e/helpers.ts` accepts `fromSide` / `toSide` params defaulting to `right`.

## Mutation testing (StrykerJS)

Coverage proves a line _runs_ under test; it cannot tell whether the assertions would _catch a regression_ — a test that calls a function and pins nothing still counts as covered. **StrykerJS** (issue #55) closes that blind spot: it injects small systematic mutations into the source (`>` → `>=`, `&&` → `||`, negated conditions, removed statements, swapped returns, …) and reruns the suite per mutant. A mutant **killed** (a test fails) means the suite catches that bug; a mutant that **survives** (all tests still pass) marks behaviour the tests don't actually assert. The **mutation score** (killed / covered) is the headline metric, and each area's `thresholds.break` is its ratchet floor — same honest-baseline pattern as the coverage thresholds and `type-coverage`.

- **Runner.** The `vitest` runner (`@stryker-mutator/vitest-runner`) runs against the real suite and `vitest.config.ts` resolution. `coverageAnalysis: 'perTest'` means the one-off dry run executes the whole suite, then each mutant reruns only the tests that cover it. pnpm's non-hoisted layout needs the runner named explicitly in `plugins`.
- **Per-area configs, per-area floors.** A shared base (`scripts/stryker/base.mjs`) plus one config per area (`scripts/stryker/<area>.mjs`, built via `area()`), each with its own `mutate` and `break`. Thresholds are **per area, not aggregated**: a tiny well-tested package would otherwise mask a large less-tested one (the same reason `vitest.config.ts` keeps per-directory coverage floors). `mutate` is pure logic only — UI/React and the Rust layer stay out of scope. Each area is scoped to its _tested_ source and excludes glue: the store config takes the two tested slices (not `settings`/`ui`/`desktop-sync`/`index.ts`); the workspace config excludes the Tauri boundary (`watch.ts`, `scope.ts`) and the barrel; the mentor config takes `context.ts` + `fsrsDueQueue.ts` (not the network transport in `completion.ts`).
- **Not a per-PR gate.** The per-mutant reruns are too slow for every push, so this runs **opt-in locally** (`pnpm run analyze:mutation` for all areas, `pnpm run analyze:mutation:<area>` for one, or **`pnpm run analyze:mutation:changed`** to run only areas touched by the branch diff vs `main` — see [`scripts/stryker/areas.mjs`](../scripts/stryker/areas.mjs) and [`scripts/stryker/changed.mjs`](../scripts/stryker/changed.mjs)) and on a **non-blocking scheduled job** (`.github/workflows/mutation.yml`, weekly + `workflow_dispatch`, one step per area), never as a required check. **Preflight:** run `analyze:mutation:changed` before push when the diff touches mutated pure logic (same conditional pattern as the Rust block in the preflight skill). Incremental mode (`stryker run --incremental` + a cached incremental file) is left for the scheduled job to opt into once full runs get expensive. Reports land in `reports/mutation/<area>/` (gitignored). The config file is a **positional** arg to `stryker run` — `-c` is Stryker's alias for `--concurrency`, not config.
- **Area registry.** [`scripts/stryker/areas.mjs`](../scripts/stryker/areas.mjs) is the single source for each area's `mutate` globs, ratchet floor, and git-diff `touch` prefixes; each `scripts/stryker/<area>.mjs` imports from it.
- **Equivalent mutants.** Some mutations produce semantically identical code (a `typeof x !== 'number'` guard subsumed by a following `!Number.isFinite(x)`; an id-collision `Set` whose contents never collide; a referential-identity micro-optimisation in a no-op guard; a `.trim()` removed from already-trimmed input; a `<=`→`<` boundary at an unreachable exact value). No test can kill them, so 100% is unreachable by design. Note: Stryker's `MethodExpression` mutator drops the **last** call in a chain, so `x.replace(/…/).trim()` mutates to `x.replace(/…/)` — only whitespace-laden inputs catch it. Document known equivalents next to the threshold rather than chasing them or contorting source to kill them.
- **Baselines (per area).** Each `break` sits a couple points under the measured score. Raise it as the score climbs; when a change intentionally lowers it (deleting tested code), re-baseline the area's `break` in the same change.
  - `schema` — structural serialize/deserialize in `@nesso-how/schema`; re-baseline `break` when the document shape changes.
  - `mentor` (`context.ts` + `fsrsDueQueue.ts` + app `nodeToCard` / display merge) — **87.50%** (112/128), residual mostly equivalent truncation regex/boundary; `break` 84.
  - `store` (`graph-editing` + `graph-management`) — **71.40%** (669/937), a real climb target; `break` 69.
  - `workspace` (`src/lib/workspace/**` minus the Tauri glue) — **63.13%** (250/396), residual in fault-injection / fs-error paths the e2e layer (#28) owns; `break` 61.

## E2E focus assertions (Playwright)

When testing node creation focus, use `page.keyboard.type()` — never `input.fill()`. The `fill()` method internally calls `.focus()` on the target before filling, so it always succeeds — making it unable to detect focus failures. Use `keyboard.type()` instead, which preserves the existing focus state. The correct pattern:

```ts
// Create a node, then wait for the async focus retry loop to complete
await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT')
// Type without explicitly clicking the input
await page.keyboard.type('hello')
// Add the guard-wait so the expectation is race-free
await expect(page.locator('.nesso-node-label')).toContainText('hello')
```

The `waitForFunction` guard is necessary because focus is deferred through `requestAnimationFrame` retries — the `.focus()` call runs asynchronously after React Flow finishes its internal layout effects.
