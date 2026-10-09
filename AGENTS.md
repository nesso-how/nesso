# Nesso

## Code

- Do not add backward-compatibility code or migration ladders.
- Prefer the smallest clear implementation. Reuse existing code; avoid unnecessary abstractions, duplication, and redundant tests without sacrificing readability, correctness, or essential coverage.
- Use English and TypeScript for code, tests, and scripts; JavaScript only when required by tooling. Keep data and documentation in native formats. No code comments.
- Report failures with a package-scoped `<Package>Error extends Error` carrying `readonly issues: { path: string; message: string }[]`, joined into the message; follow `SchemaError`.
- After code changes, run `pnpm analyze --summary`. Inspect scoped findings with `pnpm analyze --changed-since origin/main --format json --quiet` and verify unused exports with `pnpm analyze dead-code --trace FILE:EXPORT` before deleting them. Do not run Fallow autofix or add suppressions to make a check pass.

## Release

- Release from clean `main` with `pnpm release [--major|--minor|--patch|--alpha|--beta|<version>]`; the script bumps `package.json`, commits, tags `v<version>`, and pushes.

## Product

- Keep the app light-only.
- Views are concept subsets, never graph copies or tags. The `All` view (complete graph) is non-deletable. Keep relation type IRIs stable.
- New concepts join the active saved view. With exactly one concept selected, link to it using the active vocabulary's default type, displayed unlabeled; otherwise start disconnected.
- Explorer groups views by pinned status; pinning and collapsing never change scope.
- Selection never changes view membership. There is no persistent concept focus. With no selection, the Inspector shows the active view or complete graph; clearing selection never closes it.

## Architecture

- Consolidate repeated app UI in `@nesso/ui`; keep app-specific state and domain logic in the host.
- Plugins use only the injected APIs, never app internals or a concrete store. Keep instances isolated; no module-global mutable store. React subscriptions use the injected instance with `useSyncExternalStore`.
- Only the host materializes `viewGraph`; plugins never recompute it. Do not persist selection, plugin definitions, or `viewGraph`.
- The host owns editing forms and reset confirmation. Navbar actions read current state at invocation. The canvas handles selection-aware graph commands, viewport gestures, and shared history controls.
- React Flow components, types, event mapping, and renderer-specific styles stay in `plugins/graph`; the host never imports React Flow. The graph plugin consumes theme tokens.
