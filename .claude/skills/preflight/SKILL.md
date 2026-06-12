---
name: preflight
description: Run the same checks as CI (.github/workflows/ci.yml) locally before opening or updating a PR — format, lint, types, builds, license headers. Use before pushing to catch a red CI early.
---

# Preflight (local CI parity)

Run the checks `.github/workflows/ci.yml` runs, in order, from the repo root, and report pass/fail per step. This is read-only verification (plus build artifacts) — it does not commit, push, or change source.

```bash
pnpm install --frozen-lockfile   # only if deps/lockfile may be stale; skip if node_modules is current
pnpm run format:check            # prettier --check .
pnpm run lint                    # eslint
pnpm exec tsc -b                 # typecheck
pnpm run build:mcp               # MCP bundle (refreshes dist/starlight-docs.pages.json)
pnpm run build                   # full app build
pnpm run license-headers:check   # SPDX headers on src/** and src-tauri/src
```

The `rust` CI job covers the native layer (`src-tauri/`). Run it too if the change touches `src-tauri/` (Rust, capabilities, `tauri.conf.json`); skip otherwise:

```bash
pnpm run icons:desktop                                            # generate gitignored icons that generate_context! embeds
cargo fmt --all --check --manifest-path src-tauri/Cargo.toml      # rustfmt gate
cargo clippy --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo check --all-targets --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

- Run the steps individually so a failure is attributable to one step — don't `&&`-chain them into one opaque result.
- Surface the first failure with its output and stop; do not push when anything is red.
- `format:check` failures are usually fixed by `pnpm run format` — offer that. `lint` issues often by `pnpm run lint:fix`; `cargo fmt --all --check` failures by `cargo fmt --all`.
- `icons:desktop` is a prerequisite for the cargo steps: without the bundle icons, `tauri::generate_context!` fails to compile `lib.rs`. Locally they may already exist, but regenerate if unsure.
- These mirror CI exactly; if `ci.yml` changes, update this list (see `.rules/maintenance.md`).
