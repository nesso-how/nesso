---
title: FAQ
description: Common conceptual questions about privacy, the web/desktop split, and the AI mentor.
---

## Is my data private?

Graph content (concepts, definitions, examples, notes, relation structure) and review progress (FSRS stability, ratings, due dates) are stored locally, in IndexedDB on the web app or as plain JSON files on disk for the desktop app, and never leave your device. Mentor chat history lives only in memory for the current panel session, and AI endpoint API keys are stored locally and sent only to the endpoint you configured.

The only things that can leave your device:

- **AI mentor prompts and chat history**, if you enable the mentor with a remote endpoint. A local Ollama endpoint sends nothing off your machine.
- **Opt-in telemetry**, off by default.
- **The desktop app's version check** against GitHub Releases, a plain request that carries no graph or usage data.

## What changes between the web app and the desktop app?

| Area                  | Web                                        | Desktop                                                                                                                                              |
| --------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Graph storage         | IndexedDB only                             | Plain JSON files on disk (authoritative); IndexedDB mirrors the active project                                                                       |
| Projects              | Single implicit workspace, no switching    | Multiple named project folders: create, open, switch, remove                                                                                         |
| File import/export    | File System Access API or browser download | Native save/open dialogs                                                                                                                             |
| Native app menu       | None                                       | A real File/Edit/View/Window/Help menu bar                                                                                                           |
| Auto-update           | Not applicable                             | Checks GitHub Releases on launch, can install and relaunch                                                                                           |
| External file changes | Not applicable                             | A file watcher detects edits made outside the app (see [Troubleshooting](../troubleshooting/#this-graph-was-changed-on-disk-while-you-were-editing)) |

Everything else, the canvas, the Inspector, Review, and the AI mentor, works the same on both.

## Why does the AI mentor need an API key?

It doesn't, if you run a model locally. The default setup points at [Ollama](https://ollama.com/) on `http://localhost:11434/v1`, which needs no key. An API key is only required when you point the mentor at a hosted provider that authenticates requests (most OpenAI-compatible APIs); Nesso sends it as a bearer token to that endpoint only, never anywhere else. See [AI mentor](../guides/ai-mentor/#connecting-a-model).

## Where do I report a bug or request a feature?

Open an issue on [GitHub](https://github.com/nesso-how/nesso/issues). The code is MIT-licensed and contributions are welcome.
