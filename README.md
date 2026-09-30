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

## Architecture

One core graph, owned by the host store, with plugins extending it.

- `@nesso/schema` — core graph model, JSON-LD profile, and validation.
- `src/` — host: owns the single graph and its store, materializes the visible graph (`viewGraph`), registers plugins.
- `@nesso/plugin` — types-only plugin contract.
- `@nesso/vocab` — default vocabulary plugin.
- `@nesso/graph` — React Flow renderer plugin.
- `@nesso/export` — action plugin exporting the visible graph as JSON-LD.
