# nesso-min

A minimal, light-only knowledge graph app for connecting concepts with directed relations.

## Run

```sh
pnpm install
pnpm dev
```

Build and checks: `pnpm build`, `pnpm lint`, `pnpm test`.

For macOS:

- `pnpm desktop` — build and run the desktop app.
- Development: run `pnpm dev --host 127.0.0.1 --strictPort` and `pnpm desktop:dev` in separate terminals.
- `pnpm dist:mac` — build Apple Silicon and Intel DMGs in `release/`.
- Push a `v*` version tag to publish both DMGs on GitHub Releases.

DMGs are not signed or notarized; Gatekeeper may block downloaded apps.

## Usage

- **Concepts** are the graph's nodes, connected by directed, typed **relations**.
- **Views** are named subsets of the same graph, not copies. Complete graph always contains every concept; removing a concept from a view does not delete it.
- **Vocabularies** provide relation types; users can also name their own.

Use the Explorer to navigate views, the canvas to build the graph, and the Inspector to edit the selection and its memberships. The visible graph can be exported as JSON-LD.

The document and app preferences, including collapsed sections, are saved locally and automatically. There is no cross-device sync; local storage is not a backup. This is pre-alpha software, and stored formats may change without migrations.

## Architecture

- **Host (`src/`)** owns the app shell, the shared store, persistence, and static plugin registration. The store separates graph data, workspace navigation/views, and app preferences, and supplies the visible graph to renderers.
- **Schema (`packages/schema/`)** defines and validates graph data and handles JSON-LD serialization.
- **Plugin contract (`packages/plugin/`)** defines readonly state and contributions. Plugins interact with the host through an injected store, never through app internals.
- **Translations (`packages/i18n/`)** wrap i18next with typed translation keys and isolated instances. Host and plugins own their JSON catalogs; the host persists the locale preference.
- **UI and theme (`packages/ui/`, `plugins/theme/`)** provide shared Base UI-backed controls, semantic styles, Kernel tokens, and bundled fonts. The host applies the theme; renderers consume its CSS tokens.
- **Plugins (`plugins/graph/`, `plugins/vocab/`, `plugins/export/`)** contribute the React Flow canvas, relation vocabularies, and export actions. Renderer-specific components and styles stay inside their plugin.
- **Desktop (`electron/`)** wraps the same app in Electron for macOS.
