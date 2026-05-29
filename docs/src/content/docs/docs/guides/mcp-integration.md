---
title: MCP
description: Connect Nesso to Claude, Cursor, or any MCP-compatible AI client.
---

The `@nesso-how/mcp` package is a [Model Context Protocol](https://modelcontextprotocol.io/) server that gives AI clients access to Nesso documentation and the full relation-type vocabulary. Once connected, models can answer questions about how Nesso works and use the correct relation names when you build graphs yourself in the app or in JSON.

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

You can build graphs in [app.nesso.how](https://app.nesso.how) yourself, or ask the model to generate a graph as a JSON file and import it via **Graph menu → Import JSON**. Use `get_relation_types` to make sure the model picks valid relation names.

## Tools reference

### `get_nesso_docs`

Fetches documentation pages from this site. Call it without a `slug` to get a table of contents, or with a slug (e.g. `"guides/getting-started"`) to get the full page content.

### `get_relation_types`

Returns the complete list of relation types with their category, line style, symmetry, and semantic coefficients (transitive, inverse, strength, polarity, cardinality). Use this whenever you need valid type names for graph JSON or explanations for the learner.
