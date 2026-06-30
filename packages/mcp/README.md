# @nesso-how/mcp

[MCP](https://modelcontextprotocol.io/) server for [Nesso](https://nesso.how) — relation types from the graph vocabulary and bundled docs for LLM clients.

## Install

```bash
npm install -g @nesso-how/mcp
# or run without install:
npx -y @nesso-how/mcp
```

## Usage

Add to your MCP client (Cursor, Claude Desktop, etc.):

```json
{
  "command": "npx",
  "args": ["-y", "@nesso-how/mcp"]
}
```

Tools: `get_relation_types`, `get_nesso_docs`, `validate_graph`, `build_graph`.

Full guide: [MCP](https://nesso.how/docs/guides/mcp/).

## License

MIT
