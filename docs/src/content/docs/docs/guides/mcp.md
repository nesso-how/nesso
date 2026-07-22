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
2. **Validate** with `validate_graph`. Fix any `errors` before saving; missing or foreign `vocabulary` is a hard error that rejects the file. Review `warnings` (e.g. a missing relation `type`).
3. **Build or extend** with `build_graph` when creating a new graph from structured concepts and relations: the tool assigns ids, vocabulary metadata, valid relation types, and layout positions.
4. **Re-validate** the output with `validate_graph` if the client edited the JSON by hand.
5. **Write** the JSON back to disk (client filesystem tool). Open or sync the graph in Nesso.

Example prompt:

> Read `graphs/biology.json` in this workspace, validate it with Nesso MCP, then use `build_graph` to add concepts "Chloroplast" and "Glucose" linked by `produces`, merge the result, re-validate, and write the file back.

See [MCP tools](../../reference/mcp-tools/) for the full tool reference.
