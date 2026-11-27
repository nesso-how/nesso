# Nesso

See [README.md](README.md) for the product overview and [docs/architecture.md](docs/architecture.md) for architecture and the package index.

## Code

- Leave changes uncommitted and unpushed unless the user explicitly requests a commit or push.
- Before opening a PR, fetch `origin` and ensure the branch includes the latest `origin/main`; resolve or report blockers before proceeding.
- Name branches `<type>/<name>` in lowercase kebab-case, and write commits and PR titles as Conventional Commits with the types in `.github/workflows/pr-title.yml`; squash merges turn PR titles into the `CHANGELOG.md` entries.
- Complete applicable sections of `.github/pull_request_template.md` for PRs and the matching `.github/ISSUE_TEMPLATE/` template for issues, when available.
- Before implementing an issue, resolve its open decisions with the user and record them in the issue body. During implementation, stop and ask before choices that are costly to reverse or outside the agreed scope, such as persisted formats, compatibility, plugin API, dependencies, security, or user-visible behavior the issue leaves open, and record the answers; settle other choices with the simplest option consistent with the issue.
- Enable auto-merge only on explicit request; watch the PR until merged or blocked, and report blockers.
- Run the `review` subagent only through `/review` or on explicit request; otherwise ask the user first.
- Fetch `origin` before starting work and after a PR merges during the session. Fast-forward `main` to `origin/main` in the main clone, and start new branches from `origin/main` in a session worktree, creating one with the harness's worktree tool when the session runs in the main clone. Report blockers; never discard changes or force updates.
- After a PR merges during the session, delete its local branch and remove the session's worktree once the merged PR head matches the local branch, or `git diff` shows the same changes against each base, and the worktree is clean; use the harness's worktree tool when available, leaving the worktree first if the session runs in it. Leave other branches and worktrees untouched.
- Centralize migration ladders in a dedicated `migrations.ts` file within the owning module, separate from current-format parsers. Create migration files only when a migration exists; avoid generic migration frameworks or scattered compatibility branches. Follow and maintain the [compatibility guide and data format index](docs/compatibility.md).
- Keep `docs/compatibility.md` to durable policy and the format index; describe version-specific changes, such as plugin API bumps, in the commit's `BREAKING CHANGE:` footer, which feeds `CHANGELOG.md`.
- Prefer the smallest clear implementation. Reuse existing code; avoid unnecessary abstractions, duplication, and redundant tests without sacrificing readability, correctness, or essential coverage.
- Keep tests proportional to the change: extend existing tests and fixtures first, and cover each behavior at the lowest reliable level. Reserve E2E for UI or platform integration that lower levels cannot exercise.
- Keep AGENTS.md files minimal: durable development rules and architectural boundaries only. Do not duplicate inherited instructions, implementation details, functional specifications, or progress reports; keep supported behavior in types, validators, and tests.
- Use English and TypeScript for code, tests, and scripts; JavaScript only when required by tooling. Keep data and documentation in native formats. No code comments.
- Use `NessoError` from `@nesso-how/errors` for structured failures. Package-scoped errors extend it, retaining domain-specific identity and validation.
- When adding or changing an external link in the app, review `electron/links.ts` and update its allowlist if the destination is not already covered. Keep external links restricted to trusted HTTPS destinations and open them in the system browser.
- After code changes, run `pnpm format` (oxfmt; never Prettier) and `pnpm analyze --summary`. Inspect findings introduced by the branch with `pnpm analyze audit --base origin/main` and verify unused exports with `pnpm analyze dead-code --trace FILE:EXPORT` before deleting them. Do not run Fallow autofix or add suppressions to make a check pass.

## Self-improvement

- When tooling or instructions get in your way, such as a missing command or PATH entry, a documented command that fails, or an outdated or conflicting rule, report it in your reply with a concrete fix instead of silently working around it.
- When the user repeats a correction or states a durable invariant the code does not show, propose the smallest fix, preferring a script, check, or config change over a new rule, and removing rules that no longer hold. Edit instruction files only after approval.

## Release

- Release the app, UI, plugin SDK, and official example together from clean `main` using `pnpm release`; see `pnpm release --help` for options and behavior. Keep published packages in `scripts/release-packages.json`, in dependency-first publication order.

## Architecture

- Keep app, plugin SDK, plugin API, JSON-LD profile, persisted record, backup envelope, and private plugin data versions independent. Choose data migrations by format version, never app version; private plugin schemas remain plugin-owned.
- Keep modules focused and interfaces small and cohesive. Depend on explicit contracts at architectural boundaries; introduce abstractions only for concrete needs.
- Consolidate repeated app UI in `@nesso-how/ui`; keep app-specific state and domain logic in the host.
- Plugins and trusted renderers use only injected APIs, never app internals or a concrete store. Keep instances independent; no module-global mutable store, except ephemeral UI state in preloaded built-in panels. React subscriptions use the injected instance with `useSyncExternalStore`.
- Only the host materializes `mapGraph`; plugins never recompute it. Do not persist selection, plugin definitions, or `mapGraph`.
- The host workspace owns editing policy, shortcuts, clipboard I/O, confirmations, and editing forms independently of the active renderer. Renderers own geometry and local gestures, subscribe to injected state, map gestures to store operations, and request host actions only for behavior outside the store.
- Keep React Flow components, types, event mapping, and renderer-specific styles in trusted `packages/concept-map`; the host never imports React Flow. Keep trusted renderers outside the isolated plugin runtime.
