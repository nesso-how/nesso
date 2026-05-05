# Nesso

**An AI-powered knowledge graph for active learning.** Build your understanding by mapping concepts and relations, then let Socrates — a Socratic AI mentor — probe and challenge what you know.

## What it does

Nesso is an interactive concept map where nodes are ideas and edges are typed semantic relations. You draw connections between concepts, pick the relation type (e.g. `causes`, `requires`, `is-a`), and track your confidence in each node. When you select a node or edge, Socrates opens a dialogue rooted in that concept — asking questions, not giving answers, in the spirit of Socratic enquiry.

## Stack

| Layer        | Technology                                                                          |
| ------------ | ----------------------------------------------------------------------------------- |
| Framework    | React 18 + Vite + TypeScript                                                        |
| Desktop      | Tauri v2 — binaries via [GitHub Releases](https://github.com/cedoor/nesso/releases) |
| Graph canvas | [React Flow (`@xyflow/react`)](https://reactflow.dev/)                              |
| State        | Zustand                                                                             |
| AI mentor    | Any OpenAI-compatible chat API (default: Anthropic Claude via `@anthropic-ai/sdk`)  |

## Getting started

```sh
pnpm install
```

Create a `.env.local` file at the project root with your AI provider key:

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

> The API key is used client-side. This is intentional for local use; do not deploy this app publicly with your key embedded.

```sh
pnpm dev
```

## Desktop (Tauri)

Pre-built **alpha** macOS installers (Apple silicon + Intel) are published as [GitHub Releases](https://github.com/cedoor/nesso/releases) when a `v*` tag is pushed. Requires [Rust](https://rustup.rs/) locally:

```sh
pnpm install
pnpm build:desktop
```

## Project structure

React + Vite single-page app. `src/components/` holds all UI components, `src/store/graph.ts` is the single Zustand store (nodes, edges, selection, settings), `src/data/` contains the edge type definitions and seed graph, and `src/types/graph.ts` has all shared TypeScript types.

## Edge relation model

Edges carry a semantic `type` from 17 named relations grouped into 6 categories:

| Category   | Relations                                               |
| ---------- | ------------------------------------------------------- |
| Taxonomic  | `is-a`, `instance-of`, `subtype-of`                     |
| Structural | `part-of`, `made-of`, `contains`                        |
| Causal     | `causes`, `produces`, `enables`, `prevents`, `triggers` |
| Dependency | `requires`, `uses`                                      |
| Temporal   | `precedes`, `occurs-in`                                 |
| Opposition | `contrasts-with`, `opposite-of`                         |

Each relation has a line style (solid, dashed, dotted, double, wavy) and an SVG glyph. Encoding density is controlled by the `edgeEncoding` setting (`full`, `category`, `minimal`).

## Roadmap

- [x] Interactive graph canvas — add, move, delete nodes and edges
- [x] 17 typed relations across 6 semantic categories, each with distinct line style and glyph
- [x] Inspector panel — edit concept text, confidence, pinned state, and relation type
- [x] Socratic AI mentor — context-aware opening prompts based on selected node or edge
- [x] Spaced-repetition review mode — surfaces stale or low-confidence nodes
- [x] Edge encoding modes — full (glyph + style), category (colour only), minimal
- [x] Theming — dark/light toggle, accent colour, category palettes
- [x] Onboarding overlay
- [ ] Concept search (⌘K)
- [x] Keyboard shortcuts dialog
- [x] Persist settings, tutorial state, and relation-types panel visibility to LocalStorage
- [x] Save and load graphs via IndexedDB
- [x] Multiple graphs with tab switching
- [ ] Parallel-edge handling — enforce one edge per directed pair, or offset overlapping arcs when multiple edges share the same source/target
- [ ] Provider-agnostic AI — configure any OpenAI-compatible endpoint (Ollama, proprietary) from settings
- [ ] Session export — download a JSON snapshot of the graph and interaction log for offline analysis
- [x] Alpha release as a macOS desktop app via Tauri v2 (GitHub Releases: macOS arm64 + x64)
- [ ] Tauri auto-updates (`tauri-plugin-updater`, signing, `latest.json` on GitHub Releases) — feasible once the repo is public
- [x] Add license (MIT)

## Keyboard shortcuts

| Key                    | Action                       |
| ---------------------- | ---------------------------- |
| `?`                    | Toggle keyboard shortcuts    |
| `⌘R` / `Ctrl+R`        | Open review mode             |
| `Delete` / `Backspace` | Delete selected node or edge |
| `Escape`               | Close overlays               |
