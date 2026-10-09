# @nesso/ai

Framework-independent tool contracts, chat schemas, and assistant instructions for Nesso's desktop AI chat. State, execution, and transport remain outside this package.

## Usage

```ts
import { aiChatInstructions, aiTools } from '@nesso/ai'

const input = aiTools.concepts.inputSchema.parse({ query: 'Learning' })
const instructions = aiChatInstructions({ locale: 'en' })
console.log(input, instructions)
```

Tool schemas validate input; the host supplies execution. Reads are paginated and default to the active view. Edits stage undoable graph and saved-view operations; reset, selection changes, and navigation are unavailable to the assistant.

## API

- `aiTools`: tool descriptions and Zod input schemas for targeted reads, staged edits, and shared undo/redo.
- `AiToolResults`, `AiEffects`: tool result and document effect types.
- `aiConversation`, `aiChatRequest`: persisted conversation and transport request schemas, with derived message/request types and event/reply contracts.
- `aiChatInstructions`, `aiChatMessages`: assistant instructions and provider-bound messages with document context and host outcomes.
- `aiRewriteApprovalThreshold`, `aiTextLimits`: shared approval threshold and text limits.
- `aiProviders`: provider defaults, with connection and result types.

`@nesso/ai/providers` also exposes the connection input schema and derived types without loading tool schemas. See [src/index.ts](src/index.ts) and [src/providers.ts](src/providers.ts) for exports and signatures.

## Boundary

Shared contracts and instructions only: no app state, execution, approvals, credentials, IPC or network access. Document edits and approvals belong to the host; provider requests and transport belong to Electron.

The host store owns conversation messages and outcomes, persisted separately as `nesso.conversation` and excluded from document history. The chat controller owns transient requests and approvals; Electron stores encrypted connections and credentials.

## Build

`pnpm --filter @nesso/ai build`

Vite uses TypeScript sources; Node and Electron use compiled JavaScript. Root build, test and desktop development commands build this package automatically.
