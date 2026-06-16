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
    },
  },
})
