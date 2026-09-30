# nesso-min

A minimal, light-only knowledge graph app for connecting concepts with directed relations.

## Run

```sh
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
```

## Architecture

One core graph, owned by the host store, with plugins extending it.

- `@nesso/schema` — core graph model, JSON-LD profile, and validation.
- `src/` — host: owns the single graph and its store, materializes the visible graph (`viewGraph`), registers plugins.
- `@nesso/plugin` — types-only plugin contract.
- `@nesso/vocab` — default vocabulary plugin.
- `@nesso/graph` — React Flow renderer plugin.
- `@nesso/export` — action plugin exporting the visible graph as JSON-LD.
