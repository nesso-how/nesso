---
name: preflight
description: Run the same checks as CI (.github/workflows/ci.yml) locally before opening or updating a PR — format, lint, types, builds, license headers, Playwright e2e. Use before pushing to catch a red CI early.
---

# Preflight (local CI parity)

Run the checks `.github/workflows/ci.yml` runs, in order, from the repo root, and report pass/fail per step. This is read-only verification (plus build artifacts) — it does not commit, push, or change source.

```bash
CI=true pnpm install --frozen-lockfile   # non-interactive; only if deps/lockfile may be stale
pnpm run format:check            # Biome (code/json/css) + Prettier (md/yaml/html)
pnpm run lint                    # Biome lint (replaces ESLint)
pnpm run test:coverage           # vitest + coverage ratchet (thresholds in vitest.config.ts; red on any drop)
pnpm exec tsc -b                 # typecheck
pnpm run build:mcp               # MCP bundle (refreshes dist/starlight-docs.pages.json)
pnpm run build                   # full app build
pnpm run license-headers:check   # SPDX headers on src/** and src-tauri/src
pnpm run type-coverage           # strict type-coverage ratchet (app ~99.7%, gates at 99%)
pnpm run analyze:dead-code       # fallow dead-code + architecture-cycles gate (zero-tolerance)
pnpm run analyze:dupes           # duplication gate — fails on NEW clones vs fallow-baselines/dupes.json
pnpm run analyze:health          # complexity gate — fails on NEW complex fns vs fallow-baselines/health.json
```

The `rust` CI job covers the native layer (`src-tauri/`). Run it too if the change touches `src-tauri/` (Rust, capabilities, `tauri.conf.json`); skip otherwise:

```bash
pnpm run icons:desktop                                            # generate gitignored icons that generate_context! embeds
cargo fmt --all --check --manifest-path src-tauri/Cargo.toml      # rustfmt gate
cargo clippy --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo check --all-targets --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

## E2E (Playwright, web UI)

The `e2e` CI job gates merges on the Playwright suite (`e2e/*.spec.ts`). Run it when the diff would trigger that job in CI — broadly: `src/**`, `packages/**`, `e2e/**`, `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `playwright.config.ts`, `index.html`, or `.github/workflows/ci.yml`. Skip for docs-only / Starlight-only changes that do not touch app code.

```bash
pnpm exec playwright install --with-deps chromium   # first run or after a Playwright bump
pnpm run test:e2e
```

Playwright boots the Vite dev server itself (`webServer` in `playwright.config.ts`); no separate `pnpm dev` needed.

## Native e2e (tauri-driver, local-only)

**Not in CI** — opt-in when the diff touches desktop persistence, fs sync, or the file watcher (`src-tauri/`, `src/lib/workspace/**`, `src/store/slices/desktop-sync.ts`, `useGraphFileWatch`, `useAutoSave`, `graph-management` disk paths, etc.). See [`.rules/testing.md`](../../.rules/testing.md).

```bash
e2e-native/run-local.sh            # Docker (recommended; streams the tree into the image)
# or, on Linux with WebKitWebDriver + tauri-driver installed locally:
pnpm run test:e2e:native
```

- Run the steps individually so a failure is attributable to one step — don't `&&`-chain them into one opaque result.
- Surface the first failure with its output and stop; do not push when anything is red.
- `test:coverage` is a **ratchet gate**: `coverage.thresholds` in `vitest.config.ts` is a snapshot floor (global plus stricter per-directory globs) that fails on any drop. When a change intentionally lowers coverage, re-snapshot from a fresh run and update the thresholds in the same change (the coverage analogue of `--save-baseline`).
- The three `analyze:*` steps are **hard gates**: `analyze:dead-code` is zero-tolerance (unused code + architecture cycles; documented false positives via `.fallowrc.jsonc`); `analyze:dupes` and `analyze:health` are identity baselines (`fallow-baselines/`) that fail only on **new** clones / complex functions. To accept new debt on purpose, suppress the line (`// fallow-ignore-…`) or re-save the baseline (`fallow <dupes|health> --save-baseline …`). `pnpm run analyze` (full report) is a local convenience, not a CI step.
- `format:check` failures are usually fixed by `pnpm run format` — offer that. `lint` issues often by `pnpm run lint:fix`; `cargo fmt --all --check` failures by `cargo fmt --all`.
- `icons:desktop` is a prerequisite for the cargo steps: without the bundle icons, `tauri::generate_context!` fails to compile `lib.rs`. Locally they may already exist, but regenerate if unsure.
- These mirror CI exactly; if `ci.yml` changes, update this list (see `AGENTS.md` → **Keeping rules up to date** → `testing.md`).

## Mutation testing (conditional, not in CI)

Stryker is **not** in `ci.yml` (too slow per push). After the CI-parity steps, run mutation tests when the branch diff touches pure logic in a Stryker area — same idea as the conditional Rust block above.

```bash
pnpm run analyze:mutation:changed              # diff vs `main` (merge-base..HEAD)
pnpm run analyze:mutation:changed -- --base origin/main
pnpm run analyze:mutation:changed -- --working # include unstaged/staged edits too
```

Area → path mapping lives in [`scripts/stryker/areas.mjs`](../../scripts/stryker/areas.mjs) (shared with `scripts/stryker/<area>.mjs`). The script prints matched areas and runs only those `analyze:mutation:<area>` steps; it exits 0 with “skipping” when the diff is docs/UI/i18n-only. **Do run it** when `src/llm/`, `src/data/fsrsDueQueue`, store slices, workspace, or `packages/schema` change. Stryker needs full permissions locally (sandbox EPERM on `.stryker-tmp/.cursor` otherwise).
