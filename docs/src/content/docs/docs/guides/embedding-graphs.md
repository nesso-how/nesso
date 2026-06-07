---
title: Embedding graphs
description: Render Nesso knowledge graphs in your own React app with @nesso-how/graph.
---

The [`@nesso-how/graph`](https://www.npmjs.com/package/@nesso-how/graph) package is an embeddable React component for rendering Nesso knowledge graphs: the same visual style (categories, glyphs, edge curves) used by the app, available for docs, blog posts, or any React surface.

## Install

```bash
npm install @nesso-how/graph @xyflow/react react react-dom
```

`@xyflow/react`, `react`, and `react-dom` are peer dependencies. Install versions matching the ranges declared in the package's `peerDependencies`.

## Basic usage

```tsx
import { NessoGraph } from '@nesso-how/graph'
import '@xyflow/react/dist/style.css'
;<NessoGraph nodes={nodes} edges={edges} style={{ width: '100%', height: 400 }} />
```

By default the graph renders read-only (no drag, connect, or selection) using the same category colors, glyphs, and edge encoding as the app. Pass a full `NessoGraphFile` via `graph` instead of `nodes`/`edges` if you have one (e.g. a graph exported from the app as JSON).

## Display options

`display` controls how edges and categories are drawn:

```tsx
<NessoGraph
  nodes={nodes}
  edges={edges}
  display={{ edgeEncoding: 'full', curveStyle: 'straight', showHeatmap: false }}
/>
```

`palette` selects one of the category color palettes available in the app's settings. Embeds use hex colors from `PALETTES` (`categoryColorMode: 'palette'`, the default). Host apps that set `--cat-*` CSS variables (like Nesso itself) pass `categoryColorMode="css"`.

Optional `getRelationLabel` localizes edge labels; `isItemSelected` syncs selection with an external store.

## Interactivity

`nodesDraggable`, `nodesConnectable`, and `elementsSelectable` are all `false`/read-only by default, so turn on what you need. How you provide nodes determines who owns their state:

- **`nodes`/`edges`** (_controlled_): you own the state, so also pass `onNodesChange`/`onEdgesChange`/`onConnect` to apply the resulting changes (e.g. when positions live in your own store, like the main app does).
- **`defaultNodes`/`defaultEdges`** (_uncontrolled_): React Flow seeds its state once from these and manages drag, connect, and selection internally, with nothing else to wire up. The right choice for a self-contained embed.

```tsx
<NessoGraph
  defaultNodes={nodes}
  defaultEdges={edges}
  nodesDraggable
  style={{ width: '100%', height: 400 }}
/>
```

## Escape hatch

Any [`ReactFlow`](https://reactflow.dev/api-reference/react-flow) prop not listed above can be passed through `reactFlowProps`, for example to hide the attribution badge or disable double-click-to-zoom:

```tsx
<NessoGraph
  nodes={nodes}
  edges={edges}
  reactFlowProps={{ proOptions: { hideAttribution: true }, zoomOnDoubleClick: false }}
/>
```
