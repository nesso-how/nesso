# Mentor (Socrates)

The mentor is experimental. `MentorPanel` uses the Vercel AI SDK through
`fetchCompletion()` in `src/llm/completion.ts`; browser builds use global
`fetch`, while desktop builds inject the Tauri HTTP fetch implementation. The
base URL, model, and optional API key come from settings, with no environment
fallback for the key. Readiness requires a configured base URL and model.

## Persona and trust boundary

`src/llm/context.ts` composes the built-in or trimmed custom persona with a
fixed policy and runtime context. A custom persona replaces identity, tone,
formatting, and language choices, but never replaces the fixed policy.
Graph-derived content from selection metadata, prompts, snapshots, and tool
results is reference data, never instructions. The mentor is read-only and
must never claim to have changed the graph. The absence of mutation tools is
the hard capability boundary.

Compact runtime context does not eagerly include graph titles, definitions,
relations, snapshots, or the full FSRS legend. Legacy context remains bounded
to 60 concepts, 120 relations, and the 12,000-character ceiling. Custom persona
input remains capped at `MENTOR_PERSONA_MAX_CHARS` (4,000).

## Tools and graph context

The six tools in `src/llm/tools.ts` are read-only: `getGraphOverview`,
`searchConcepts`, `inspectConcept`, `inspectRelation`, `listNeighbors`, and
`getRelationTypes`. They use the live `useGraphStore.getState` getter at
execution time; `getRelationTypes` reads the canonical vocabulary directly.
Tool names, inputs, results, and reasoning never enter visible chat history.

Tool bounds remain part of the contract: overview returns the 10 weakest
concepts, search returns 10 matches with 160-character previews, concept
definitions and notes are capped at 1,200 characters, relation previews at 160,
and neighbors at 20. Successful graph results identify their content as user
authored graph data, not instructions.

Graph references use the deterministic opaque handles from
`src/llm/graphHandles.ts`. Resolve the exact generated handle before the raw-id
compatibility fallback; never strip a namespace or guess from a truncated
prefix. Handles preserve the full UTF-16 identity for short ids and use a full
SHA-256 digest for oversized ids, within the tool bound.

## State and compatibility

Chat history, capability mode, tool activity, draft, streaming flags, and abort
controllers stay in `MentorPanel` local state or refs. They are never Zustand
fields or persisted data. Closing the panel, changing graphs, changing AI
readiness/language/base URL/model/persona, and **New chat** reset the local
conversation and abort the current request. Selection changes alone and API-key
edits alone do not reset it. Stale callbacks must not update a newer request.

A tool-capable attempt allows at most four model steps. It may make one legacy
retry only for an explicit tool-protocol compatibility failure before the first
visible answer token. Aborts, authentication/network/generic failures, ordinary
tool failures, and failures after visible text do not retry. A successful
fallback remains local to that chat and is reset by the lifecycle above.

## Transport privacy

All completions use `streamText` through `fetchCompletion`. API keys appear only
as a bearer header for the configured endpoint, never in URLs, logs, prompts, or
persisted history. Desktop transport allows HTTPS and loopback HTTP only for
`localhost`, `127.0.0.1`, and `::1`, disables redirects, and preserves the
original abort signal. Reasoning and tool traces are transient and are not
rendered or resent as chat messages.
