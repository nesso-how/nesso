# @nesso-how/ai

See [README.md](README.md) for usage and the public API overview.

- Keep this package framework-independent and limited to tool contracts, message and provider schemas, text limits, and assistant instructions. Never import the app host, Electron, or a concrete store.
- Keep state, tool execution, edit validation, history, approvals, and persistence in the host. Credentials, provider transport, and the MCP server belong to Electron.
