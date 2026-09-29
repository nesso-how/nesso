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

## Graph

Concepts have labels, tags, and positions. Relations have stable IRIs; new
connections use `linksTo` and appear unlabeled. Choose an existing relation
type or name a new one in the Inspector. The canvas shows the focused concept
and its direct neighbors; selecting an item does not change focus.

`data/sample-graph.json` is the self-contained JSON-LD starting graph. Edits
stay in memory and reset on reload. `@nesso/schema` defines the in-memory graph
and JSON-LD conversion; `@nesso/vocab` supplies the default relation types.
React Flow structures are derived in the app for rendering.
