// SPDX-License-Identifier: MIT

// Shared StrykerJS options (issue #55). Coverage (#54) measures whether tests
// *execute* the code; mutation testing measures whether they would *catch a
// regression*. Stryker injects small systematic mutations (`>` -> `>=`, `&&` ->
// `||`, negated conditions, removed statements, swapped returns, ...) and reruns
// the suite per mutant: a *killed* mutant means a test failed (good — the bug is
// caught); a *survived* mutant means every test still passed (a behaviour the
// suite does not actually assert). The mutation score (killed / covered) is the
// headline metric, and each area's `thresholds.break` is its ratchet floor.
//
// This is intentionally NOT a per-PR gate: the suite reruns once per mutant, so
// it is too slow for every push. It runs opt-in locally (`pnpm run
// analyze:mutation`) and on a non-blocking scheduled CI job
// (.github/workflows/mutation.yml). See `.rules/testing.md`.
//
// Thresholds are kept *per area* rather than as one aggregate score: a tiny,
// well-tested package (formats, 95%) would otherwise mask a large, less-tested
// one (the store slices, 71%) — the same reason `vitest.config.ts` holds
// per-directory coverage floors. Each area is a config file (stryker.<area>.mjs)
// built from `area()` below; `pnpm run analyze:mutation:<area>` runs one.

const base = {
  testRunner: 'vitest',
  // pnpm's non-hoisted node_modules defeats Stryker's default `@stryker-mutator/*`
  // plugin glob, so name the runner plugin explicitly.
  plugins: ['@stryker-mutator/vitest-runner'],
  // Run against the real Vitest suite and its resolution (the `@/…` and
  // `@nesso-how/*` source aliases) — no parallel config to drift. `perTest`
  // coverage means the one-off dry run executes the whole suite, but each mutant
  // then reruns only the tests that cover it, keeping the mutation phase cheap.
  vitest: { configFile: 'vitest.config.ts' },
  coverageAnalysis: 'perTest',
  // Lean sandbox: the mutation run needs neither the docs site nor the native
  // layer, and copying them only slows sandbox creation.
  ignorePatterns: ['docs', 'src-tauri', 'packages/mcp', 'coverage', 'reports'],
  reporters: ['html', 'clear-text', 'progress', 'json'],
}

/**
 * Build an area config from the shared base.
 * @param {object} opts
 * @param {string[]} opts.mutate - globs of source to mutate (tests excluded)
 * @param {string} opts.reportDir - where the HTML/JSON reports land
 * @param {number} opts.breakAt - ratchet floor: fail under this mutation score
 * @param {number} [opts.high] - report colour threshold only
 * @param {number} [opts.low] - report colour threshold only
 */
export function area({ mutate, reportDir, breakAt, high = 95, low = 60 }) {
  return {
    ...base,
    mutate,
    htmlReporter: { fileName: `${reportDir}/index.html` },
    jsonReporter: { fileName: `${reportDir}/report.json` },
    // `analyze:mutation` is always a full, deterministic run so the ratchet score
    // is honest. Incremental mode (`--incremental` + a cached
    // `stryker-incremental.json`) is left to the scheduled CI job to opt into
    // once full runs get expensive.
    thresholds: { high, low, break: breakAt },
  }
}
