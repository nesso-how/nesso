---
title: Getting started
description: How to run Nesso locally or on the web.
---

Nesso is available as a hosted web app, a macOS desktop app, and as open-source code you can run locally. All data is stored in your browser or on your machine; nothing is sent to external servers unless you configure a remote AI endpoint.

## Web app

Open [app.nesso.how](https://app.nesso.how) in your browser. The app works offline after the first load. Use Chrome, Edge, Arc, or any other browser with **WebGPU** if you want to run the AI mentor locally; for the remote API mode any modern browser is fine.

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

For a desktop build, [Rust](https://rustup.rs/) is required as well:

```sh
pnpm build:desktop
```

## Picking an AI backend

The Socratic mentor uses an LLM. Choose under **Settings -> AI**:

- **Local model (default):** Qwen2.5 1.5B runs entirely in the browser via WebGPU (powered by [WebLLM](https://github.com/mlc-ai/web-llm)). The first run downloads ~1.1 GB and caches it; subsequent loads are instant. Nothing leaves your machine.
- **Remote API:** any OpenAI-compatible `chat/completions` endpoint: local [Ollama](https://ollama.com/) at `http://localhost:11434/v1`, an OpenAI-compatible proxy, or a hosted provider. Set base URL, model, and API key if needed.

Either mode can be switched at any time from **Settings** (`⌘,` / `Ctrl+,`).

> API keys are stored client-side in `localStorage`. Do not self-host the web app publicly with secrets baked in.

### Local mode tips

- WebGPU is required. On macOS, recent Chrome / Edge / Arc work out of the box; Safari support is improving but currently limited.
- The first download streams progress into the Settings panel. Closing the panel does not cancel the download.
- **Settings -> Data -> Delete** clears graphs and preferences but leaves the cached model untouched. Clearing browser site data removes everything, including the model weights.

### Remote mode with Ollama

Run Ollama locally, then pull a small instruction-tuned model:

```sh
ollama pull gemma3:4b
```

In **Settings -> AI**, choose **Remote API** and set:

- Base URL: `http://localhost:11434/v1`
- Model: `gemma3:4b` (or `llama3.2:3b`, `qwen2.5:7b`; presets are shown in Settings)
- API key: leave empty

Settings auto-probes the endpoint and offers a **Pull** button if the model is missing.

## Keyboard shortcuts

| Shortcut               | Action                         |
| ---------------------- | ------------------------------ |
| `?`                    | Show shortcuts dialog          |
| `⌘,` / `Ctrl+,`        | Settings                       |
| `⌘K` / `Ctrl+K`        | Search concepts                |
| `N`                    | Add concept at viewport centre |
| `R`                    | Open review mode               |
| `⌘Z` / `Ctrl+Z`        | Undo                           |
| `⌘⇧Z` / `Ctrl+Shift+Z` | Redo                           |
| `Del` / `Backspace`    | Delete selection               |
| `↑` `↓` `←` `→`        | Nudge selected concept         |
| `Shift` + arrows       | Nudge selected concept (large) |
| `Esc`                  | Close dialog                   |

Hold `⌘` / `Ctrl` to add to a selection; drag on empty canvas to marquee-select.
