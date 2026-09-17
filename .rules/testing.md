# Testing

## Unit and integration tests

Vitest is configured by `vitest.config.ts` and includes:

- `src/**/*.test.{ts,tsx}`
- `packages/*/src/**/*.test.{ts,tsx}`
- `scripts/**/*.test.{mjs,js}`

The default environment is `node`. Tests that use React or browser APIs opt
into `jsdom` with a `// @vitest-environment jsdom` file directive. The `@`
alias and workspace package aliases resolve to source files, so tests exercise
the current source rather than built package output.

Use `pnpm test` for the unit/integration suite and `pnpm run test:watch` for
watch mode. Keep tests under the configured include patterns; Playwright and
native Tauri tests belong to their separate lanes below.

## Coverage

`pnpm run test:coverage` uses the V8 provider and writes text and HTML reports.
The exact global and focused thresholds live in `vitest.config.ts`. They are
ratchet floors: raise them as coverage improves, and re-baseline an intentional
floor reduction in the same change.

## Browser and native E2E

Playwright covers the web app through `e2e/**/*.spec.ts` and runs with
`pnpm run test:e2e`. Install Chromium before the first run with
`pnpm exec playwright install --with-deps chromium` when the environment needs
it. The native lane covers Tauri filesystem, file-watching, and desktop-sync
boundaries through `e2e-native/**/*.e2e.ts`; it is local-only, not a CI job.
Use `e2e-native/run-local.sh` on macOS and
`pnpm run test:e2e:native` on Linux/Windows with native WebDriver prerequisites.

## Mutation testing

Stryker uses the registered `schema`, `store`, `workspace`, `mentor`, and
`graphTools` areas. Run an area script directly or use
`pnpm run analyze:mutation:changed --base origin/main --working` for changed
tracked files. The selector does not include untracked files. Mutation testing
is scheduled/manual and is not a per-pull-request CI gate.
