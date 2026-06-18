<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/icon/nesso-dark.svg">
  <img src="public/icon/nesso.svg" alt="Nesso" width="96">
</picture>

# Nesso

**An app for building typed knowledge graphs for active learning.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm @nesso-how/mcp](https://img.shields.io/npm/v/@nesso-how/mcp?label=%40nesso-how%2Fmcp)](https://www.npmjs.com/package/@nesso-how/mcp)
[![GitHub release](https://img.shields.io/github/v/release/nesso-how/nesso?include_prereleases&label=desktop)](https://github.com/nesso-how/nesso/releases)

[Website](https://nesso.how) · [Try it](https://app.nesso.how) · [Docs](https://nesso.how/docs/introduction) · [Releases](https://github.com/nesso-how/nesso/releases)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/hero-graph-dark.svg">
  <img src="docs/public/hero-graph.svg" alt="Concept graph: Understanding and its relations" width="800">
</picture>

## What it does

Nesso is an interactive concept map where nodes are ideas and edges are typed semantic relations. You draw connections between concepts, pick the relation (e.g. `causes`, `requires`, `subtype-of`), and each concept carries spaced-repetition state. **Socrates**, a Socratic AI mentor, reads the current graph and your selection, then probes your understanding through questions rather than explanations.

> [!WARNING]
> **Early alpha.** The typed graph and spaced-repetition review work today; the Socratic mentor is experimental and needs an OpenAI-compatible endpoint (e.g. a local Ollama model or a cloud provider) — there is no built-in model. Expect breaking changes.

## Features

- **Typed knowledge graph**: 52 semantic relations across 8 categories, with inverse pairs; each type renders with a distinct line style and glyph
- **Spaced-repetition review**: FSRS scheduling via [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs); rate Again / Hard / Good / Easy
- **Socratic AI mentor** (experimental): context-aware dialogue that probes rather than explains; connects to any OpenAI-compatible endpoint (local Ollama or a cloud provider)
- **Multi-graph workspace**: create and switch between graphs; persisted in IndexedDB (web) and mirrored to `.json` files on disk (desktop)
- **Cross-platform**: web app at [app.nesso.how](https://app.nesso.how) plus a Tauri v2 macOS desktop build

## Quick start

**Prerequisites:** Node 20+, [pnpm](https://pnpm.io) 10+ (via `corepack enable`), and a [Rust toolchain](https://tauri.app/start/prerequisites/) for the desktop build.

```bash
pnpm install
pnpm dev          # web app at http://localhost:5173
pnpm dev:desktop  # Tauri v2 desktop shell
```

`pnpm install` builds the workspace packages automatically (via `prepare`). To build for production:

```bash
pnpm build          # web bundle
pnpm build:desktop  # desktop binary
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for commit conventions, branch naming, and the PR workflow.

## Project structure

```
src/
  components/     UI components (read state via useGraphStore)
  store/graph.ts  single Zustand store (nodes, edges, selection, settings)
  llm/            mentor transport (OpenAI-compatible fetch)
  data/           edge type registry, seed graphs
  types/graph.ts  shared TypeScript types
src-tauri/        Tauri v2 Rust shell (conf, capabilities, icons)
packages/
  relation-types/ @nesso-how/relation-types: shared semantic vocabulary
  types/          @nesso-how/types: shared TypeScript types
  formats/        @nesso-how/formats: graph JSON serialize/deserialize
  graph/          @nesso-how/graph: embeddable read-only graph React component
  mcp/            @nesso-how/mcp: MCP server for LLM clients
docs/             Starlight docs site, published at nesso.how/docs
```

## Architecture

Nesso is a React 18 + Vite + TypeScript single-page app, optionally wrapped by Tauri v2 for a native desktop shell. All app state lives in a single Zustand store ([src/store/graph.ts](src/store/graph.ts)), and components subscribe via selectors with no prop drilling. Graph data persists to **IndexedDB** (web) and is **dual-written to a workspace folder of `.json` files** on desktop (with file watch for external edits); UI chrome to **localStorage**.

The canvas is built on [React Flow](https://reactflow.dev/) via `@nesso-how/graph` (`NessoEdge`, `ConceptNodeBody`); the app adds an interactive `ConceptNode` wrapper for inline edit and connection handles. Each edge renders its semantic relation as a distinct line style plus an SVG glyph. Every node carries FSRS scheduling fields (`stability`, `difficulty`, `due`, `lastRating`) consumed by the Review overlay.

The AI mentor in [src/llm/](src/llm/) is experimental and talks to any **OpenAI-compatible** `chat/completions` endpoint (a local Ollama model or a cloud provider). On every send the system prompt is rebuilt from the live store, so the model always sees the current graph snapshot, selection, and a focal neighbourhood.

The repo is a **pnpm workspace** monorepo. Shared semantic vocabulary lives in [packages/relation-types](packages/relation-types) and is consumed by both the app and an MCP server in [packages/mcp](packages/mcp) that exposes Nesso's relation types and documentation to MCP-capable LLM clients.

## Packages

| Package                                                                                | Purpose                                                                 |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`@nesso-how/relation-types`](https://www.npmjs.com/package/@nesso-how/relation-types) | Shared semantic relation vocabulary and TypeScript types                |
| [`@nesso-how/types`](https://www.npmjs.com/package/@nesso-how/types)                   | Shared TypeScript types: graph, node, edge, settings, FSRS              |
| [`@nesso-how/formats`](https://www.npmjs.com/package/@nesso-how/formats)               | Graph serialization formats: JSON serialize/deserialize                 |
| [`@nesso-how/graph`](https://www.npmjs.com/package/@nesso-how/graph)                   | Embeddable `<NessoGraph />` React component for docs and external apps  |
| [`@nesso-how/mcp`](https://www.npmjs.com/package/@nesso-how/mcp)                       | MCP server exposing Nesso's relation vocabulary and docs to LLM clients |

## Contributing

Bug reports, feature ideas, and PRs are welcome on [GitHub Issues](https://github.com/nesso-how/nesso/issues). Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Copyright © 2026 Omar Desogus. Licensed under the [MIT License](https://opensource.org/licenses/MIT). See [LICENSE](LICENSE).
