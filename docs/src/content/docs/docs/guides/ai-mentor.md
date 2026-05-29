---
title: AI mentor (Socrates)
description: How the Socratic mentor works, local vs remote, persona, and graph-aware context.
---

:::caution
This is the part of Nesso with the most potential and the most room to grow. Small models tend to drift out of the Socratic role and start explaining rather than questioning. A larger remote model works noticeably better. Improving the mentor is where most of the future work is headed.
:::

Click the **Socrates** bubble in the bottom-right of the canvas to start a dialogue. The mentor reads your current graph and selection, and replies with **questions rather than explanations**. The goal is to surface what you understand and where the gaps are.

## How it works

Every send rebuilds a system prompt from the live store: a snapshot of up to ~60 concept nodes, sorted weakest-first via **`nodeStrength()`** ([`context.ts`](https://github.com/cedoor/nesso/blob/main/src/llm/context.ts)): **FSRS stability** dominates ordering, **Again/Hard** nudge weaker items up, overdue is only a slight tie-break. Each node line lists stability (`s=` days), days since last review, last FSRS rating, and `DUE` when the scheduler says so, plus typed edges (~2× the node allowance), current selection when any, and focal-neighbour context when a node is selected (`Focus:` / `Related:` lines). The conversation history stays in the mentor card and is reset when you switch graphs or click **New chat**.

Chat history is **not persisted**. It lives only for the current panel session.

## Local vs remote

Configure under **Settings -> AI**:

- **Local model (default):** Qwen2.5 1.5B (~1.1 GB, q4f16 quantised) runs entirely in the browser via WebGPU using [WebLLM](https://github.com/mlc-ai/web-llm). First run prompts a one-off download; subsequent loads use the cached weights in IndexedDB. Nothing leaves your device.
- **Remote API:** any OpenAI-compatible `chat/completions` endpoint. Set base URL, model, and (optionally) API key. Defaults work with a local [Ollama](https://ollama.com/) instance at `http://localhost:11434/v1`.

The toggle is live: switching modes takes effect on the next message.

### When local mode is unavailable

If your browser does not support WebGPU, or the weights haven't been downloaded yet, the chat input stays disabled and the mentor card shows a short status line. Click **Download & use** in **Settings -> AI** to fetch the model, or switch to Remote API mode.

## The Socratic persona

The system prompt (`getMentorBase` in [`MentorBubble.tsx`](https://github.com/cedoor/nesso/blob/main/src/components/MentorBubble.tsx)) shapes Socrates:

- One short question per turn by default; explain only enough to frame the question.
- Replies are soft-capped at ~200 words (hard cap via output tokens).
- No graph edits proposed in dialogue. Socrates probes; the user edits.
- No emojis, flattery, JSON, or pseudo-graph markup. Sparse `*asterisks*` on key terms.
- Replies in the active UI language (English or Italian). Snapshot tokens stay **English-shaped** (`s=…d`, `…d since review`, etc.), with the same spelling in the legend for every locale.

If you want a more permissive coach, fork the persona. It is plain text in the component and easy to swap.

## Opening message

When the panel opens, the mentor sends itself a short synthetic **user** turn so its first message reflects what's selected:

- **A concept node selected:** opens on that concept and one of its relations.
- **An edge selected (no node):** opens on the typed relation between its endpoints.
- **Nothing selected:** opens on a weak spot in the graph (low stability plus weak **last reviews** (Again/Hard or a long gap); **DUE** is extra scheduler context).

Click **New chat** in the header to reset history and request a fresh opener.

## Context size

Large graphs are summarised, not truncated abruptly. The weakest-reviewed nodes appear first (`nodeStrength`), so the verbatim slice emphasises instability and risky last ratings; tail nodes are omitted with a short count only. Edges have a ~2x allowance over node count. These limits live in [`MentorBubble.tsx`](https://github.com/cedoor/nesso/blob/main/src/components/MentorBubble.tsx) as `MAX_SNAPSHOT_NODES` and `MAX_SNAPSHOT_EDGES`.

## Privacy

- **Local mode:** every byte stays in the browser. Graph data, prompts, responses, and model weights are all client-side.
- **Remote mode:** the system prompt (graph snapshot) and chat history are sent to whichever endpoint you configured, each turn. If that is a hosted provider, the usual provider-side logging applies.
