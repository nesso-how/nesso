---
title: AI mentor (Socrates)
description: How the Socratic mentor works, connecting a model, persona, and graph-aware context.
---

The Socratic mentor is **experimental** and **off by default**. Enable it under **Settings → AI** with the **Mentor** toggle. While off, **Socrates** is hidden from the status bar.

When enabled, click **Socrates** in the **status bar** (bottom-left) to start a dialogue. The mentor reads your current graph and selection, and replies with **questions rather than explanations**. The goal is to surface what you understand and where the gaps are.

:::note
For good results, use at least a 7–8B model. `qwen3:14b` is a strong default; `llama3.3:70b` for higher quality if your hardware allows. For hosted endpoints, model names change fast, so pick any capable instruction-following model from your preferred provider.
:::

## How it works

Each turn starts with a compact system prompt. It contains the Socratic persona, an FSRS legend, concept and relation counts, and the selection captured when the turn started as its `kind` and stable `id` (or `none`). The visible conversation history is sent as the turn's messages. On opening, the synthetic user turn also includes the selected concept title, or the selected edge's endpoint titles and relation type. Definitions, full nodes, and full edges are not eagerly placed in this normal context.

A tool-capable model can request one of six bounded, read-only queries. The graph queries execute against the current live graph, so they can reflect edits made while a turn is running. Relation-type results come from Nesso's built-in vocabulary:

| Query               | What it can read                                 | Bound                                  |
| ------------------- | ------------------------------------------------ | -------------------------------------- |
| Overview            | Counts and the weakest concepts by FSRS strength | 10 concepts                            |
| Title search        | Title matches with short definition previews     | 10 matches, 160 characters per preview |
| Concept inspection  | One concept, its definition, and review memory   | 1,200 characters for the definition    |
| Relation inspection | One directed relation and endpoint summaries     | One relation, 160-character previews   |
| Neighbours          | One-hop incoming and outgoing relations          | 20 relations, 160-character previews   |
| Relation types      | The built-in Nesso vocabulary                    | 52 definitions                         |

The queries cannot edit your graph. They return user-authored graph data as context, not as instructions. A normal attempt can use at most four model steps. If compatibility fallback is needed, Nesso makes a second attempt with its own four-step limit, for up to eight total model steps for that turn. A model may also answer in plain text without requesting a tool.

While a query runs, the mentor shows one localized transient status such as **Reviewing graph…**, **Searching concepts…**, or **Reading concept…**. Nesso does not render the tool input or result, log it, persist it, or resend it after the turn. The status disappears when the answer starts or the turn ends.

Within Nesso, chat history is **not persisted**. It lives only for the current panel session. Chat history resets when you:

- switch graphs;
- reopen the panel;
- click **New chat**;
- change the UI language;
- change the base URL; or
- change the model.

The tool-capability mode resets on those same triggers. Clicking the panel's close button also aborts the active turn and clears its compatibility mode; reopening it starts a fresh chat and opener. Disabling and re-enabling **Mentor** follows the same fresh-reopen behavior.

An API-key-only edit does **not** reset the chat or tool-capability mode. It updates endpoint checks and later requests without starting a new conversation.

### Tool compatibility fallback

If any classified tool-compatibility failure occurs before visible answer text, Nesso retries that turn once with a legacy prompt. This includes SDK `NoSuchToolError` and `InvalidToolInputError`, plus a narrow set of HTTP `400`, `404`, or `422` endpoint responses that explicitly reject one of the `tools`, `functions`, `tool_calls`, `tool_choice`, or `function_call` fields, or the tool/function calling capability. A network failure, authentication error, generic server error, ordinary tool execution error, abort, or failure after answer text starts does not trigger the retry.

After a successful retry, the current chat stays in legacy mode. Any of the reset triggers above restores tool mode. Legacy mode is a compatibility path, not the normal context: it sends a weakest-first snapshot of up to 60 concepts and 120 relations, with selected and focal context included only when it fits the final 12,000-character prompt budget.

## Connecting a model

Configure any OpenAI-compatible `chat/completions` endpoint under **Settings → AI**: base URL, model, and an optional API key. Endpoint fields appear only while the mentor toggle is on.

The desktop app uses Tauri's native HTTP client for mentor requests. It supports any `https://` endpoint, including hosted providers such as OpenCode Zen at `https://opencode.ai/zen/v1` with model `big-pickle`. It also supports loopback HTTP endpoints at `localhost`, `127.0.0.1`, and `::1` for local Ollama. Arbitrary non-loopback `http://` endpoints are not permitted by the desktop capability.

