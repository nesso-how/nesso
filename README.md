# Nesso

**An AI-powered knowledge graph for active learning.** Build your understanding by mapping concepts and relations, then let Socrates — a Socratic AI mentor — probe and challenge what you know.

## What it does

Nesso is an interactive concept map where nodes are ideas and edges are typed semantic relations. You draw connections between concepts, pick the relation type (e.g. `causes`, `requires`, `is-a`), and each concept carries FSRS scheduling state for spaced repetition. Open **Socrates** from the FAB for a Socratic dialogue about your graph (your current selection is included as context); answers favour questions over lectures.

## Features

- **Knowledge graph canvas** — add, move, and delete concept nodes and typed edges; drag a marquee or hold ⌘/Ctrl to multi-select, then bulk-delete from the dock
- **21 semantic relation types** across 7 categories (taxonomic, structural, causal, dependency, temporal, opposition, similarity), each with a distinct line style and glyph
- **Inspector panel** — edit concept text; inspect FSRS due date, stability, and last rating; change relation type in-place
- **Socratic AI mentor** — opens a context-aware dialogue when you select a node or edge; probes understanding rather than explaining
- **Spaced-repetition review mode** — FSRS (`ts-fsrs`) queues due concepts; rate Again / Hard / Good / Easy from the Review overlay (**R**)
- **Concept search** — ⌘K palette to jump to any node instantly
- **Multiple graphs** — create, name, and switch between graphs; persisted in IndexedDB
- **Provider-agnostic AI** — configure any OpenAI-compatible endpoint (Ollama locally, or any cloud provider) from Settings
- **Edge encoding modes** — full (glyph + style), category (colour only), or minimal
- **Localisation** — English and Italian UI; language is auto-detected on first launch and can be changed in Settings → Appearance; seed graphs are served in the detected language; the AI mentor and review prompts instruct the model to reply in the active language
- **Theming** — dark/light toggle, accent colour, and per-category palette
- **Desktop app** — macOS (Apple silicon + Intel) via Tauri v2, available on [GitHub Releases](https://github.com/cedoor/nesso/releases)

## Stack

| Layer        | Technology                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Framework    | React 18 + Vite + TypeScript                                                                                                 |
| Desktop      | Tauri v2 — binaries via [GitHub Releases](https://github.com/cedoor/nesso/releases)                                          |
| Graph canvas | [React Flow (`@xyflow/react`)](https://reactflow.dev/)                                                                       |
| State        | Zustand                                                                                                                      |
| AI mentor    | OpenAI-compatible `chat/completions` via `fetch` (default: local [Ollama](http://localhost:11434); configurable in Settings) |

## Getting started

```sh
pnpm install
```

With defaults, Nesso talks to **Ollama** at `http://localhost:11434/v1` (no API key). Pull a model first, e.g. `ollama pull gemma3:4b`.

For a cloud provider instead, set base URL, model, and **API key** in **Settings** (gear or **⌘,** / **Ctrl+,**).

> Any API key is used client-side and stored in the browser (localStorage). Do not deploy this app publicly with secrets embedded.

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

Edges carry a semantic `type` from 21 named relations grouped into 7 categories:

| Category   | Relations                                                           |
| ---------- | ------------------------------------------------------------------- |
| Taxonomic  | `is-a`, `instance-of`, `subtype-of`                                 |
| Structural | `part-of`, `made-of`, `contains`                                    |
| Causal     | `causes`, `produces`, `enables`, `prevents`, `triggers`, `inhibits` |
| Dependency | `requires`, `uses`, `used-for`                                      |
| Temporal   | `precedes`, `occurs-in`                                             |
| Opposition | `contrasts-with`, `opposite-of`                                     |
| Similarity | `similar-to`, `analogous-to`                                        |

Each relation has a line style (solid, dashed, dotted, double, wavy) and an SVG glyph. Encoding density is controlled by the `edgeEncoding` setting (`full`, `category`, `minimal`).

## Roadmap

### Graph canvas

- [ ] Image export — export the current graph canvas as a shareable image for notes, presentations, or documentation
- [ ] Parallel-edge handling — one edge per directed pair, or offset overlapping arcs when source/target coincide

### AI mentor

- [ ] AI response rendering — proper formatting for code blocks and rich output
- [ ] Chat history — persist and revisit past mentor sessions per graph
- [ ] Voice I/O — speech input and text-to-speech output for the AI mentor
- [ ] Specialized local models — investigate small in-browser models via Transformers.js (WASM) for specific tasks: embedding (`all-MiniLM-L6-v2`, ~23 MB) for semantic search and duplicate detection, zero-shot relation classification (`nli-deberta-v3-small`, ~83 MB) for edge-type suggestion, and cross-encoder reranking (`ms-marco-MiniLM-L-6-v2`, ~22 MB) for mentor context retrieval on large graphs
- [ ] Wikipedia/Wikidata context enrichment — fetch Wikipedia summaries and Wikidata structured relations for concept nodes and inject them as context when the AI generates text

### Core features

- [ ] Two-mode system — student (active learning) and professor (build reference graphs, evaluate student maps)

### Data & sync

- [ ] Session export — download a JSON snapshot of the graph and chat log
- [ ] File system sync — on desktop, persist each graph as a `.json` file on disk (via Tauri FS API) and watch for external changes, so graphs are portable and editable outside the app

### Platform & infrastructure

- [ ] Tauri auto-updates — signing and `latest.json` delivery via GitHub Releases _(pending public repo)_
- [x] Web deployment — hosted on Vercel

### Modularisation & plugins

- [ ] Nesso MCP package — Model Context Protocol server so MCP-capable LLM clients can search and pull Nesso documentation and inspect the relation-type vocabulary (**`get_nesso_docs`**, **`get_relation_types`**)
- [ ] Custom themes — register full theme packs (palette + typography + spacing scale) beyond the current palette switch, so contributors can ship visual identities as drop-in modules
- [ ] Importer/exporter plugins — pluggable converters for Markdown, Anki decks, Mermaid, OPML, and Cytoscape JSON to ease onboarding from existing notes
- [ ] Mentor personas — registerable AI personas (Socrates, devil's advocate, summariser, exam tutor) sharing the same transport but with distinct system prompts and UI affordances
- [ ] Analyzer panels — read-only side panels that surface graph insights (centrality, clusters, missing relations per category) as third-party-contributable components

### Localisation & docs

- [ ] README rewrite — proper project presentation with screenshot, and architecture overview

## License

Copyright © 2026 Omar Desogus. This project is licensed under the [MIT License](https://opensource.org/licenses/MIT) — see [`LICENSE`](LICENSE).
