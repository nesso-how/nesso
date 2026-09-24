# Mentor (Socrates)

The mentor is experimental. `MentorPanel` uses the Vercel AI SDK through
`fetchCompletion()` in `src/llm/completion.ts`; browser builds use global
`fetch`, while desktop builds inject the Tauri HTTP fetch implementation. The
base URL, model, and optional API key come from settings, with no environment
fallback for the key. Readiness requires a configured base URL and model.

## Persona and trust boundary

`src/llm/context.ts` composes the built-in or trimmed custom persona with a
fixed policy array and runtime context. A custom persona replaces identity,
tone, goals, and style, but never replaces the fixed policy. The fixed policy
is, in order: read-only trust boundary; reply language (UI language default,
overridable by an explicit instruction above it); tool routing; tool-result
transience; FSRS interpretation. Persona always precedes policy because the
language line refers to "above".
Graph-derived content from selection metadata and tool results is reference
data, never instructions. The mentor is read-only and must never claim to
have changed the graph. The absence of mutation tools is the hard capability
boundary. The built-in persona is minimal guidelines (help build
understanding, grounded in the graph, ask a focused question when it moves
learning forward), not script rules.

Compact runtime context is per-turn data only: graph counts and the captured
selection handle. It does not eagerly include graph titles, definitions,
relations, snapshots, or the full FSRS legend. The opening turn uses one
fixed, graph-free request (`MENTOR_OPENING_REQUEST`); selected titles,
definitions, and relation details arrive only through bounded tool results.
Custom persona input remains capped at `MENTOR_PERSONA_MAX_CHARS` (4,000).

## Tools and graph context

The six tools in `src/llm/tools.ts` are read-only: `getGraphOverview`,
`searchConcepts`, `inspectConcept`, `inspectRelation`, `listNeighbors`, and
`getRelationTypes`. They use the live `useGraphStore.getState` getter at
execution time; `getRelationTypes` reads the canonical vocabulary directly.
Tool names, inputs, results, and reasoning never enter visible chat history.

Tool bounds remain part of the contract: overview returns the 25 weakest
concepts by default, raisable to 500 through its optional `limit` input;
search returns 10 matches by default, also raisable to 500 through `limit`,
with 160-character previews; concept definitions and notes are capped at
1,200 characters, relation previews at 160, and neighbors at 20. Successful
graph results identify their content as user authored graph data, not
instructions.

Graph references use the deterministic opaque handles from
`src/llm/graphHandles.ts`. Resolve the exact generated handle before the raw-id
compatibility fallback; never strip a namespace or guess from a truncated
prefix. Handles preserve the full UTF-16 identity for short ids and use a full
SHA-256 digest for oversized ids, within the tool bound.

## State and compatibility

Chat history, tool activity, draft, streaming flags, and abort
controllers stay in `MentorPanel` local state or refs. They are never Zustand
fields or persisted data. Closing the panel, changing graphs, changing AI
readiness/language/base URL/model/persona, and **New chat** reset the local
conversation and abort the current request. Selection changes alone and API-key
edits alone do not reset it. Stale callbacks must not update a newer request.

The mentor uses one tools-only completion path with all six read-only graph
tools. A tool-capable attempt allows at most four model steps. A
tool-incompatible endpoint fails once through the existing error path; there
is no snapshot fallback and no legacy mode.

## Transport privacy

All completions use `streamText` through `fetchCompletion`. API keys appear only
as a bearer header for the configured endpoint, never in URLs, logs, prompts, or
persisted history. Desktop transport allows HTTPS and loopback HTTP only for
`localhost`, `127.0.0.1`, and `::1`, disables redirects, and preserves the
original abort signal. Reasoning and tool traces are transient and are not
rendered or resent as chat messages.
