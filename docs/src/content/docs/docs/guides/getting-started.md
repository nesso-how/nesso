---
title: Getting started
description: How to run Nesso locally or on the web.
---

Nesso is available as a hosted web app, a macOS desktop app, and as open-source code you can run locally. All data is stored in your browser or on your machine; nothing is sent to external servers unless you configure a remote AI endpoint.

## Web app

Open [app.nesso.how](https://app.nesso.how) in your browser. The app works offline after the first load and runs in any modern browser. The AI mentor is optional and needs an OpenAI-compatible endpoint (see [Picking an AI backend](#picking-an-ai-backend)).

## First run

On a fresh install, Nesso opens with an empty **Tutorial** graph and walks you through the essentials:

1. **Welcome** — a short overview of typed knowledge graphs and spaced repetition.
2. **Guided tour** — coachmarks on the real UI: add and name concepts, add a definition in the inspector, connect two ideas with a typed relation, then open **Review**.
3. **Telemetry** (optional) — a one-time banner in the top-right asks whether to share anonymous usage events. Declining is remembered; you can change the choice anytime under **Settings → Privacy**.

You can skip the welcome screen or the tour at any step. Skipping removes the Tutorial graph and opens a demo seed map instead. Completing the tour keeps your Tutorial graph and also opens a demo seed map. To replay the tour later, open **⋯ → About Nesso** and choose **Show intro again**.

Demo seed graphs are no longer loaded automatically on first launch — you build your first graph during the tour.

## Desktop app (macOS)

A pre-built alpha installer is published on [GitHub Releases](https://github.com/nesso-how/nesso/releases). Download the universal `.dmg` — it runs on both Apple silicon and Intel Macs — and open it.

:::caution
The app is not signed with an Apple developer certificate. macOS will block it on first launch. After installing, run this command in the terminal to remove the quarantine flag:

```sh
xattr -cr /Applications/Nesso.app
```

Then open the app normally.
:::

The desktop app **updates itself**: on launch it checks GitHub Releases and, when a newer build is available, offers to install it and relaunch. Auto-updates begin once you are on a build that ships the updater (`v0.1.0-alpha.25` or later), so that first version still needs a one-time manual download.

## Run from source

Requires [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/).

```sh
git clone https://github.com/nesso-how/nesso.git
cd nesso
pnpm install
pnpm dev
```

For a desktop build, [Rust](https://rustup.rs/) is required as well:

```sh
pnpm build:desktop
```

## Picking an AI backend

The Socratic mentor is **experimental** and uses any OpenAI-compatible `chat/completions` endpoint: a local [Ollama](https://ollama.com/) instance, an OpenAI-compatible proxy, or a hosted provider. There is no built-in in-browser model, so configure an endpoint under **Settings -> AI** (`⌘,` / `Ctrl+,`) or the mentor stays disabled.

:::caution
API keys are stored client-side in `localStorage`. Do not self-host the web app publicly with secrets baked in.
:::

### Local setup with Ollama

Run [Ollama](https://ollama.com/) locally, then pull a small instruction-tuned model:

```sh
ollama pull gemma3:4b
```

In **Settings -> AI**, set:

- Base URL: `http://localhost:11434/v1`
- Model: `gemma3:4b` (or `llama3.2:3b`, `qwen3:8b`; presets are shown in Settings)
- API key: leave empty

Settings auto-probes the endpoint and offers a **Pull** button if the model is missing. Prompts and responses stay on your machine.

When using the hosted web app over HTTPS, allow its origin in Ollama so the browser request is not blocked by CORS: start Ollama with `OLLAMA_ORIGINS=https://app.nesso.how`. (Requests to `localhost` are exempt from mixed-content blocking, so only CORS needs configuring.)

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
| `⌘A` / `Ctrl+A`        | Select all                     |
| `⌘X` / `Ctrl+X`        | Cut selection                  |
| `⌘C` / `Ctrl+C`        | Copy selection                 |
| `⌘V` / `Ctrl+V`        | Paste                          |
| `↑` `↓` `←` `→`        | Nudge selected concept         |
| `Shift` + arrows       | Nudge selected concept (large) |
| `Esc`                  | Close dialog                   |

Hold `⌘` / `Ctrl` to add to a selection; drag on empty canvas to marquee-select.
