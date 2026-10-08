# @nesso/ai

Private workspace package with shared contracts for Nesso's desktop chat and MCP integration.

## Exports

- `@nesso/ai`: tool descriptions and Zod schemas, provider defaults, connection and result types.
- `@nesso/ai/providers`: provider contracts without loading tool schemas.

## Boundary

Contracts only: no app state, execution, approvals, credentials, IPC or network access. Document edits and approvals belong to the host; provider requests and transport belong to Electron.

## Build

`pnpm --filter @nesso/ai build`

Vite uses TypeScript sources; Node and Electron use compiled JavaScript. Root build, test and desktop development commands build this package automatically.
