// SPDX-License-Identifier: MIT
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

const fromRoot = (rel: string) => fileURLToPath(new URL(rel, import.meta.url))

// Pure modules run in `node`; files that touch the store/React/DOM opt into
// jsdom per-file with a `// @vitest-environment jsdom` docblock.
//
// Leaf packages with clean source resolution are aliased to `src` so tests run
// against source without a build. `@nesso-how/graph` keeps the default
// resolution (its barrel uses built `.js` paths and pulls React) and relies on
// `dist`, which `prepare` rebuilds on every install.
export default defineConfig({
  resolve: {
    alias: {
      '@': fromRoot('./src'),
      '@nesso-how/types': fromRoot('./packages/types/src/index.ts'),
      '@nesso-how/relation-types': fromRoot('./packages/relation-types/src/index.ts'),
      '@nesso-how/theme': fromRoot('./packages/theme/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'packages/*/src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts'],
      // Ratchet floor, not an aspirational target: each number is the current
      // measured coverage rounded down a couple of points (v8 counts can drift
      // slightly between the local and CI Node). CI is green today and red on
      // any real drop — the same honest-baseline pattern as `type-coverage`
      // (99%) and the fallow baselines. Raise these as coverage climbs; when a
      // change *intentionally* lowers a number (e.g. deleting tested code, or a
      // surface shift once the e2e layer in #28 lands), re-baseline in the same
      // change rather than leaving the gate red. Globals stay low because the
      // included-but-untested UI is in the denominator; the per-directory
      // entries hold the regression-prone logic (`.rules/testing.md`) to a far
      // higher bar. Globs are an *additional* check — Vitest still counts those
      // files in the global numbers too.
      //
      // The glob granularity is deliberate: directory floors where the whole
      // package/folder is pure testable logic (formats, theme, the store slices,
      // the workspace layer); single-file floors where a folder mixes tested
      // logic with code this layer cannot reach — `geometry.ts` (the rest of
      // `packages/graph` is React rendering only the e2e layer in #28 reaches),
      // and `graphClipboard.ts` / `graphId.ts` (the rest of `src/lib` is untested
      // desktop/IO glue). An aggregate floor over those folders would be diluted
      // to ~31%/~33% and guard nothing. Same reason `src/store/index.ts` (store
      // glue) is out of the slice floor. Files only covered incidentally by other
      // suites (`src/data/seedGraph.ts`, `src/store/db.ts`) get no floor — their
      // numbers move with unrelated tests. Packages with no meaningful unit
      // surface stay global-only: `mcp` (loaders/tooling), `relation-types`
      // (static vocabulary), `types` (type-only).
      thresholds: {
        statements: 21,
        branches: 15,
        functions: 18,
        lines: 22,
        'packages/formats/**': {
          statements: 95,
          branches: 90,
          functions: 86,
          lines: 95,
        },
        'packages/theme/**': {
          statements: 91,
          branches: 78,
          functions: 98,
          lines: 94,
        },
        'packages/graph/src/geometry.ts': {
          statements: 88,
          branches: 81,
          functions: 75,
          lines: 88,
        },
        'src/lib/graphClipboard.ts': {
          statements: 98,
          branches: 88,
          functions: 98,
          lines: 98,
        },
        'src/lib/graphId.ts': {
          statements: 98,
          branches: 45,
          functions: 98,
          lines: 98,
        },
        'src/lib/workspace/**': {
          statements: 88,
          branches: 73,
          functions: 90,
          lines: 91,
        },
        'src/store/slices/**': {
          statements: 91,
          branches: 85,
          functions: 88,
          lines: 93,
        },
        'src/llm/context.ts': {
          statements: 95,
          branches: 92,
          functions: 95,
          lines: 95,
        },
        'src/data/fsrsDueQueue.ts': {
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
})
