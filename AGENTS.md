# Nesso

Nesso is an app for building typed knowledge graphs for active learning: an interactive concept map where nodes are ideas and edges are typed semantic relations. **Socrates**, a Socratic AI mentor, reads the current graph and the user's selection, then probes their understanding through questions rather than explanations.

> **How rules are organized.** This file holds the always-on, tool-agnostic context (stack, layout, core concepts, hard constraints, git, docs/MCP parity) and is read natively by Cursor and imported by Claude Code via `CLAUDE.md`. Detailed, area-specific rules live as canonical content in [`.rules/`](.rules/) and are surfaced to each tool through thin wrappers that carry only tool-specific frontmatter plus an import: `.cursor/rules/*.mdc` for Cursor, `.claude/rules/*.md` for Claude Code. **Edit the canonical `.rules/*.md` file, never the wrappers.**

## Stack

| Layer         | Technology                                                                                                                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework     | React 18 + Vite + TypeScript                                                                                                                                                                                            |
| Desktop shell | Tauri v2 (`src-tauri/`) — optional wrapper; web app still runs with `pnpm dev`                                                                                                                                          |
| Graph canvas  | React Flow (`@xyflow/react`)                                                                                                                                                                                            |
| State         | Zustand (`src/store/index.ts` + `src/store/slices/`)                                                                                                                                                                    |
| AI mentor     | Local **WebGPU** engine (Qwen2.5 1.5B via `@mlc-ai/web-llm`) or any OpenAI-compatible `chat/completions` endpoint (Ollama or cloud; endpoint / model / key in Settings). Review scheduling uses **FSRS** via `ts-fsrs`. |

## Source layout

