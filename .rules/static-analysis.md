# Static Analysis

Three layers enforce code health before PRs: lint/format, type safety, and structural quality. All run as CI gates.

## Lint & Format

**Biome** handles JS/TS/CSS/JSON (`biome.json`). **Prettier** handles MD/YAML/HTML (`prettier.config.js`).

```bash
pnpm run lint             # Biome lint (read-only)
pnpm run format:check     # Biome + Prettier (CI gate)
```

**License headers** (`// SPDX-License-Identifier: MIT`) required on all source files:

```bash
pnpm run license-headers:check   # CI gate
pnpm run license-headers         # inserts missing headers
```

**Security headers** (`vercel.json`, `docs/vercel.json`): validates CSP directive values against the project's security policy — ensures loopback-only `connect-src` HTTP sources, required common directives (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `worker-src 'self' blob:`), and config-specific rules (app vs docs). Rejects permissive `startsWith` matching for loopback hosts so lookalikes like `localhost.evil` are caught.

```bash
pnpm run security:headers   # CI gate
```

**Rust** (`src-tauri/`):

```bash
cargo fmt --all --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Tauri plugins (`src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`) require the four Rust quality gates plus a desktop build smoke check. Keep native HTTP scopes explicit: broad HTTPS for user-configured providers, loopback-only HTTP. The desktop build does not semantically deserialize plugin-specific capability URL patterns, so keep those patterns covered by a focused native Rust test.

Filesystem capability: the focused Rust test must assert `fs:default` is absent; all eight operations are individually scoped to the four `.nesso` app-data/app-localdata patterns; watch/unwatch remain scalar; `fs:scope` retains the `.nesso` allowlist; no broad recursive permissions appear.

Trust boundary (`grant_fs_scope` / `pick_workspace_folder`): Rust owns the picker dialog, persists approved paths in a trust store outside the renderer's fs scope, and rejects non-app-data paths not under a previously-trusted root. App-data auto-grants are restricted to `.nesso` subtrees; the project root is trusted through the seeded trust store, not app-data prefix matching. The Rust test covers `is_path_safe_for_grant`, `is_path_trusted`, `validate_picked_folder`, trust-store descendants, the trust-store file itself, traversal, arbitrary-external, home/root/hidden, picker-validation, and rejection paths. `save_file_dialog` owns dialog + write on the Rust side so the renderer never provides an export path. A native CSP test validates `tauri.conf.json` rejects unrestricted `http:` sources.

## Type Safety

`tsc -b` (build mode) checks `src/` + all workspace packages:

```bash
pnpm run type:check   # tsc -b + pnpm --filter @nesso-how/* exec tsc -b
```

**Type coverage**: strict ratchet (`type-coverage --strict`) across `src/` and all workspace packages.

```bash
pnpm run type:coverage
```

**Rust**: `cargo check --manifest-path src-tauri/Cargo.toml --all-targets`

## Structural Quality (Fallow)

Three gates, all via `.fallowrc.jsonc`:

```bash
pnpm run analyze:dead-code   # zero-tolerance: unused exports, dead imports, architecture cycles
pnpm run analyze:dupes       # baseline-gated on fallow-baselines/dupes.json (fails on new clones)
pnpm run analyze:health      # baseline-gated on fallow-baselines/health.json (fails on new complex fns)
```

Baselines ratchet: re-baseline when improving, never raise the ceiling. Documented false positives go in `.fallowrc.jsonc`.

## E2E quick verification

For canvas interaction changes (handles, drag-connect, inline edit), run the focused spec first:

```bash
pnpm test:e2e e2e/graph-editing.spec.ts
```

Then the full E2E suite (`pnpm test:e2e`). The graph-editing spec covers both connection directions (right→left and left→right) and verifies the inspector shows the correct source→target orientation.
