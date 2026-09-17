---
title: AI mentor (Socrates)
description: Use the Socratic mentor with a local or hosted OpenAI-compatible model.
---

The AI mentor is **experimental** and **off by default**. Enable it under **Settings → AI** with the **Mentor** toggle. While it is off, **Socrates** is hidden from the status bar.

When enabled, click **Socrates** in the bottom-left status bar. Socrates helps you build understanding of your graph, explaining clearly and asking a focused question when it moves learning forward. It can read your graph, but it cannot edit it.

:::note
For good results, use at least a 7–8B instruction-following model with tool calling.
A Qwen3.5-9B-class model is the recommended local choice; use a larger model if
your hardware or hosted provider allows it.
:::

## How graph context works

When a chat opens, Nesso sends one fixed, graph-free request and the captured selection handle. Socrates inspects the selection with read-only tools (a selected concept via `inspectConcept`, a selected relation via `inspectRelation`) or starts with `getGraphOverview` when nothing is selected. Titles, definitions, and relation details arrive only through bounded tool results.

Nesso does not send the whole graph by default. A compatible model can request bounded, read-only graph details as it needs them. Those reads use the current graph, so they can reflect edits you make during a turn. Tool activity is transient: Nesso does not show tool inputs or results in chat, log them, persist them, or resend them after the turn.

The mentor's visible chat history lives only in the open panel session. Chat history resets when you switch graphs, reopen the panel, click **New chat**, change the UI language, base URL, model, or custom system prompt, or when AI readiness changes, such as when the configured mentor becomes available or unavailable. Changing only the API key does not reset the chat. Changing the selection alone does not reset existing history; the current selection is captured with each request.

:::caution
Socrates requires a tool-capable endpoint (for example `qwen3.5:9b`). If an endpoint rejects graph-reading tools, that turn fails once through the normal error path; there is no snapshot fallback.
:::

## Connecting a model

Under **Settings → AI**, configure an OpenAI-compatible `chat/completions` base URL, model, optional API key, and optional **Custom system prompt**. These fields appear only while **Mentor** is enabled.

For a local model, point Nesso at an OpenAI-compatible endpoint: local [Ollama](https://ollama.com/) at `http://localhost:11434/v1` (for example with model `qwen3.5:9b`), LM Studio, or a llama-server/Unsloth direct server. Local endpoints normally need no API key. A context of 8–16k covers typical mentor traffic on 24GB-class machines; raise it for very large graphs or long chats, at the cost of speed and memory.

The desktop app accepts hosted `https://` endpoints and loopback HTTP at `localhost`, `127.0.0.1`, or `::1`. It rejects arbitrary non-loopback `http://` endpoints. The browser app uses normal browser networking, so the endpoint must allow the app's origin. Nesso sends a configured API key only as a bearer token to that endpoint and does not log it.

Until the endpoint is reachable and the model is available, the chat input stays disabled and Socrates shows a setup hint. See [Troubleshooting](../../troubleshooting/#mentor-not-responding) if a configured mentor stops responding.

### Endpoint status

While **Settings → AI** is open, Nesso checks the endpoint's model list:

| Status                | Meaning                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| **Checking…**         | Nesso is querying the endpoint.                                                                    |
| **Available**         | The configured model is available.                                                                 |
| **Not found locally** | The endpoint is reachable but the model is missing. On loopback Ollama, a **Pull** button appears. |
| **Pulling `NN`%**     | Ollama is downloading the selected model.                                                          |
| **Unauthorized**      | The endpoint rejected the API key.                                                                 |
| **API unreachable**   | The endpoint did not respond.                                                                      |

Changing the base URL, model, or API key starts a new status check. Closing Settings or disabling **Mentor** cancels an in-progress Ollama pull.

### Reaching local Ollama from the hosted app

The hosted web app can call `http://localhost:11434`, but Ollama must allow the app's origin. Start Ollama with `OLLAMA_ORIGINS=https://app.nesso.how`, or use the desktop build, which does not need browser CORS permission.

## Customising Socrates

Built-in Socrates replies in the active UI language, English or Italian.

**Settings → AI → Custom system prompt** replaces Socrates' built-in identity, tone, goals, and style. Nesso trims the value and uses at most 4,000 characters. Leave it empty or whitespace-only to restore the built-in persona. Reply language follows the UI language unless the custom prompt specifies otherwise.

A custom prompt does not add graph-editing capabilities. Nesso remains read-only and continues to treat graph-derived text as data rather than instructions.

## What leaves your device

With local Ollama, mentor requests stay between Nesso and the local service on your machine.

With a remote endpoint, Nesso sends the mentor prompt, visible chat history, graph counts, and the captured selection handle. Additional graph fields are sent only when the model requests them through tools. There is no snapshot fallback; a tool-incompatible endpoint fails once through the normal error path. The configured API key is sent only to that endpoint as a bearer token.

When Socrates inspects a concept, its rich notes are flattened and bounded to at most **1,200 characters** before they are added to the tool result. With a remote model, that excerpt may leave your device and the provider may retain it under its own policy. Choose local Ollama, or avoid storing sensitive text in graph notes, when that matters.

Nesso does not persist mentor chat history or tool traces. A remote provider receives request content and may retain it under its own policy, so check the provider's terms before sending a private graph.
