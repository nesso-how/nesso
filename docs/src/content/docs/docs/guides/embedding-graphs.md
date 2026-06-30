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

Pass a `NessoGraphDocument` via `graph`, the same JSON you export from the app or build with the MCP server:

<!-- prettier-ignore -->
```tsx
import { NessoGraph } from '@nesso-how/graph';
import '@xyflow/react/dist/style.css';

<NessoGraph graph={doc} style={{ width: '100%', height: 400 }} />
```

By default the graph renders read-only (no drag, connect, or selection) using the same category colors, glyphs, and edge encoding as the app.

## Display options

`display` controls how edges and categories are drawn:

```tsx
<NessoGraph
  graph={doc}
  display={{ edgeEncoding: 'full', curveStyle: 'straight', showHeatmap: false }}
/>
```

FSRS review fields are not in the file, so embeds show an empty heatmap unless you merge review state yourself.

## Interactivity

`nodesDraggable`, `nodesConnectable`, and `elementsSelectable` are all `false`/read-only by default, so turn on what you need.

Decorative embeds in a scrollable page (e.g. a landing hero) should turn off wheel zoom and drag pan so the page keeps scrolling over the canvas:

```tsx
<NessoGraph
  graph={doc}
  panOnDrag={false}
  zoomOnScroll={false}
  style={{ width: '100%', height: 400 }}
/>
```

`NessoGraph` sets React Flow's `preventScrolling` from those flags: when neither `zoomOnScroll` nor `panOnScroll` consumes the wheel, page scroll is not blocked. Override with `reactFlowProps.preventScrolling` if you need different behaviour.

For fully controlled maps where you manage node positions in your own state, pass `nodes`/`edges` with `onNodesChange`/`onEdgesChange` instead of `graph`:

<!-- prettier-ignore -->
```tsx
<NessoGraph
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
/>
```

## Escape hatch

Any [`ReactFlow`](https://reactflow.dev/api-reference/react-flow) prop not listed above can be passed through `reactFlowProps`, for example to hide the attribution badge or disable double-click-to-zoom:

```tsx
<NessoGraph
  graph={doc}
  reactFlowProps={{ proOptions: { hideAttribution: true }, zoomOnDoubleClick: false }}
/>
```
