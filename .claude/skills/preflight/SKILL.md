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

- Run the steps individually so a failure is attributable to one step — don't `&&`-chain them into one opaque result.
- Surface the first failure with its output and stop; do not push when anything is red.
- `format:check` failures are usually fixed by `pnpm run format` — offer that. `lint` issues often by `pnpm run lint:fix`.
- These mirror CI exactly; if `ci.yml` changes, update this list (see `.rules/maintenance.md`).
