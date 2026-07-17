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

Every send rebuilds a system prompt from the live store: a snapshot of up to ~60 concept nodes, sorted weakest-first via **`nodeStrength()`** ([`context.ts`](https://github.com/nesso-how/nesso/blob/main/src/llm/context.ts)): **FSRS stability** dominates ordering, **Again/Hard** nudge weaker items up, overdue is only a slight tie-break. Each node line lists stability (`s=` days), days since last review, last FSRS rating, and `DUE` when the scheduler says so, plus typed edges (~2× the node allowance), current selection when any, and focal-neighbour context when a node is selected (`Focus:` / `Related:` lines). The conversation history stays in the mentor card and is reset when you switch graphs or click **New chat**.

Chat history is **not persisted**. It lives only for the current panel session.

## Connecting a model

Configure any OpenAI-compatible `chat/completions` endpoint under **Settings → AI**: base URL, model, and an optional API key. Endpoint fields appear only while the mentor toggle is on.

The desktop app uses Tauri's native HTTP client for mentor requests. It supports any `https://` endpoint, including hosted providers such as OpenCode Zen at `https://opencode.ai/zen/v1` with model `big-pickle`. It also supports loopback HTTP endpoints at `localhost`, `127.0.0.1`, and `::1` for local Ollama. Arbitrary non-loopback `http://` endpoints are not permitted by the desktop capability.

The browser app keeps using the browser's normal `fetch`. Hosted endpoints must allow the app's origin, and browser requests to local Ollama still need the Ollama CORS setting described below. Nesso sends an optional API key as `Authorization: Bearer …` only to the configured endpoint and does not log it.

The default targets a local [Ollama](https://ollama.com/) instance (`http://localhost:11434/v1`, model `gemma3:4b`). Install Ollama, pull a model, and the mentor works with nothing leaving your machine. Set the API key expected by a hosted endpoint when one is required.

Until a reachable endpoint is configured, the chat input stays disabled and the mentor shows a short setup hint. If the mentor stops responding once a turn fails, see [Troubleshooting](../../troubleshooting/#mentor-not-responding).

### Reaching local Ollama from the hosted app

If you use the hosted web app over HTTPS, requests to `http://localhost:11434` are allowed by the browser, but Ollama still rejects the cross-origin request unless you allow the app's origin. Start it with `OLLAMA_ORIGINS=https://app.nesso.how` or use the desktop build, whose native transport does not require this browser CORS setting.

## The Socratic persona

The system prompt (`getMentorBase` in [`MentorPanel.tsx`](https://github.com/nesso-how/nesso/blob/main/src/components/mentor/MentorPanel.tsx)) shapes Socrates:

- One short question per turn by default, explaining only enough to frame it.
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

Large graphs are summarised, not truncated abruptly. The weakest-reviewed nodes appear first (`nodeStrength`), so the verbatim slice emphasises instability and risky last ratings; tail nodes are omitted with a short count only. Edges have a ~2x allowance over node count. These limits live in [`MentorPanel.tsx`](https://github.com/nesso-how/nesso/blob/main/src/components/mentor/MentorPanel.tsx) as `MAX_SNAPSHOT_NODES` and `MAX_SNAPSHOT_EDGES`.
