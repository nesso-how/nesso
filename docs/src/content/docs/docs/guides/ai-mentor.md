---
title: AI mentor (Socrates)
description: Use the Socratic mentor with a local or hosted OpenAI-compatible model.
---

The AI mentor is **experimental** and **off by default**. Enable it under **Settings → AI** with the **Mentor** toggle. While it is off, **Socrates** is hidden from the status bar.

When enabled, click **Socrates** in the bottom-left status bar. Socrates probes your understanding with focused questions. It can read your graph, but it cannot edit it.

:::note
For good results, use at least a 7–8B instruction-following model. `qwen3:14b` is a strong local choice; use a larger model if your hardware or hosted provider allows it.
:::

## How graph context works

When a chat opens, Nesso tells the mentor what is selected:

- a selected concept contributes its title;
- a selected relation contributes both endpoint titles and the relation type;
- no selection asks the mentor where to focus.

Nesso does not send the whole graph by default. A compatible model can request bounded, read-only graph details as it needs them. Those reads use the current graph, so they can reflect edits you make during a turn. Tool activity is transient: Nesso does not show tool inputs or results in chat, log them, persist them, or resend them after the turn.

The mentor's visible chat history lives only in the open panel session. Chat history and compatibility fallback mode reset when you switch graphs, reopen the panel, click **New chat**, change the UI language, base URL, model, or custom system prompt, or when AI readiness changes, such as when the configured mentor becomes available or unavailable. Changing only the API key does not reset the chat. Changing the selection alone does not reset existing history; the current selection is captured with each request.

### Compatibility fallback

If an endpoint rejects graph-reading tools before producing an answer, Nesso retries that turn once with a bounded, weakest-first graph snapshot of up to 60 concepts and 120 relations. The same built-in or custom persona and read-only limits remain active. After a successful retry, that chat continues in fallback mode until one of the reset actions above starts a fresh chat.

This fallback can send more graph content than the normal on-demand mode. It never adds graph-editing capabilities.

## Connecting a model

Under **Settings → AI**, configure an OpenAI-compatible `chat/completions` base URL, model, optional API key, and optional **Custom system prompt**. These fields appear only while **Mentor** is enabled.

The default is local [Ollama](https://ollama.com/) at `http://localhost:11434/v1` with model `gemma3:4b`. Local Ollama normally needs no API key.

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

**Settings → AI → Custom system prompt** replaces Socrates' built-in identity, tone, goals, Socratic guidance, and reply-language instruction. Nesso trims the value and uses at most 4,000 characters. Leave it empty or whitespace-only to restore the built-in persona.

A custom prompt does not add graph-editing capabilities. Nesso remains read-only and continues to treat graph-derived text as data rather than instructions.

## What leaves your device

With local Ollama, mentor requests stay between Nesso and the local service on your machine.

With a remote endpoint, Nesso sends the mentor prompt, visible chat history, graph counts, the captured selection, and the selected title or relation details used to open the chat. Additional graph fields are sent only when the model requests them. A compatibility fallback may instead send the bounded graph snapshot described above. The configured API key is sent only to that endpoint as a bearer token.

When Socrates inspects a concept, its rich notes are flattened and bounded to at most **1,200 characters** before they are added to the tool result. With a remote model, that excerpt may leave your device and the provider may retain it under its own policy. Choose local Ollama, or avoid storing sensitive text in graph notes, when that matters.

Nesso does not persist mentor chat history or tool traces. A remote provider receives request content and may retain it under its own policy, so check the provider's terms before sending a private graph.
