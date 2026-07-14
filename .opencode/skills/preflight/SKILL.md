---
name: preflight
description: Use before pushing to catch a red CI early. Run the same checks as `.github/workflows/ci.yml` locally — format, lint, types, builds, license headers, Playwright e2e.
---

# Preflight (local CI parity)

**Primary:** `pnpm run preflight`

Runs the `js` + `e2e` CI jobs in order, per-step output on failure, summary at the end. Exit 0 = all green.

**With Rust:** `pnpm run preflight -- --rust`

Appends the `rust` CI job (icons:desktop, cargo fmt/clippy/check/test) after the JS steps. Run when the diff touches `src-tauri/`.

## Conditional steps (not in the script)

### Native e2e (tauri-driver, local-only, not in CI)

Opt-in when the diff touches desktop persistence, fs sync, or the file watcher. See [`.rules/testing.md`](../../.rules/testing.md).

```bash
e2e-native/run-local.sh            # Docker (recommended)
# or locally:
pnpm run test:e2e:native
```

### Mutation testing (conditional, not in CI)

Run when the diff touches pure logic in a Stryker area (`src/llm/`, `src/data/fsrsDueQueue`, store slices, workspace, `packages/schema`).

```bash
pnpm run analyze:mutation:changed -- --base origin/main
```

## Debugging failures

When a step fails, fix and re-run individually:

| Step                    | Fix                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `format:check`          | `pnpm run format`                                                                         |
| `lint`                  | `pnpm run lint:fix`                                                                       |
| `license-headers:check` | `pnpm run license-headers`                                                                |
| `test:coverage`         | see [`.rules/testing.md`](../../.rules/testing.md) — ratchet gate                         |
| `type:coverage`         | fix type errors; thresholds in tsconfig                                                   |
| `build`                 | fix compile errors                                                                        |
| `analyze:dead-code`     | remove unused files/exports                                                               |
| `analyze:dupes`         | see [`.rules/static-analysis.md`](../../.rules/static-analysis.md) — baseline-gated       |
| `analyze:health`        | see [`.rules/static-analysis.md`](../../.rules/static-analysis.md) — baseline-gated       |
| `test:e2e`              | check Playwright output; `pnpm exec playwright install --with-deps chromium` if first run |
| `icons:desktop`         | `pnpm run icons:desktop`                                                                  |
| `cargo:fmt`             | `cargo fmt --all --manifest-path src-tauri/Cargo.toml`                                    |
| `cargo:clippy`          | fix warnings flagged by clippy                                                            |
| `cargo:check`           | fix compile errors                                                                        |
| `cargo:test`            | fix failing tests                                                                         |

Do not push when anything is red. These mirror CI exactly — if `ci.yml` changes, update this file.
