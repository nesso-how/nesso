# Keeping rules up to date

When you modify code in an area covered by a rule, update that rule's canonical file under [`.rules/`](.) in the same change if the modification makes any rule stale or incomplete. (Each `.rules/*.md` is surfaced to the tools through thin wrappers: `.cursor/rules/*.mdc` for Cursor, `.claude/rules/*.md` for Claude Code. Edit the canonical `.rules/` file, not the wrappers.) The mapping:

| If you touch…                                               | Update…                                                         |
| ----------------------------------------------------------- | --------------------------------------------------------------- |
| `src/components/**`                                         | [`.rules/components.md`](components.md)                         |
| `src/store/**`                                              | [`.rules/store.md`](store.md)                                   |
| `src/types/graph.ts`, `src/data/relationTypes.ts`           | [`.rules/graph-model.md`](graph-model.md)                       |
| `src/components/mentor/MentorBubble.tsx`, AI provider/model | [`.rules/mentor.md`](mentor.md)                                 |
| Coding patterns, naming, import conventions                 | [`.rules/conventions.md`](conventions.md)                       |
| `*.test.ts`, `vitest.config.ts`, test scripts, CI test gate | [`.rules/testing.md`](testing.md)                               |
| `CHANGELOG.md`                                              | [`.rules/changelog.md`](changelog.md)                           |
| Architectural constraints, "never do X" rules               | `AGENTS.md` → **Constraints**                                   |
| Overall stack, layout, core concepts                        | `AGENTS.md` → **Stack** / **Source layout** / **Core concepts** |

## Starlight docs and MCP (`docs/`, `packages/mcp/`)

When MCP tools, stitched doc paths, env vars, or **user-visible behaviour** documented on the site change, update **`docs/`** and rebuild **`packages/mcp`** (`pnpm build`, refreshes **`dist/starlight-docs.pages.json`** via auto-discovery of `docs/src/content/docs/docs/**/*.md`) — see `AGENTS.md` → **Documentation and MCP parity**.

When you revise **guides or reference pages**, keep content aligned with the app.
