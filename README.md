# Nesso

**An AI-powered knowledge graph for active learning.** Build your understanding by mapping concepts and relations, then let Socrates — a Socratic AI mentor — probe and challenge what you know.

## What it does

Nesso is an interactive concept map where nodes are ideas and edges are typed semantic relations. You draw connections between concepts, pick the relation type (e.g. `causes`, `requires`, `is-a`), and each concept carries FSRS scheduling state for spaced repetition. Open **Socrates** from the FAB for a Socratic dialogue about your graph (your current selection is included as context); answers favour questions over lectures.

## Features

- **Knowledge graph canvas** — add, move, and delete concept nodes and typed edges; drag a marquee or hold ⌘/Ctrl to multi-select, then bulk-delete from the dock
- **17 semantic relation types** across 6 categories (taxonomic, structural, causal, dependency, temporal, opposition), each with a distinct line style and glyph
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

### Graph canvas

- [x] Undo/Redo + graph history — step backward and forward through graph edits, with a visible history of node, edge, and layout changes
- [x] Multiple selection — select and move groups of nodes and edges together, with bulk actions in the inspector where useful
- [ ] Image export — export the current graph canvas as a shareable image for notes, presentations, or documentation
- [ ] Parallel-edge handling — one edge per directed pair, or offset overlapping arcs when source/target coincide

### AI mentor

- [ ] AI response rendering — proper formatting for code blocks and rich output
- [ ] Chat history — persist and revisit past mentor sessions per graph
- [ ] Voice I/O — speech input and text-to-speech output for the AI mentor
- [ ] Specialized local models — investigate small in-browser models via Transformers.js (WASM) for specific tasks: embedding (`all-MiniLM-L6-v2`, ~23 MB) for semantic search and duplicate detection, zero-shot relation classification (`nli-deberta-v3-small`, ~83 MB) for edge-type suggestion, and cross-encoder reranking (`ms-marco-MiniLM-L-6-v2`, ~22 MB) for mentor context retrieval on large graphs
- [ ] Wikipedia/Wikidata context enrichment — fetch Wikipedia summaries and Wikidata structured relations for concept nodes and inject them as context when the AI generates text

### Learning & review

- [x] Per-node elaboration — structured annotations alongside each concept: definition in own words, user-built examples, open questions, informal connections not yet ready to be formalised as edges, and a free-text field as an escape hatch
- [x] FSRS-based review scheduling — **done:** `ts-fsrs` with per-node stability, difficulty, reps, lapses, due, and last rating; Settings → Review for target retention and max interval
- [x] AI-guided spaced repetition — when surfacing a node for review, feed its edges and neighbours to the AI mentor to generate questions that probe relational understanding rather than isolated recall; replace the current heuristic scheduler with one informed by both FSRS stability scores and graph topology

### Core features

- [ ] Two-mode system — student (active learning) and professor (build reference graphs, evaluate student maps)

### Design

- [ ] Inspector — refresh layout, typography, grouping, and visual hierarchy so the side panel stays easy to scan and consistent with canvas chrome
- [ ] Review dialog — revamp spacing, typography, and controls so the FSRS overlay feels cohesive with the rest of the chrome

### Data & sync

- [ ] Session export — download a JSON snapshot of the graph and chat log
- [ ] File system sync — on desktop, persist each graph as a `.json` file on disk (via Tauri FS API) and watch for external changes, so graphs are portable and editable outside the app

### Platform & infrastructure

- [ ] Tauri auto-updates — signing and `latest.json` delivery via GitHub Releases _(pending public repo)_
- [ ] GH Pages deployment _(pending public repo)_
- [ ] Package extraction — modularise reusable parts as standalone npm libraries. Requires proper code review from dev.

### Localisation & docs

- [x] Translations — Italian and English; auto-detected on first launch; all UI strings, seed graphs, AI system prompts, and relation type labels are locale-aware; adding a language requires one new locale file typed against `typeof en`
- [ ] README rewrite — proper project presentation with screenshot, and architecture overview

## License

Copyright © 2026 Omar Desogus. This project is licensed under the [MIT License](https://opensource.org/licenses/MIT) — see [`LICENSE`](LICENSE).
