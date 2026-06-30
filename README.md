<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/icon/nesso-dark.svg">
  <img src="public/icon/nesso.svg" alt="Nesso" width="96">
</picture>

# Nesso

**An app for building typed knowledge graphs for active learning.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/nesso-how/nesso?include_prereleases&label=desktop)](https://github.com/nesso-how/nesso/releases)
[![CI](https://github.com/nesso-how/nesso/actions/workflows/ci.yml/badge.svg)](https://github.com/nesso-how/nesso/actions/workflows/ci.yml)
[![Checked with Biome](https://img.shields.io/badge/Checked_with-Biome-60A5FA?logo=biome&logoColor=white)](https://biomejs.dev)
[![Analyzed with fallow](https://img.shields.io/badge/analyzed_with-fallow-0d7377)](https://github.com/fallow-rs/fallow)

[Website](https://nesso.how) · [Try it](https://app.nesso.how) · [Docs](https://nesso.how/docs/introduction) · [Releases](https://github.com/nesso-how/nesso/releases)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/hero-graph-dark.svg">
  <img src="docs/public/hero-graph.svg" alt="Concept graph: Understanding and its relations" width="800">
</picture>

## What it does

Nesso is an interactive concept map where nodes are ideas and edges are [typed semantic relations](https://nesso.how/docs/reference/relation-types) (52 types across 8 categories, e.g. `causes`, `requires`, `subtype-of`). Each concept carries spaced-repetition state scheduled by [FSRS](https://github.com/open-spaced-repetition/ts-fsrs). Available as a web app at [app.nesso.how](https://app.nesso.how) and as a native macOS desktop build.

> [!NOTE]
> An experimental AI mentor (Socrates) is also available: opt-in under **Settings → AI**, requires an OpenAI-compatible endpoint (local Ollama or a cloud provider).

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

## Project structure

```
src/
  components/     UI components (read state via useGraphStore)
  store/          Zustand store (index.ts + slices/: graph-editing, graph-management, settings, ui)
  llm/            mentor transport (OpenAI-compatible fetch)
  data/           relation type registry, seed graphs
  types/graph.ts  facade re-exporting vocab-learning + graph display + app settings
src-tauri/        Tauri v2 Rust shell (conf, capabilities, icons)
packages/
  schema/         @nesso-how/schema: vocabulary-agnostic graph JSON serialize/deserialize
  vocab-learning/ @nesso-how/vocab-learning: graph vocabulary (relations, node params, palettes)
  theme/          @nesso-how/theme: design tokens (colours, fonts, spacing, radii)
  graph/          @nesso-how/graph: embeddable graph React component (read-only by default)
  mcp/            @nesso-how/mcp: MCP server for LLM clients
docs/             Starlight docs site, published at nesso.how/docs
```

## Architecture

Nesso is a React 18 + Vite + TypeScript single-page app, optionally wrapped by Tauri v2 for a native desktop shell. All state lives in a single [Zustand](https://github.com/pmndrs/zustand) store, with components subscribing via selectors and no prop drilling.

The canvas is built on [React Flow](https://reactflow.dev/) with a custom edge renderer that encodes each relation type as a distinct line style and SVG glyph. Graph content persists to IndexedDB on web and is also written to a folder of `.json` files on desktop, with a file watcher that picks up external edits. FSRS review progress lives in a separate IndexedDB store and is never mixed into the shared graph files.

The AI mentor talks to any OpenAI-compatible `chat/completions` endpoint. On every send the system prompt is rebuilt from the live store, so the model always sees the current graph, the active selection, and a focal neighbourhood of related concepts.

The repo is a pnpm workspace monorepo. The graph vocabulary lives in [packages/vocab-learning](packages/vocab-learning) and is consumed by both the app and an MCP server in [packages/mcp](packages/mcp) that lets LLM clients query relation types, read the bundled docs, build valid graph documents, and validate graph JSON.

## Packages

Nesso is built as a monorepo of focused packages so that its graph vocabulary, visual components, and tooling can be used independently of the full app. The MCP server, embeddable graph component, and schema layer are all separate entry points into the same underlying model.

| Package                                                                                | Purpose                                                                                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`@nesso-how/schema`](https://www.npmjs.com/package/@nesso-how/schema)                 | Vocabulary-agnostic graph document: `concepts`/`relations`, serialize/deserialize           |
| [`@nesso-how/vocab-learning`](https://www.npmjs.com/package/@nesso-how/vocab-learning) | Graph vocabulary: relation types, FSRS node params, category palettes, `NessoGraphDocument` |
| [`@nesso-how/theme`](https://www.npmjs.com/package/@nesso-how/theme)                   | Shared design tokens for the app, graph embeds, and docs site                               |
| [`@nesso-how/graph`](https://www.npmjs.com/package/@nesso-how/graph)                   | Embeddable `<NessoGraph />` React component for docs and external apps                      |
| [`@nesso-how/mcp`](https://www.npmjs.com/package/@nesso-how/mcp)                       | MCP server: query relation types, read docs, build and validate graph documents             |

## Contributing

Bug reports, feature ideas, and PRs are welcome on [GitHub Issues](https://github.com/nesso-how/nesso/issues). Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Copyright © 2026 Omar Desogus. Licensed under the [MIT License](https://opensource.org/licenses/MIT). See [LICENSE](LICENSE).
