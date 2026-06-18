# Testing

Unit/integration tests run on **Vitest**. They cover pure, side-effect-free logic — the base of the pyramid. Browser/e2e flows are a separate concern (issue #28), so this layer never touches Tauri, the network, or real rendering.

## When to add tests

When a change adds or alters logic this layer can reach, extend the co-located tests **in the same change**: pure functions (packages, `src/lib/**`), store mutations/selectors, and the workspace disk↔IDB layer. This is a judgement call, not a mandate to test everything — weigh it by regression risk:

- **Default to a test** for branchy or stateful logic: validation, serialization, name/id dedup, merge/reconcile, undo/redo, collision handling.
- **Usually skip** a one-obvious-path helper, a thin pass-through, or pure UI wiring.
- **Out of scope here:** component rendering and real Tauri/network — those belong to e2e (#28).

Regression-prone logic landing without a test should be the exception, and worth a line in the PR when it happens.

## Layout and scripts

- Co-locate `*.test.ts` next to the code under test (e.g. `packages/formats/src/index.test.ts`, `src/lib/workspace/paths.test.ts`).
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
- `@nesso-how/types` and `@nesso-how/relation-types` are aliased to their **source** (`packages/*/src/index.ts`) so tests run against source without a build.
- `@nesso-how/graph` is **not** aliased: its barrel re-exports built `.js` paths and pulls in React, so it resolves to `dist`. That `dist` is always present because `prepare` rebuilds every workspace package on `pnpm install`. Import geometry/helpers from the specific source file (`./geometry.js`) in the package's own tests to avoid the barrel.

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

`pnpm test:coverage` runs as a required step in `.github/workflows/ci.yml`, gating PRs alongside `format:check`, `lint`, and `build`. Package `dist` is in place because the prior `pnpm install --frozen-lockfile` step runs `prepare`.

### Coverage thresholds (ratchet)

`vitest.config.ts` sets `coverage.thresholds` as a **ratchet floor**, not an aspirational target — the same honest-baseline pattern as `type-coverage` (99%) and the fallow baselines. Each number is the current measured coverage rounded down a couple of points (v8 counts drift slightly between the local and CI Node), so CI is green today and red on any real drop. The global floors stay low because the included-but-untested UI sits in the denominator; **per-directory globs** hold the regression-prone logic to a far higher bar: `packages/formats/**`, `packages/theme/**`, `src/lib/workspace/**`, and `src/store/slices/**`. Globs are an _additional_ check: Vitest 4 still counts those files in the global numbers too.

Glob granularity is deliberate. A folder gets a directory floor only when it is pure testable logic end to end. Where a folder mixes tested logic with code this layer cannot reach, the floor targets the **file**, not the folder: `packages/graph/src/geometry.ts` (edge-curve math — the rest of `packages/graph` is React rendering only the e2e layer #28 reaches) and `src/lib/graphClipboard.ts` / `src/lib/graphId.ts` (the rest of `src/lib` is untested desktop/IO glue). An aggregate floor over those folders would be diluted to ~31% / ~33% and guard nothing. Same reason the store glue `src/store/index.ts` sits outside the `src/store/slices/**` floor. Files covered only **incidentally** by other suites (`src/data/seedGraph.ts`, `src/store/db.ts`) get no floor — their numbers move with unrelated tests. Packages with no meaningful unit surface stay global-only: `mcp` (loaders/tooling), `relation-types` (static vocabulary), `types` (type-only).

**Re-baseline habit:** raise the floors as coverage climbs. When a change _intentionally_ lowers a number — deleting tested code, or a measured-surface shift once the e2e layer (#28) lands — re-snapshot from a fresh `pnpm test:coverage` and update `vitest.config.ts` in the **same change**, rather than leaving the gate red. This mirrors `--save-baseline` for the fallow ratchets.
