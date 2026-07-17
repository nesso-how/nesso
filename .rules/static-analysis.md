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

**Rust** (`src-tauri/`):

```bash
cargo fmt --all --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

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
