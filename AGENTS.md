# Nesso

See [README.md](README.md) for the product overview, architecture, and package documentation index.

## Code

- Leave changes uncommitted and unpushed unless the user explicitly requests a commit or push.
- Do not add backward-compatibility code or migration ladders.
- Prefer the smallest clear implementation. Reuse existing code; avoid unnecessary abstractions, duplication, and redundant tests without sacrificing readability, correctness, or essential coverage.
- Keep AGENTS.md files minimal: durable development rules and architectural boundaries only. Do not duplicate inherited instructions, implementation details, functional specifications, or progress reports; keep supported behavior in types, validators, and tests.
- Use English and TypeScript for code, tests, and scripts; JavaScript only when required by tooling. Keep data and documentation in native formats. No code comments.
- Use `NessoError` from `@nesso-how/errors` for structured failures. Package-scoped errors extend it, retaining domain-specific identity and validation.
- When adding or changing an external link in the app, review `electron/links.ts` and update its allowlist if the destination is not already covered. Keep external links restricted to trusted HTTPS destinations and open them in the system browser.
- After code changes, run `pnpm analyze --summary`. Inspect scoped findings with `pnpm analyze --changed-since origin/main --format json --quiet` and verify unused exports with `pnpm analyze dead-code --trace FILE:EXPORT` before deleting them. Do not run Fallow autofix or add suppressions to make a check pass.

## Release

- Release from clean `main` using `pnpm release`; see `pnpm release --help` for options and behavior. The script updates `package.json` and `CHANGELOG.md`, commits, tags `v<version>`, and pushes.
- Release the plugin SDK separately using `pnpm release:plugin`; see `pnpm release:plugin --help` for options and behavior. The script bumps `packages/plugin/package.json`, commits, tags `plugin-v<version>`, and pushes. Never reuse a `plugin-v*` tag for a version already on the registry.

## Architecture

- Keep modules focused and interfaces small and cohesive. Depend on explicit contracts at architectural boundaries; introduce abstractions only for concrete needs.
- Consolidate repeated app UI in `@nesso-how/ui`; keep app-specific state and domain logic in the host.
- Plugins and trusted renderers use only injected APIs, never app internals or a concrete store. Keep instances independent; no module-global mutable store. React subscriptions use the injected instance with `useSyncExternalStore`.
- Only the host materializes `viewGraph`; plugins never recompute it. Do not persist selection, plugin definitions, or `viewGraph`.
- The host workspace owns editing policy, shortcuts, clipboard I/O, confirmations, and editing forms independently of the active renderer. Renderers own geometry and local gestures, subscribe to injected state, map gestures to store operations, and request host actions only for behavior outside the store.
- Keep React Flow components, types, event mapping, and renderer-specific styles in trusted `packages/concept-map`; the host never imports React Flow. Keep trusted renderers outside the isolated plugin runtime.
