# Mentor (Socrates)

`MentorPanel.tsx` is the AI chat component. The mentor is **experimental** and has a **single transport**: an OpenAI-compatible endpoint driven through the **Vercel AI SDK** (`ai` + `@ai-sdk/openai-compatible`) in `src/llm/completion.ts`. Base URL, model, and optional API key come from `aiBaseUrl`, `aiModel`, `aiApiKey`; there is no environment-variable fallback for the key.

Readiness is `isAiReady(settings)` (truthy `aiBaseUrl` + `aiModel`) in `src/llm/completion.ts`. The mentor UI mounts only when `settings.mentorEnabled` is true (`App.tsx`); when off, **Socrates** is hidden from the status bar and `mentorPanelExpanded` is forced closed. When enabled but not ready, `MentorPanel` shows a short setup hint (`t.mentor.needsSetup`) and disables the input until an endpoint is configured. The default points at a local Ollama instance (`http://localhost:11434/v1`, `gemma3:4b`).

## Setup

Configure under **Settings** (gear, **⌘,**): **Appearance**, **Learning**, **AI**, **Privacy**. The **Learning** tab opens with a **Review** group: a _Review mode_ toggle (on by default, `reviewEnabled`) plus the FSRS _Target retention_ / _Max interval_ settings, shown only while review is on (these drive the full-screen review overlay).

The **AI** tab opens with a **Mentor** group (marked _Experimental_): a _Mentor_ toggle (`mentorEnabled`, off by default) plus base URL, model, and API key fields shown only while it is on. Turning it off hides **Socrates** from the status bar and unmounts `MentorPanel`.

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

Assistant replies render as plain text with subtle emphasis via **`renderWithEmphasis()`** in `emphasis.tsx` (`*asterisks*` → `<em>`). User-authored bubbles remain plain text in a `<span>`. Extracted reasoning is not rendered as content: while `reasoning-delta` is streaming in and no answer text has started, `ThinkingIndicator`'s optional `label` prop shows `t.mentor.thinking` ("thinking…", lowercase, in the body font `var(--font-display)`) next to the loading bars instead of the plain dots. There is no expand affordance for the reasoning text itself yet.

## Selection vs history

`history` remains local component state. The opening synthetic user message reflects **`selectedNode` / `selectedEdge`** via **`buildMentorSeedText()`**; subsequent turns still rebuild `buildGraphChatPrompt()` from the live selection on each send.

## Panel open/closed

Whether the mentor **sheet** is open is `mentorPanelExpanded` on `useGraphStore`, updated via `setMentorPanelExpanded`. It is persisted with the rest of UI chrome (`zustand` `persist` → localStorage). When `mentorEnabled` is true, the entry point is the **Socrates button in the `StatusBar`** (no floating FAB); the sheet slides up above the status bar and dodges the docked inspector via `leftInset`/`rightInset` props. When `mentorEnabled` is false, the button and `MentorPanel` are not rendered.

## Message history

`history: Message[]` is local to `MentorPanel` (not in the store). It resets when the panel opens again, the graph changes, AI-endpoint readiness changes during the opening sequence, or the user clicks **New chat** (refresh). Do not persist chat history to the store.

## API call

Completions go through **`fetchCompletion()`** in `src/llm/completion.ts`, which calls the SDK's **`streamText`** against a model built by `createOpenAICompatible({ baseURL, apiKey }).chatModel(aiModel)`. It takes a `CompletionRequest` (`{ instructions?, messages }`) as its second argument, plus an optional `AbortSignal` (wired to `streamText`'s `abortSignal`); abort on panel close or graph switch.

- `model` — `settings.aiModel`; `apiKey` (→ `Authorization: Bearer …`) only when `settings.aiApiKey` is non-empty.
- `maxOutputTokens` — `MENTOR_MAX_TOKENS` (~2048; a ceiling, not a target — reply length is soft-capped at ~180 words by the prompt, with headroom for reasoning-model thinking)
- `instructions` — the system prompt (`buildGraphChatPrompt()`), passed to `streamText`'s `instructions` since the SDK rejects `system` roles inside `messages`.
- `messages` — the `history` turns mapped to `user` / `assistant` roles (`toConversation`).

The model is wrapped with **`extractReasoningMiddleware({ tagName: 'think' })`**, so inline `<think>…</think>` (Ollama qwen3, deepseek-r1, …) is split out of the answer. `fetchCompletion` iterates `result.stream` and routes `text-delta` parts to `onToken` and `reasoning-delta` parts to `onReasoning` (an `error` part is rethrown). `isNetworkFailure()` classifies a failure as connection vs HTTP response (`APICallError` without a `statusCode`, or a bare `TypeError`), and `describeCompletionError()` extracts the raw detail (HTTP status + endpoint response body) shown verbatim to the user.
