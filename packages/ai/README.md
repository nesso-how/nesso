# @nesso-how/ai

Framework-independent tool contracts, message formats, effect summaries, shared limits, provider settings, and assistant instructions for Nesso's desktop AI chat and local MCP server. The host owns state and execution; Electron handles credentials and transport.

## Usage

```ts
import { aiChatInstructions, aiTools } from '@nesso-how/ai'

const input = aiTools.concepts.inputSchema.parse({ query: 'Learning' })
const instructions = aiChatInstructions({ locale: 'en' })
console.log(input, instructions)
```

Tool schemas validate input; the host supplies execution. Assistants cannot reset the document, change selection, or navigate.

## Tools

- **Read**: `context` summarizes the active view, selection, vocabulary, and history. `concepts`, `relations`, `views`, `relation_types`, and `selection` provide paginated details; concept and relation queries default to the active view.
- **Write**: `edit` stages ordered graph and saved-view operations. `history` stages shared undo or redo as the only write in a turn.
- **Documentation**: `read_docs` returns a bundled README for `nesso`, `ai`, `plugin`, `plugin-example`, `schema`, `concept-map`, or `ui`, without filesystem or network access.
- **Plugins (MCP only)**: `aiMcpTools` adds `plugins`, which lists installed packages, their provenance, and the latest failure of local plugins as untrusted text, and `propose_plugin`, which submits the absolute path of a built package directory for in-app approval. Electron reads only `package.json`, the entry, and the fonts the theme references. A proposal can replace only an installed local plugin, never an npm or bundled one.

Chat applies a turn's writes together only after the response completes successfully. MCP reads are immediate; each `edit` or `history` call requires in-app approval and commits independently. A plugin proposal is independent of document edits, installs as soon as the user approves it, and returns `installed`, `cancelled`, or `failed` with validation or load issues. MCP requests time out after 120 seconds, approval included.

## API

- `aiTools`: tool descriptions and Zod input schemas, with `AiToolResults` and `AiEffects` result types.
- `aiConversation`, `aiChatRequest`: persisted conversation and transport request schemas, with message, event, and reply contracts.
- `aiChatInstructions`, `aiChatMessages`: assistant instructions and provider-bound messages with document context and host outcomes.
- `summarizeAiEffects`, `hasAiEffects`: summarize effect counts and detect document changes without accessing host state.
- `aiTextLimits`, `aiChatLimits`: shared graph text limits and conversation message, count, and context limits.
- `aiProviders`: provider defaults, connections, accounts, and result types.

`@nesso-how/ai/providers` exposes connection schemas and types without loading tool schemas. See [src/index.ts](src/index.ts) and [src/providers.ts](src/providers.ts) for all exports.
