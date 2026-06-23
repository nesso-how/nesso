# Mentor (Socrates)

`MentorPanel.tsx` is the AI chat component. The mentor is **experimental** and has a **single transport**: an OpenAI-compatible **`POST …/chat/completions`** via `fetch`. Base URL, model, and optional API key come from `aiBaseUrl`, `aiModel`, `aiApiKey`; there is no environment-variable fallback for the key, and there is **no built-in in-browser model** (the old WebGPU/`@mlc-ai/web-llm` path was removed — too small and slow to be useful).

Readiness is `isAiReady(settings)` (truthy `aiBaseUrl` + `aiModel`) in `src/llm/completion.ts`. When not ready, `MentorPanel` shows a short setup hint (`t.mentor.needsSetup`) and disables the input until an endpoint is configured. The default points at a local Ollama instance (`http://localhost:11434/v1`, `gemma3:4b`).

## Setup

Configure under **Settings** (gear, **⌘,**): **Appearance**, **Learning**, **AI**. The **Learning** tab opens with a **Review** group: a _Review mode_ toggle (on by default, `reviewEnabled`) plus the FSRS _Target retention_ / _Max interval_ settings, shown only while review is on (these drive the full-screen review overlay).

## Persona

Socrates is a Socratic mentor: mostly questions, almost no lecturing. Rules live in **`getMentorBase()`** inside `MentorPanel.tsx`:

- No graph edits in dialogue (do not propose new nodes/edges or renames).
- Default one short question; explain only to frame it; aim under ~180 words. This is a **soft** target enforced by the prompt; the hard ceiling `MENTOR_MAX_TOKENS` (≈ 2048) only caps output and leaves headroom for reasoning models (e.g. qwen3 thinking) to think and still answer.
- No emojis or flattery; sparse `*asterisks*` on key terms; no JSON or pseudo-graph markup.
- No em dash (U+2014) in replies; use commas, periods, or short sentences instead.
- English **legend** decodes FSRS-shaped node tokens in the snapshot (`(new)`, `s=…d`, days since review, Again/Hard/Good/Easy, `DUE`); reply language stays separate (`Respond in Italian.` when UI is Italian).

## System prompt (single chat)

There are **no mode tabs**. `buildGraphChatPrompt()` builds one system string: graph snapshot — up to `MAX_SNAPSHOT_NODES` nodes tagged with stability, days since last review, FSRS rating, optional DUE (`nodeDesc`), sorted weakest-first via **`nodeStrength()`** (`src/llm/context.ts`; stability‑first with Again/Hard and light overdue tweaks), remainder summarized if larger), up to `MAX_SNAPSHOT_EDGES` edges (`2×` the node cap by default), optional selection (node or full edge path), optional **`Focus:` / `Related:`** lines from **`buildFocalNeighborContext()`** in `src/llm/context.ts` when a node is selected — plus **`getMentorBase()`**. Each send recomputes the prompt from the live store so new edits appear on the next turn.

On panel open, graph switch, AI-endpoint-readiness change, or **`chatKey`** bump (header refresh), the first mentor line is fetched using a short synthetic **user** turn from **`buildMentorSeedText()`**: wording depends on whether a **node**, an **edge only**, or **nothing** is selected.

## Rendering

Assistant replies render as plain text with subtle emphasis via **`renderWithEmphasis()`** in `emphasis.tsx` (`*asterisks*` → `<em>`). User-authored bubbles remain plain text in a `<span>`.

## Selection vs history

`history` remains local component state. The opening synthetic user message reflects **`selectedNode` / `selectedEdge`** via **`buildMentorSeedText()`**; subsequent turns still rebuild `buildGraphChatPrompt()` from the live selection on each send.

## Panel open/closed

Whether the mentor **sheet** is open is `mentorPanelExpanded` on `useGraphStore`, updated via `setMentorPanelExpanded`. It is persisted with the rest of UI chrome (`zustand` `persist` → localStorage). The entry point is the **Socrates button in the `StatusBar`** (no floating FAB); the sheet slides up above the status bar and dodges the docked inspector via `leftInset`/`rightInset` props.

## Message history

`history: Message[]` is local to `MentorPanel` (not in the store). It resets when the panel opens again, the graph changes, AI-endpoint readiness changes during the opening sequence, or the user clicks **New chat** (refresh). Do not persist chat history to the store.

## API call

Completions go through **`fetchCompletion()`** in `src/llm/completion.ts`. Pass an optional `AbortSignal`; abort on panel close or graph switch.

`fetchCompletion` posts to `${aiBaseUrl}/chat/completions` with JSON body:

- `model` — `settings.aiModel`
- `max_tokens` — `MENTOR_MAX_TOKENS` (~2048; a ceiling, not a target — reply length is soft-capped at ~180 words by the prompt, with headroom for reasoning-model thinking)
- `messages` — `[{ role: 'system', content: buildGraphChatPrompt() }, …]` plus full `history` turns mapped to `user` / `assistant` roles.

`Authorization: Bearer …` is sent when `settings.aiApiKey` is non-empty.
