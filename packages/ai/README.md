# @nesso-how/ai

Framework-independent tool contracts, message formats, provider settings, and assistant instructions for Nesso's desktop AI chat and local MCP server. The host owns state and execution; Electron handles credentials and transport.

## AI in Nesso

On desktop, chat with your own API key (BYOK), a local model, or ChatGPT sign-in, or connect an external assistant through the local MCP server. Provider credentials are encrypted on your device, and requests go directly to the chosen endpoint. Graph edits are validated and undoable.

- **OpenAI**: API key or ChatGPT sign-in (OAuth, paid plan required: Go, Plus, or Pro).
- **Anthropic, Gemini, OpenRouter**: API key.
- **OpenAI-compatible endpoints**: hosted or local models, with an optional API key.
- **External assistants**: connect through the local MCP server.

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
- **Documentation**: `read_docs` returns a bundled README for `nesso`, `ai`, `plugin`, `plugin-example`, `schema`, or `concept-map`, without filesystem or network access.

Chat applies a turn's writes together only after the response completes successfully. MCP reads are immediate; each `edit` or `history` call requires in-app approval and commits independently.

## API

- `aiTools`: tool descriptions and Zod input schemas, with `AiToolResults` and `AiEffects` result types.
- `aiConversation`, `aiChatRequest`: persisted conversation and transport request schemas, with message, event, and reply contracts.
- `aiChatInstructions`, `aiChatMessages`: assistant instructions and provider-bound messages with document context and host outcomes.
- `aiTextLimits`: shared text limits.
- `aiProviders`: provider defaults, connections, accounts, and result types.

`@nesso-how/ai/providers` exposes connection schemas and types without loading tool schemas. See [src/index.ts](src/index.ts) and [src/providers.ts](src/providers.ts) for all exports.
