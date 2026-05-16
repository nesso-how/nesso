---
title: Getting started
description: How to run Nesso locally or on the web.
---

Nesso runs as a **web app** or a **macOS desktop app** (via Tauri). The quickest way to try it is at [nesso.how](https://nesso.how) — no install needed.

## Web app

Open [nesso.how](https://nesso.how) in your browser. Everything is stored locally in IndexedDB; nothing leaves your machine unless you configure an external AI endpoint.

## Desktop app (macOS)

Pre-built alpha installers for Apple silicon and Intel are published on [GitHub Releases](https://github.com/cedoor/nesso/releases). Download the `.dmg` for your architecture and open it.

## Run from source

Requires [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/).

```sh
git clone https://github.com/cedoor/nesso.git
cd nesso
pnpm install
pnpm dev
```

## Configuring the AI mentor

Nesso talks to any **OpenAI-compatible** `chat/completions` endpoint. The default is a local [Ollama](https://ollama.com/) instance at `http://localhost:11434/v1`.

Pull a model first:

```sh
ollama pull gemma3:4b
```

Then open **Settings** (gear icon or `⌘,` / `Ctrl+,`) to change the endpoint, model name, or API key.

> Any API key is stored in the browser's `localStorage`. Do not deploy Nesso publicly with secrets embedded.

For a cloud provider, set the base URL to your provider's endpoint (e.g. `https://api.openai.com/v1`) and enter your key in the API key field.

## Desktop build from source

Requires [Rust](https://rustup.rs/) in addition to the web dependencies.

```sh
pnpm build:desktop
```
