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

Tauri plugin integrations span `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, and `src-tauri/capabilities/default.json`. When adding or changing one, run the four Rust quality gates — `cargo fmt --all --check --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo check --manifest-path src-tauri/Cargo.toml --all-targets`, and `cargo test --manifest-path src-tauri/Cargo.toml` — then build the desktop binary as a packaging/integration smoke check. The desktop build does not semantically deserialize plugin-specific capability URL patterns, so keep those patterns covered by a focused native Rust test. Keep native HTTP scopes explicit: HTTPS may be broad for user-configured providers, while HTTP must remain limited to loopback.

For filesystem capability changes, the focused native Rust test must assert:

- `fs:default` is **absent** (it grants read + mkdir over the entire app-data tree, which is broader than Nesso needs).
- Every required operation (`read-file`, `read-dir`, `stat`, `exists`, `write-file`, `mkdir`, `remove`, `rename`) is individually scoped to `$APPDATA/**/.nesso`, `$APPDATA/**/.nesso/**`, `$APPLOCALDATA/**/.nesso`, `$APPLOCALDATA/**/.nesso/**`.
- `fs:allow-watch` and `fs:allow-unwatch` are retained as scalar permissions (paths are validated at runtime).
- `fs:scope` retains the same `.nesso` allowlist for runtime dynamic scope grants.
- No broad recursive permissions (`fs:allow-appdata-read-recursive`, etc.) ever appear.

For the `grant_fs_scope` / `pick_workspace_folder` trust boundary: the Rust code must own the folder-picker dialog (`pick_workspace_folder`), persist approved paths in a trust store outside the renderer's fs scope, and reject `grant_fs_scope` calls for non-app-data paths not under a previously-trusted root. App-data auto-grants are restricted to `.nesso`-containing subtrees only; the project root (e.g. `$APPDATA/graphs`) is trusted through the seeded trust store, not through the app-data prefix match. The focused Rust test covers `is_path_safe_for_grant`, `is_path_trusted`, and `validate_picked_folder` with app-data `.nesso` subtrees, trust-store (including descendants and the trust-store file rejection), traversal, arbitrary-external, home/root/hidden, picker-validation, and rejection paths. The `save_file_dialog` command owns both the dialog and the write on the Rust side so the renderer never provides a path for user-initiated JSON exports, keeping the minimal `.nesso`-scoped fs capability intact. A native CSP test validates `tauri.conf.json` rejects unrestricted `http:` scheme sources in favour of explicit loopback hosts.

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
