# Nesso

**An AI-powered knowledge graph for active learning.** Build your understanding by mapping concepts and relations, then let Socrates — a Socratic AI mentor — probe and challenge what you know.

## What it does

Nesso is an interactive concept map where nodes are ideas and edges are typed semantic relations. You draw connections between concepts, pick the relation type (e.g. `causes`, `requires`, `is-a`), and track your confidence in each node. When you select a node or edge, Socrates opens a dialogue rooted in that concept — asking questions, not giving answers, in the spirit of Socratic enquiry.

## Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite + TypeScript |
| Graph canvas | [React Flow (`@xyflow/react`)](https://reactflow.dev/) |
| State | Zustand |
| AI mentor | Any OpenAI-compatible chat API (default: Anthropic Claude via `@anthropic-ai/sdk`) |

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

## Project structure

React + Vite single-page app. `src/components/` holds all UI components, `src/store/graph.ts` is the single Zustand store (nodes, edges, selection, settings), `src/data/` contains the edge type definitions and seed graph, and `src/types/graph.ts` has all shared TypeScript types.

## Edge relation model

Edges carry a semantic `type` from 17 named relations grouped into 6 categories:

| Category | Relations |
|---|---|
| Taxonomic | `is-a`, `instance-of`, `subtype-of` |
| Structural | `part-of`, `made-of`, `contains` |
| Causal | `causes`, `produces`, `enables`, `prevents`, `triggers` |
| Dependency | `requires`, `uses` |
| Temporal | `precedes`, `occurs-in` |
| Opposition | `contrasts-with`, `opposite-of` |

Each relation has a line style (solid, dashed, dotted, double, wavy) and an SVG glyph. Encoding density is controlled by the `edgeEncoding` setting (`full`, `category`, `minimal`).

## Keyboard shortcuts

| Key | Action |
|---|---|
| `?` | Toggle edge legend |
| `⌘R` / `Ctrl+R` | Open review mode |
| `Delete` / `Backspace` | Delete selected node or edge |
| `Escape` | Close overlays |
