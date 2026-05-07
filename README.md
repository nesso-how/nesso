# Nesso

**An AI-powered knowledge graph for active learning.** Build your understanding by mapping concepts and relations, then let Socrates — a Socratic AI mentor — probe and challenge what you know.

## What it does

Nesso is an interactive concept map where nodes are ideas and edges are typed semantic relations. You draw connections between concepts, pick the relation type (e.g. `causes`, `requires`, `is-a`), and track your confidence in each node. When you select a node or edge, Socrates opens a dialogue rooted in that concept — asking questions, not giving answers, in the spirit of Socratic enquiry.

## Features

- **Knowledge graph canvas** — add, move, and delete concept nodes and typed edges
- **17 semantic relation types** across 6 categories (taxonomic, structural, causal, dependency, temporal, opposition), each with a distinct line style and glyph
- **Inspector panel** — edit concept text, set confidence (1–5), and change relation type in-place
- **Socratic AI mentor** — opens a context-aware dialogue when you select a node or edge; probes understanding rather than explaining
- **Spaced-repetition review mode** — surfaces low-confidence or stale nodes for targeted review
- **Concept search** — ⌘K palette to jump to any node instantly
- **Multiple graphs** — create, name, and switch between graphs; persisted in IndexedDB
- **Provider-agnostic AI** — configure any OpenAI-compatible endpoint (Ollama locally, or any cloud provider) from Settings
- **Edge encoding modes** — full (glyph + style), category (colour only), or minimal
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

With defaults, Nesso talks to **Ollama** at `http://localhost:11434/v1` (no API key). Pull a model first, e.g. `ollama pull gemma2:2b`.

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

- [ ] Parallel-edge handling — one edge per directed pair, or offset overlapping arcs when source/target coincide
- [ ] AI response rendering — proper formatting for code blocks and rich output
- [ ] Chat history — persist and revisit past mentor sessions per graph
- [ ] Session export — download a JSON snapshot of the graph and chat log
- [x] Confidence heatmap — colour-grade the canvas by node confidence
- [ ] FSRS-based review scheduling — replace the current heuristic with the [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm), mapping node confidence (1–5) to Again/Hard/Good/Easy ratings and tracking per-node stability and retrievability
- [x] Seed graph — simplify the default graph for a broader audience
- [ ] Design refresh
- [ ] Translations — Italian and English to start
- [ ] Voice I/O — speech input and text-to-speech output for the AI mentor
- [ ] Two-mode system — student (active learning) and professor (build reference graphs, evaluate student maps)
- [ ] Package extraction — modularise reusable parts as standalone npm libraries
- [ ] Tauri auto-updates — signing and `latest.json` delivery via GitHub Releases _(pending public repo)_
- [ ] GH Pages deployment _(pending public repo)_

## License

Copyright © 2026 Omar Desogus. This project is licensed under the [MIT License](https://opensource.org/licenses/MIT) — see [`LICENSE`](LICENSE).

## Keyboard shortcuts

| Key                    | Action                        |
| ---------------------- | ----------------------------- |
| `?`                    | Toggle keyboard shortcuts     |
| `⌘,` / `Ctrl+,`        | Toggle settings (AI endpoint) |
| `R`                    | Open review mode              |
| `Delete` / `Backspace` | Delete selected node or edge  |
| `Escape`               | Close overlays                |
