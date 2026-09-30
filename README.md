# nesso-min

A minimal, light-only knowledge graph app for connecting concepts with directed relations.

## Run (browser)

```sh
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
```

## macOS

- `pnpm desktop` — build and run the desktop app.
- Development: run `pnpm dev --host 127.0.0.1 --strictPort` and `pnpm desktop:dev` in separate terminals.
- `pnpm dist:mac` — build Apple Silicon and Intel DMGs in `release/`.
- Push a `v*` version tag to publish both DMGs on GitHub Releases.

DMGs are not signed or notarized; Gatekeeper may block downloaded apps.

## Usage

The first graph starts from `src/data/seed-graph.json`. Edits, navigation, tag filters, and panel sizes are saved automatically in this browser, without cross-device sync.

The hamburger menu offers Export (the visible graph; choose All concepts for the whole graph) and Reset graph. Reset asks for confirmation, then starts a fresh graph with one concept, retaining app preferences.

Storage failures show a warning and preserve existing saved data; editing remains available in memory. Browser storage is not a backup.
