---
title: AI mentor (Socrates)
description: How the Socratic mentor works, connecting a model, persona, and graph-aware context.
---

The Socratic mentor is **experimental** and **off by default**. Enable it under **Settings → AI** with the **Mentor** toggle (marked _Experimental_). While off, **Socrates** is hidden from the status bar.

When enabled, click **Socrates** in the **status bar** (bottom-left) to start a dialogue. The mentor reads your current graph and selection, and replies with **questions rather than explanations**. The goal is to surface what you understand and where the gaps are.

## How it works

Every send rebuilds a system prompt from the live store: a snapshot of up to ~60 concept nodes, sorted weakest-first via **`nodeStrength()`** ([`context.ts`](https://github.com/nesso-how/nesso/blob/main/src/llm/context.ts)): **FSRS stability** dominates ordering, **Again/Hard** nudge weaker items up, overdue is only a slight tie-break. Each node line lists stability (`s=` days), days since last review, last FSRS rating, and `DUE` when the scheduler says so, plus typed edges (~2× the node allowance), current selection when any, and focal-neighbour context when a node is selected (`Focus:` / `Related:` lines). The conversation history stays in the mentor card and is reset when you switch graphs or click **New chat**.

Chat history is **not persisted**. It lives only for the current panel session.

## Connecting a model

Configure any OpenAI-compatible `chat/completions` endpoint under **Settings → AI**: base URL, model, and an optional API key. Endpoint fields appear only while the mentor toggle is on.

The default targets a local [Ollama](https://ollama.com/) instance (`http://localhost:11434/v1`, model `gemma3:4b`). Install Ollama, pull a model, and the mentor works with nothing leaving your machine. Any hosted OpenAI-compatible endpoint works too; set the API key it expects.

Until a reachable endpoint is configured, the chat input stays disabled and the mentor shows a short setup hint.

### Reaching local Ollama from the hosted app

If you use the hosted web app over HTTPS, requests to `http://localhost:11434` are allowed (localhost is exempt from mixed-content blocking), but Ollama still rejects the cross-origin request unless you allow the app's origin: start it with `OLLAMA_ORIGINS=https://app.nesso.how` (or run the desktop build, where this does not apply).

## The Socratic persona

The system prompt (`getMentorBase` in [`MentorPanel.tsx`](https://github.com/nesso-how/nesso/blob/main/src/components/mentor/MentorPanel.tsx)) shapes Socrates:

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

Large graphs are summarised, not truncated abruptly. The weakest-reviewed nodes appear first (`nodeStrength`), so the verbatim slice emphasises instability and risky last ratings; tail nodes are omitted with a short count only. Edges have a ~2x allowance over node count. These limits live in [`MentorPanel.tsx`](https://github.com/nesso-how/nesso/blob/main/src/components/mentor/MentorPanel.tsx) as `MAX_SNAPSHOT_NODES` and `MAX_SNAPSHOT_EDGES`.

## Privacy

- **Local Ollama:** prompts and responses go only to your own machine; nothing leaves the device.
- **Hosted endpoint:** the system prompt (graph snapshot) and chat history are sent to whichever endpoint you configured, each turn. The usual provider-side logging applies.

Your graph itself always stays on your device regardless of the endpoint.
