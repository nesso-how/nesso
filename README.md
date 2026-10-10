<div align="center">

<img src="public/logo.svg" alt="Nesso" width="350">

</br>
A second brain for connecting ideas and building understanding in one knowledge graph, with AI assistance. Built on a small core with a simple plugin system.
</br></br>

[![CI](https://github.com/nesso-how/nesso/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/nesso-how/nesso/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/nesso-how/nesso?include_prereleases)](https://github.com/nesso-how/nesso/releases)

[![Download desktop app](https://img.shields.io/badge/Download_desktop_app-nesso-393939)](https://github.com/nesso-how/nesso/releases)
[![Web demo (without AI)](https://img.shields.io/badge/Web_demo-without_AI-555)](https://app.nesso.how)
[![Website](https://img.shields.io/badge/Website-nesso.how-555)](https://nesso.how)
[![Discussions](https://img.shields.io/badge/Discussions-GitHub-555)](https://github.com/nesso-how/nesso/discussions)

</div>

> [!WARNING]
> This is pre-alpha software. Stored formats may change without migrations.
>
> Windows installers are currently unsigned and may trigger SmartScreen warnings.

## Install

Nesso is primarily a desktop app for **macOS, Windows, and Linux**. Download it from [nesso.how](https://nesso.how) or [GitHub releases](https://github.com/nesso-how/nesso/releases).

The [web demo](https://app.nesso.how) lets you try the graph editor in your browser, without AI assistance or the local MCP server.

## Usage

Your knowledge lives in one graph.

- **Concepts** represent ideas, connected by directed, typed **relations**.
- **Views** are named subsets of that graph.
- **Vocabularies** provide relation types. You can also name your own.
- **Plugins** provide the canvas, vocabularies, themes, and any actions on the current view.

Use the Explorer to navigate views, the canvas to build the graph, and the Inspector to edit the selection and its memberships.

### AI

In the desktop app, use **AI** with your own provider or a local model, or connect an external assistant through the local MCP server. Provider credentials are encrypted on your device, and chat requests go directly to the chosen endpoint. Graph edits are validated and undoable, with approvals handled inside Nesso.

- **OpenAI**: API key or ChatGPT sign-in (OAuth).
- **Anthropic, Gemini, OpenRouter**: API key.
- **OpenAI-compatible endpoints**: hosted or local models, with an optional API key.
- **External assistants**: connect through the local MCP server.

## Architecture

```mermaid
flowchart TD
  Host["Host (UI, store, persistence)"]
  Host --> Schema["@nesso/schema"]
  Host --> UI["@nesso/ui"]
  Host --> I18n["@nesso/i18n"]
  Host <-->|Injected store| Plugins["Plugins<br/>(renderers, vocabs, themes, actions"]
  Plugins --> I18n
  Host -.-> Contract["@nesso/plugin"]
  Plugins -.-> Contract
```

The host owns state, materializes `viewGraph`, and registers plugins statically. Plugins use the injected store, never host internals. Dashed arrows show the types-only contract.

| Package | Kind | Responsibility |
| --- | --- | --- |
| [`@nesso/schema`](packages/schema/README.md) | Core | Graph model, validation, and JSON-LD. |
| [`@nesso/plugin`](packages/plugin/README.md) | Core | Types-only plugin and store contract. |
| [`@nesso/i18n`](packages/i18n/README.md) | Core | i18next with typed keys, isolated translators, and English fallback. |
| [`@nesso/ui`](packages/ui/README.md) | Core | Shared React controls and styles. |
| [`@nesso/ai`](packages/ai/README.md) | Core | Shared chat and MCP tool contracts, policies, and assistant instructions. |
| [`@nesso/concept-map`](plugins/concept-map/README.md) | Plugin | React Flow canvas for the host-provided visible graph. |
| [`@nesso/base-vocab`](plugins/base-vocab/README.md) | Plugin | Default relation vocabulary. |
| [`@nesso/export`](plugins/export/README.md) | Plugin | Graph and view export as JSON-LD. |
| [`@nesso/import`](plugins/import/README.md) | Plugin | Merge a Nesso JSON-LD file into the current graph. |
| [`@nesso/kernel`](plugins/kernel/README.md) | Plugin | Kernel theme tokens and bundled fonts. |

## Development

Use Node.js 24 and the pnpm version specified in [`package.json`](package.json).

```sh
pnpm install
pnpm desktop
```

`pnpm desktop` builds and runs the desktop app. Use `pnpm dev` to run the web demo locally.

Build and checks: `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm analyze`.

Use `pnpm analyze --summary` for a compact Fallow report. Duplication and complexity are advisory.

For desktop development, run `pnpm dev --host 127.0.0.1 --strictPort` and `pnpm desktop:dev` in separate terminals.

For release instructions, run `pnpm release --help`.

### Create a plugin

Build your own renderers, vocabularies, actions, or themes.
See the [plugin guide](packages/plugin/README.md#create-a-plugin) to get started.

## License

[MIT](LICENSE) © 2026 Omar Desogus and Paolo Manfredotti.