The browser app keeps using the browser's normal `fetch`. Hosted endpoints must allow the app's origin, and browser requests to local Ollama still need the Ollama CORS setting described below. Nesso sends an optional API key as `Authorization: Bearer …` only to the configured endpoint and does not log it.

The default targets a local [Ollama](https://ollama.com/) instance (`http://localhost:11434/v1`, model `gemma3:4b`). Install Ollama, pull a model, and the mentor works with nothing leaving your machine. Set the API key expected by a hosted endpoint when one is required.

Until a reachable endpoint is configured, the chat input stays disabled and the mentor shows a short setup hint. If the mentor stops responding once a turn fails, see [Troubleshooting](../../troubleshooting/#mentor-not-responding).

### Endpoint status

While the AI tab is open in **Settings**, Nesso calls the `/models` endpoint of your configured base URL and shows the result inline:

| Status                | Meaning                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| **Checking…**         | Nesso is querying `/models` — shows a spinner until the first response arrives.                    |
| **Available**         | The model is present in the endpoint's model list. The mentor can start.                           |
| **Not found locally** | The endpoint is reachable but the model is not installed. On localhost, a **Pull** button appears. |
| **Pulling `NN`%**     | A native Ollama pull is in progress for the current model (local endpoints only).                  |
| **Unauthorized**      | The endpoint returned HTTP `401` or `403` — wrong or missing API key.                              |
| **API unreachable**   | The endpoint did not respond (wrong URL, server down, or network failure).                         |

The status resets to idle when the dialog closes or the mentor toggle is turned off. Changing the base URL, model, or API key triggers a fresh check and cancels any in-flight pull.

### Pulling a model from Ollama

When the endpoint is a `localhost`-based Ollama instance and the model is **Not found locally**, click **Pull** to download it. Progress is streamed in real time, and the status switches to **Available** on success. If the pull fails mid-way, the status shows **API unreachable**.

Pulls are local-only: the pull button appears only for loopback URLs (`localhost`, `127.0.0.1`, `::1`) because it calls the Ollama-native `/api/pull` endpoint. For hosted providers, pull models through their own tools or dashboard.

Closing the **Settings** dialog, disabling the **Mentor** toggle, or changing the model while a pull is running aborts it immediately.

### Reaching local Ollama from the hosted app

If you use the hosted web app over HTTPS, requests to `http://localhost:11434` are allowed by the browser, but Ollama still rejects the cross-origin request unless you allow the app's origin. Start it with `OLLAMA_ORIGINS=https://app.nesso.how` or use the desktop build, whose native transport does not require this browser CORS setting.

## The Socratic persona

The shared persona and prompt composition in [`context.ts`](https://github.com/nesso-how/nesso/blob/main/src/llm/context.ts) shape Socrates. The graph query definitions live in [`tools.ts`](https://github.com/nesso-how/nesso/blob/main/src/llm/tools.ts). Socrates follows these rules:

- One short question per turn by default, explaining only enough to frame it.
- Replies aim under ~180 words, with a `2,048`-token output ceiling.
- No graph edits proposed in dialogue. Socrates probes; the user edits.
- No emojis, flattery, JSON, or pseudo-graph markup. Sparse `*asterisks*` on key terms.
- Replies in the active UI language (English or Italian). FSRS values returned by tools use stable labels such as `stability`, `difficulty`, `state`, `lastRating`, and `isDue`.

If you want a more permissive coach, fork the persona. It is plain text in `context.ts` and easy to swap.

## Opening message

When the panel opens, the mentor sends itself a short synthetic **user** turn so its first message reflects what's selected:

- **A concept node selected:** includes that concept's title in the seed turn. A tool-capable model can inspect it and optionally list its neighbours.
- **An edge selected (no node):** includes both endpoint titles and the typed relation in the seed turn. A tool-capable model can inspect the relation.
- **Nothing selected:** asks where to focus. A tool-capable model can request `getGraphOverview`, whose weakest-first results use stability and review state as context.

With graph tools available, a selected concept can guide `inspectConcept` or `listNeighbors`, and a selected relation can guide `inspectRelation`. The opening turn does not receive an eager full graph dump. If the model answers without a tool call, that plain-text answer is still valid.

Click **New chat** in the header to reset history and request a fresh opener.

## What leaves your device

With a local Ollama endpoint, mentor prompts, chat history, and any graph data returned by a query stay on your machine. With a remote endpoint, Nesso sends the compact prompt, including counts and selection metadata, visible text history, and the opening seed's selected title or edge endpoints and type. Graph fields returned by tools are sent only when requested. A compatibility fallback may instead send the bounded legacy snapshot. The configured API key is sent only as a bearer token to that endpoint. Within Nesso, tool traces and chat history are not retained, but a remote provider may retain request content under its own policy, so check that provider's terms.
