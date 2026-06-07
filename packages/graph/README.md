# @nesso-how/graph

Embeddable read-only Nesso knowledge graph React component, built on [React Flow](https://reactflow.dev).

## Install

```bash
npm install @nesso-how/graph
```

## Usage

```tsx
import { NessoGraph } from '@nesso-how/graph'
import '@xyflow/react/dist/style.css'
;<NessoGraph
  nodes={nodes}
  edges={edges}
  display={{ edgeEncoding: 'full', curveStyle: 'straight' }}
  style={{ width: '100%', height: 400 }}
/>
```

`nodes`/`edges` (or a full `graph: NessoGraphFile`) render read-only by default —
no drag, connect, or selection. Default `nodeTypes`/`edgeTypes` use `ConceptNode` and
`NessoEdge` from this package (display settings via `GraphDisplayContext`).

Pass `display`/`palette` to control categories, glyphs, and curves. Use
`categoryColorMode: 'css'` when `--cat-*` CSS variables are set on the page (the main
app); embeds default to `palette` (hex from `PALETTES`). Optional `getRelationLabel`
and `isItemSelected` customize labels and selection. Pass any other
[`ReactFlow`](https://reactflow.dev/api-reference/react-flow) prop through `reactFlowProps`.

### Interactivity

Turn on `nodesDraggable`/`nodesConnectable`/`elementsSelectable` as needed. How you
provide nodes determines who owns their state:

- `nodes`/`edges` — _controlled_: you own the state and must also pass
  `onNodesChange`/`onEdgesChange`/`onConnect` to apply updates (e.g. the main app,
  where positions live in its own store).
- `defaultNodes`/`defaultEdges` — _uncontrolled_: React Flow seeds its internal
  state once and manages drag/connect/selection itself — no wiring needed, the
  right choice for decorative or one-off embeds.

```tsx
<NessoGraph
  defaultNodes={nodes}
  defaultEdges={edges}
  nodesDraggable
  style={{ width: '100%', height: 400 }}
/>
```

## License

MIT
