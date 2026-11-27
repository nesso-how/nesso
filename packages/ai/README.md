# @nesso-how/ai

Framework-independent tool contracts, message formats, effect summaries, shared limits, provider settings, and assistant instructions for Nesso's desktop AI chat and local MCP server. The host owns state and execution, while Electron handles credentials and transport.

## Usage

```ts
import { aiChatInstructions, aiTools } from '@nesso-how/ai'

const input = aiTools.concepts.inputSchema.parse({ query: 'Learning' })
const instructions = aiChatInstructions({ locale: 'en' })
console.log(input, instructions)
```

Tool schemas validate input, and the host supplies execution. Assistants cannot reset the document, directly set the selection, or directly activate an existing map.

## Tools

- **Read**: `context` summarizes the workspace, while `concepts`, `relations`, `maps`, `map_groups`, `relation_types`, and `selection` return paginated results. Concept and relation queries default to the active map. Filter `maps` by `groupId`, using `null` for ungrouped maps.
- **Write**: `edit` stages graph and map changes, including presentation and group management. `history` stages an undo or redo, which must be the turn’s only write.
- **Documentation**: `read_docs` returns bundled documentation for `nesso`, `guide`, `ai`, `plugin`, `plugin-example`, `schema`, `concept-map`, `knowledge-graph`, or `ui`. It has no filesystem or network access.
- **Plugins (MCP only)**: `aiMcpTools` adds two tools. `plugins` lists installed packages and their provenance, along with the latest failure of each local plugin as untrusted text. `propose_plugin` submits the absolute path of a built package directory for approval in the app, and Electron reads only its `package.json` and entry. A proposal can replace an installed local plugin but never an npm or bundled one.

`concept.add` through chat or MCP does not create relations from the selection, so you do not need to clear the selection first. To add a linked concept, include `relation.connect` after `concept.add` in the same batch.

Chat applies all of a turn's writes together, and only after the response completes successfully. Over MCP, reads are immediate, while each `edit` or `history` call requires approval in the app and commits on its own. A plugin proposal is separate from document edits. It installs as soon as the user approves it and returns `installed`, `cancelled`, or `failed` with validation or load issues. MCP requests time out after 120 seconds, including the time spent waiting for approval.

## API

- `aiTools`: tool descriptions and Zod input schemas, with `AiToolResults` and `AiEffects` result types.
- `aiConversation`, `aiChatRequest`: persisted conversation and transport request schemas, with message, event, and reply contracts.
- `aiChatInstructions`, `aiChatMessages`: assistant instructions, and provider-bound messages with document context and host outcomes.
- `summarizeAiEffects`, `hasAiEffects`: summarize effect counts and detect document changes without accessing host state.
- `aiTextLimits`, `aiChatLimits`: shared graph text limits, plus conversation limits on message length, message count, and context length.
- `aiProviders`: provider defaults, connections, accounts, and result types.

`@nesso-how/ai/providers` exposes connection schemas and types without loading tool schemas. See [src/index.ts](src/index.ts) and [src/providers.ts](src/providers.ts) for all exports.