```
src/
  App.tsx             # Root: keyboard shortcuts, theme application, layout
  components/         # All UI components (see .rules/components.md)
  store/              # Zustand store (index.ts composes slices/)
    slices/           # graph-editing, settings, ui, graph-management, desktop-sync
  llm/                # Mentor transports (web-llm + OpenAI-compatible fetch)
  data/
    relationTypes.ts  # merges `@nesso-how/relation-types` + CSS palette vars (`RELATION_CATEGORIES`)
    seeds/*.json      # Default demo graph snapshots (React Flow nodes/edges + display name; nested locale dirs, e.g. seeds/it/)
    seedGraph.ts      # Exports `SEEDS` — bundled demo graphs from `seeds/*.json` (stable ids from names)
  types/graph.ts      # re-exports `@nesso-how/types` (ConceptNodeData, EdgeTypeName, NessoSettings — defined in packages/types/)
src-tauri/            # Tauri v2 Rust project — tauri.conf.json, capabilities; `icons/` generated via `pnpm run icons:desktop` (gitignored)
packages/
  relation-types/     # @nesso-how/relation-types: shared semantic vocabulary
  types/              # @nesso-how/types: shared TypeScript types
  theme/              # @nesso-how/theme: design tokens (single source of truth for theme packs)
  formats/            # @nesso-how/formats: graph JSON serialize/deserialize
  mcp/                # @nesso-how/mcp: MCP server for LLM clients
docs/                 # Starlight docs site, published at nesso.how/docs
```

## Core concepts

- **Node** — a `ConceptNode` with `text` and FSRS fields (`stability`, `difficulty`, `reps`, `lapses`, `fsrsState`, `due`, `lastReview`, `lastRating`, `learningSteps`) persisted for spaced repetition (`ts-fsrs`).
- **Edge** — a React Flow edge of type `'nesso'`, carrying `data.type: EdgeTypeName`.
- **Selection** — a single `{ kind: 'node' | 'edge', id }` (or `null`) tracked in the store (`src/store/types.ts`). Drives the Inspector and Socrates opening prompt.
- **Settings** — `NessoSettings` in the store (dark mode, language, encoding, palette, AI endpoint fields, etc.). Applied via CSS custom properties on `<html>` where relevant.

## Detailed rules index

Area-specific rules (canonical content in `.rules/`, auto-attached per file area by each tool):

| Area                                                            | File                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------- |
| Coding conventions (TypeScript, React, state, naming)           | [`.rules/conventions.md`](.rules/conventions.md)     |
| Component responsibilities and data flow                        | [`.rules/components.md`](.rules/components.md)       |
| Semantic edge model — categories, relation types, encoding      | [`.rules/graph-model.md`](.rules/graph-model.md)     |
| Theme tokens — `@nesso-how/theme` single source of truth        | [`.rules/theme.md`](.rules/theme.md)                 |
| Zustand store shape, mutations, selector patterns               | [`.rules/store.md`](.rules/store.md)                 |
| Socratic AI mentor — MentorBubble, system prompt, chat API      | [`.rules/mentor.md`](.rules/mentor.md)               |
| Vitest tests — layout, env split, module resolution, CI gate    | [`.rules/testing.md`](.rules/testing.md)             |
| `CHANGELOG.md` (Keep a Changelog), `[Unreleased]`, release flow | [`.rules/changelog.md`](.rules/changelog.md)         |
| Keeping the `.rules/` files in sync with the codebase           | [`.rules/maintenance.md`](.rules/maintenance.md)     |
| PR titles/bodies — match `.github/PULL_REQUEST_TEMPLATE.md`     | [`.rules/pull-requests.md`](.rules/pull-requests.md) |

**Changelog:** do **not** edit `CHANGELOG.md` during feature work; update **`## [Unreleased]`** only when the user asks for a **commit** or an explicit **changelog-before-commit** pass. Format and releases: [`.rules/changelog.md`](.rules/changelog.md).

**Release:** cutting a release is a procedure, not a file-area rule, so it lives in the `release` skill at [`.claude/skills/release/SKILL.md`](.claude/skills/release/SKILL.md). In Claude Code run `/release`; in Cursor the agent-requested rule `.cursor/rules/release.mdc` pulls the same procedure in when a release task matches.

## Constraints — hard rules, never do this

### Never store chat history in the global store

`MentorBubble` conversation history is local state. It resets on selection change by design — each selection context starts a fresh Socratic dialogue. Do not lift it into the Zustand store.

### Never use default React Flow edge types

All edges must use `type: 'nesso'`. The `NessoEdge` renderer from `@nesso-how/graph` is load-bearing for visual encoding (line style, glyph, category colour). Plain React Flow edges skip all of this.

### Never hardcode edge colours

Category colours are CSS custom properties (`--cat-taxonomic`, etc.) set by the active palette. Do not hardcode hex values for edge or node colours — use the variables so palette switching works.

### Never call the AI API outside llm/completion.ts

All AI chat completions go through `src/llm/completion.ts` (`fetchCompletion`), used by `MentorBubble` and `ReviewMode`. Do not duplicate fetch or WebLLM client logic elsewhere — the API key is client-side and calls should stay scoped to those interactions.

### Never add a second global store

The single `useGraphStore` in `src/store/index.ts` is the source of truth. Do not introduce a second Zustand store, React context for data, or any other global state mechanism.

### Never mutate React Flow node/edge arrays directly

All graph mutations go through store methods (`addNode`, `deleteEdge`, `updateNodeData`, etc.) which return new arrays. Do not push into `nodes` or `edges` in place.

### No backwards-compatibility code while in alpha

The project is in `0.1.0-alpha`. Do not write migration shims, legacy fallbacks, deprecation aliases, or "old name still works" coercions when renaming/removing fields, types, enum values, or APIs. Update the data (seeds, fixtures) and call sites directly and break cleanly. Once we tag a non-alpha release this constraint relaxes — until then, prefer clean diffs over carrying old names.

## Git — never commit or push without explicit consent

**Never** run `git commit`, `git push`, or open/update a pull request unless the user **explicitly asks** in the current message (e.g. "commit", "push", "crea la PR").

- Implementing a plan or fixing bugs does **not** imply permission to commit or push.
- After code changes, stop at the working tree — do not commit proactively, even if a plan or checklist mentions it.
- If unsure, ask first.

Amend, force-push, and other destructive git operations follow the same rule: only when explicitly requested.

## Documentation and MCP parity

Whenever you ship or revise something that touches **documentation or the MCP server**, update the Markdown site and MCP doc bundle in **the same logical change** (same commit when practical).

### MCP (`packages/mcp/`)

- **Tools, payloads, documented behaviour** described to users → keep **`docs/src/content/docs/docs/guides/mcp-integration.md`** accurate.
- **New / renamed / dropped doc sources** stitched by `get_nesso_docs` → add/remove the page under **`docs/src/content/docs/docs/`** plus **`docs/astro.config.mjs`** sidebar when needed, then run **`pnpm build`** in `packages/mcp`. The build script auto-discovers all `.md` files — no manifest to maintain.
- Prefer **no long-form prose-only** in `packages/mcp/`; put user-facing explanations in **`docs/`** and keep the MCP package as loaders + tooling. After editing stitched Markdown paths or doc bodies, run **`pnpm build`** in `packages/mcp` so **`dist/starlight-docs.pages.json`** refreshes (`pnpm dev` / `tsc --watch` alone does not rebuild it).

### Product features documented in `docs/`

- If you change **getting started**, **relation model**, flows, URLs, or any topic already covered in Starlight (**`docs/src/content/docs/docs/**/\*.md`\*\*), refresh that page so the live site matches the product.
- **`README.md`** and **`docs/`** can overlap for marketing vs guide detail; fix obvious contradictions when you notice them.
