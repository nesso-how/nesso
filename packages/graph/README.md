# @nesso-how/graph

Embeddable Nesso knowledge graph React component, built on [React Flow](https://reactflow.dev). Read-only by default; enable drag, connect, and selection when you need an interactive canvas.

## Install

```bash
npm install @nesso-how/graph @xyflow/react react react-dom
```

`@xyflow/react`, `react`, and `react-dom` are peer dependencies — match the ranges in this package's `peerDependencies`.

## Usage

Pass a `NessoGraphDocument` via `graph`, the same JSON you export from the app or build with the MCP server:

```tsx
import { NessoGraph } from '@nesso-how/graph'
import '@xyflow/react/dist/style.css'
;<NessoGraph graph={doc} style={{ width: '100%', height: 400 }} />
```

For fully controlled maps where you manage node positions in your own state, pass `nodes`/`edges` with `onNodesChange`/`onEdgesChange` instead:

```tsx
;<NessoGraph
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  style={{ width: '100%', height: 400 }}
/>
```

Or build React Flow props yourself with `documentToRenderGraph(doc)` when you need the raw `nodes`/`edges` arrays.

`NessoGraph` renders read-only by default — no drag, connect, or selection. Default `nodeTypes`/`edgeTypes` use `ConceptNode` and `NessoEdge` from this package (display settings via `GraphDisplayContext`).

Pass `display`/`palette` to control categories, glyphs, and curves. Use `categoryColorMode: 'css'` when `--cat-*` CSS variables are set on the page (the main app); embeds default to `palette` (hex from `PALETTES` in `@nesso-how/vocab-learning`). Optional `getRelationLabel` and `isItemSelected` customize labels and selection. Pass any other [`ReactFlow`](https://reactflow.dev/api-reference/react-flow) prop through `reactFlowProps`.

Full guide: [Embedding graphs](https://nesso.how/docs/guides/embedding-graphs/).

### Interactivity

Turn on `nodesDraggable`/`nodesConnectable`/`elementsSelectable` as needed.

When `zoomOnScroll` is off (typical for decorative embeds in a scrollable page), `NessoGraph` sets `preventScrolling` to false so the page keeps scrolling over the canvas. Override via `reactFlowProps.preventScrolling` if needed.

## License

MIT
