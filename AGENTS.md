# Nesso

Nesso is an app for building typed knowledge graphs for active learning: an interactive concept map where nodes are ideas and edges are typed semantic relations. **Socrates**, a Socratic AI mentor, reads the current graph and the user's selection, then probes their understanding through questions rather than explanations.

Monorepo: `src/` (app) + `packages/` (`@nesso-how/*`). Desktop shell is optional Tauri v2 (`src-tauri/`). **pnpm-only** — never use npm or yarn. **FSRS** review (`ts-fsrs`) is independent of the **experimental** AI mentor.

> Area rules in [`.rules/`](.rules/) — load on demand when the task touches that area (**Touch → update** below); do not load all upfront. Before **commit** or **release**, load [`.rules/changelog.md`](.rules/changelog.md).

## Core concepts

- **Node** — `ConceptNode` with `text` + FSRS at runtime; FSRS in IndexedDB `reviewState`, not graph JSON — see [`.rules/graph-model.md`](.rules/graph-model.md), [`.rules/store.md`](.rules/store.md).
- **Edge** — `data.type: RelationTypeName` — see [`.rules/graph-model.md`](.rules/graph-model.md).
- **Selection** — `{ kind: 'node' | 'edge', id } | null` in the store (`src/store/types.ts`); drives Inspector and Socrates.
- **Settings** — `NessoSettings` in the store; palette/theme via CSS vars on `<html>`.

## Development workflow

For any non-trivial task, switch to the **`work`** agent — it orchestrates the 5-phase flow (brainstorm/plan → build → review → documentation), dispatches subagents for each phase, and enforces Nesso's constraints. Starting points: `brainstorm` for features, `fix` for bugs, then `work` for everything else.

## Area rules

Canonical in `.rules/` — read the full file when relevant:

- [`.rules/conventions.md`](.rules/conventions.md)
- [`.rules/components.md`](.rules/components.md)
- [`.rules/graph-model.md`](.rules/graph-model.md)
- [`.rules/theme.md`](.rules/theme.md)
- [`.rules/store.md`](.rules/store.md)
- [`.rules/mentor.md`](.rules/mentor.md)
- [`.rules/testing.md`](.rules/testing.md)
- [`.rules/changelog.md`](.rules/changelog.md)
- [`.rules/compatibility.md`](.rules/compatibility.md)
- [`.rules/docs.md`](.rules/docs.md)
- [`.rules/static-analysis.md`](.rules/static-analysis.md)
- [`.rules/harness.md`](.rules/harness.md)

## Keeping rules up to date

Update the canonical `.rules/*.md` in the same change when your edit makes a rule stale. The **Touch → update** table below maps file paths to the rules they affect — load the relevant rule when touching those paths. Update **Constraints** / **Core concepts** / the intro above when those change. When your edit touches the harness itself (rules, AGENTS.md, skills, agents, MCP), see [`.rules/harness.md`](.rules/harness.md).

**Touch → update** (paths under `.rules/`):

- `components.md` — `src/components/**/*.tsx`
- `store.md` — `src/store/**/*.ts`
- `graph-model.md` — `src/data/relationTypes.ts`, `src/types/graph.ts`, `packages/graph/src/NessoEdge.tsx`, `src/components/dialogs/RelationTypesDialog.tsx`, `packages/vocab-learning/src/index.ts`
- `mentor.md` — `src/components/mentor/MentorPanel.tsx`, `src/llm/completion.ts`, `src/llm/context.ts`
- `conventions.md` — `src/**/*.{ts,tsx}` (only when conventions change, not every src edit)
- `testing.md` — `**/*.test.{ts,tsx}`; also `vitest.config.ts`, `playwright.config.ts`, `e2e/**`, CI test steps
- `theme.md` — `packages/theme/**`, `src/index.css`, `vite.config.ts`
- `docs.md` — `docs/src/content/docs/**/*.md`
- `static-analysis.md` — `src/**/*.{ts,tsx,js,mjs,cjs,css}`, `biome.json`, `prettier.config.js`, `scripts/license-header.mjs`, `src-tauri/src/**/*.rs`, `src-tauri/build.rs`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `packages/*/tsconfig.json`, `packages/*/src/**/*.{ts,tsx}`, `.fallowrc.jsonc`, `fallow-baselines/*.json`, `scripts/stryker/**`
- `compatibility.md` — `packages/schema/**`, `packages/vocab-learning/**`, `src/lib/workspace/**`, `src/lib/graphDocumentMapping.ts`, `src/lib/graphMapping.ts`, `src/store/**`, `src/data/conceptNodes.ts`
- `changelog.md` — `CHANGELOG.md`
- `harness.md` — `.rules/**`, `.opencode/**`, `AGENTS.md`, `opencode.json`

## Constraints — hard rules, never do this

### Never store chat history in the global store

`MentorPanel` conversation history is local state. It resets when the mentor sheet reopens, the graph changes, AI-endpoint readiness changes during the opening sequence, or the user clicks **New chat** — not on every selection change. Do not lift it into the Zustand store.

### Never use default React Flow edge types

All edges must use `type: 'nesso'`. The `NessoEdge` renderer from `@nesso-how/graph` is load-bearing for visual encoding (line style, glyph, category colour). Plain React Flow edges skip all of this.

### Never hardcode edge colours

Category colours are CSS custom properties (`--cat-taxonomic`, etc.) set by the active palette. Do not hardcode hex values for edge or node colours — use the variables so palette switching works.

### Never call the AI API outside llm/completion.ts

All AI chat completions go through `src/llm/completion.ts` (`fetchCompletion`), used by `MentorPanel`. Do not duplicate the fetch logic elsewhere — the API key is client-side and calls should stay scoped to those interactions.

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

- **Tools, payloads, documented behaviour** described to users → keep **`docs/src/content/docs/docs/guides/mcp.md`** accurate.
- **New / renamed / dropped doc sources** stitched by `get_nesso_docs` → add/remove the page under **`docs/src/content/docs/docs/`** plus **`docs/astro.config.mjs`** sidebar when needed, then run **`pnpm build`** in `packages/mcp`. The build script auto-discovers all `.md` files — no manifest to maintain.
- Prefer **no long-form prose-only** in `packages/mcp/`; put user-facing explanations in **`docs/`** and keep the MCP package as loaders + tooling. After editing stitched Markdown paths or doc bodies, run **`pnpm build`** in `packages/mcp` so **`dist/starlight-docs.pages.json`** refreshes (`pnpm dev` / `tsc --watch` alone does not rebuild it).

### Product features documented in `docs/`

- If you change **getting started**, **relation model**, flows, URLs, or any topic already covered in Starlight (**`docs/src/content/docs/docs/**/\*.md`\*\*), refresh that page so the live site matches the product.
- **`README.md`** and **`docs/`** can overlap for marketing vs guide detail; fix obvious contradictions when you notice them.
