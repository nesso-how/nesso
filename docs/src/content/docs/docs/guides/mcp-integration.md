---
title: MCP
description: Connect Nesso to Claude, Cursor, or any MCP-compatible AI client.
---

The `@nesso-how/mcp` package is a [Model Context Protocol](https://modelcontextprotocol.io/) server that gives AI clients access to Nesso documentation, the full relation-type vocabulary, and tools to **build** and **validate** graph documents. Once connected, models can answer questions about how Nesso works, produce importable graph JSON, and check files before writing them back to disk.

## Setup

### Claude Desktop

Open `claude_desktop_config.json`. On macOS it lives at `~/Library/Application Support/Claude/claude_desktop_config.json`; on Windows at `%APPDATA%\Claude\claude_desktop_config.json`.

Add a `nesso` entry under `mcpServers`:

```json
{
  "mcpServers": {
    "nesso": {
      "command": "npx",
      "args": ["-y", "@nesso-how/mcp"]
    }
  }
}
```

Save the file and restart Claude Desktop. The Nesso tools will be available to the model automatically.

### Cursor

Open **Settings -> MCP** and add a new server with command `npx` and args `["-y", "@nesso-how/mcp"]`.

### Other MCP clients

Any client that speaks the stdio MCP transport works. Run `npx -y @nesso-how/mcp` as the server command. No other configuration is required.

## What it can do

Once connected, you can ask your AI client things like:

- "What relation types does Nesso support?" (uses `get_relation_types`)
- "Show me the Nesso getting started guide" (uses `get_nesso_docs`)
- "Build a graph about photosynthesis with causes and enables relations" (uses `build_graph`)
- "Validate this graph JSON before I save it" (uses `validate_graph`)

The MCP server is **stateless** and does not read or write files. Your client uses its own filesystem tools to read `.json` graph files, passes the contents inline to `validate_graph` or `build_graph`, and writes the result back. Nesso picks up external edits through its normal workspace sync.

### Agent workflow for graph files

A typical end-to-end flow when the client has filesystem access:

1. **Read** the target graph `.json` from the project folder (client filesystem tool).
2. **Validate** with `validate_graph` — fix any `errors` before saving; review `warnings` (e.g. missing `vocabulary` or relation `type`).
3. **Build or extend** with `build_graph` when creating a new graph from structured concepts and relations — the tool assigns ids, vocabulary metadata, valid relation types, and layout positions.
4. **Re-validate** the output with `validate_graph` if the client edited the JSON by hand.
5. **Write** the JSON back to disk (client filesystem tool). Open or sync the graph in Nesso.

Example prompt:

> Read `graphs/biology.json` in this workspace, validate it with Nesso MCP, then use `build_graph` to add concepts "Chloroplast" and "Glucose" linked by `produces`, merge the result, re-validate, and write the file back.

You can also build graphs directly in [app.nesso.how](https://app.nesso.how) or import JSON via **Graph menu → Import JSON**.

## Tools reference

### `get_nesso_docs`

Fetches documentation pages from this site. Call it without a `slug` to get a table of contents, or with a slug (e.g. `"guides/getting-started"`) to get the full page content.

### `get_relation_types`

Returns the complete list of relation types grouped by category id (`taxonomic`, `structural`, … from `RELATION_CATEGORIES` in `@nesso-how/vocab-learning`), with line style, symmetry, and type properties (transitive, inverse, strength, polarity, cardinality). Use this whenever you need valid type names for graph JSON or explanations for the learner.

### `validate_graph`

**Input:** `{ "graph": "<json string>" }` — a Nesso graph **document** (`concepts[]`, `relations[]`), not runtime React Flow `nodes`/`edges`.

**Output:** `{ "valid": boolean, "errors": [{ "path", "message" }], "warnings": [{ "path", "message" }] }`

Runs envelope and vocabulary validation plus structural checks the deserializer does not cover today: duplicate ids, dangling relation endpoints, unknown relation types. Warnings flag missing `vocabulary` or relation `type` (the app falls back to `causes` at render time).

`valid` is `true` only when `errors` is empty.

### `build_graph`

**Input:**

```json
{
  "name": "Photosynthesis",
  "concepts": [
    "Sunlight",
    {
      "text": "Chloroplast",
      "elaboration": { "definition": "...", "examples": "...", "notes": "" }
    }
  ],
  "relations": [{ "from": "Sunlight", "to": "Chloroplast", "relation": "enables" }]
}
```

- `concepts` — label strings or objects with optional `id`, `text`, and `elaboration`.
- `relations` — `from` / `to` match concept `id` or label (must be unambiguous); `relation` must be a valid type id from `get_relation_types`.

**Output:** Pretty-printed graph document JSON ready to write to disk (includes `vocabulary`, generated ids, and dagre layout positions). FSRS review fields and React Flow edge shape (`type: "nesso"`, handles) are applied by the app on import, not stored in the file.
