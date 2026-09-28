# nesso-min

A minimal knowledge graph: connect concepts with optionally labeled relations,
and keep the interface as small as possible.

## Stack

- [Vite](https://vite.dev) + React + TypeScript
- [shadcn/ui](https://ui.shadcn.com) on Base UI primitives + Tailwind CSS v4
- [@xyflow/react](https://reactflow.dev) for the graph canvas
- [zustand](https://zustand.docs.pmnd.rs) as the single graph store

## Layout

Sidebar (tag groups or AND-filtered concepts) · Navbar (focused concept, add
concept) · Canvas (one-hop neighborhood, zoom, pan, drag to connect) ·
Inspector (edit selection, or the focused concept).

## Commands

```sh
pnpm install
pnpm dev      # start dev server
pnpm build    # type-check and build
pnpm lint     # oxlint
```

## Model

Concepts are nodes; relations are directed edges with free-text labels. New
edges start unlabeled and can be named in the Inspector.

`data/sample-graph.json` provides the starting graph. Every concept can have
multiple tags; clicking one in the sidebar makes it the focus. The canvas shows
its direct neighbors in either direction, while selecting a node or edge does
not change the focus. Edits stay in memory and reset on reload.
New concepts are linked to the focus with an unlabeled edge, so they remain
visible in its one-hop view.
