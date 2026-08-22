---
title: FAQ
description: Common conceptual questions about privacy, the web/desktop split, and the AI mentor.
---

## Is my data private?

Graph content (concepts, definitions, relation structure) is stored locally: graph records use IndexedDB on the web, while the desktop app writes the shared graph document as plain `.json` files in the active project folder and mirrors it in IndexedDB. FSRS review progress (stability, ratings, due dates) remains in a separate IndexedDB `reviewState` store on both platforms and is not written to those desktop JSON files. Nesso does not upload graph data for storage or synchronisation. The AI mentor is an explicit exception when you use a remote endpoint.

The only things that can leave your device:

- **AI mentor prompts and chat history**, if you enable the mentor with a remote endpoint. Requests include the compact prompt's FSRS legend, graph counts, selected kind and stable ID, and visible text history. The opening synthetic turn includes the selected concept title or selected edge endpoint titles and relation type. Tool-returned graph fields are sent only when requested. A compatibility fallback may send the bounded snapshot instead. A local Ollama endpoint sends this data only to the local service on your machine.
- **Transient tool activity** is not added to the chat. Within Nesso, tool inputs and results are not rendered, logged, persisted, or resent after the turn. A remote provider receives request content while completing it and may retain it under that provider's policy.
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
