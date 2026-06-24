# @nesso-how/graph

Embeddable Nesso knowledge graph React component, built on [React Flow](https://reactflow.dev). Read-only by default; enable drag, connect, and selection when you need an interactive canvas.

## Install

```bash
npm install @nesso-how/graph @xyflow/react react react-dom
```

`@xyflow/react`, `react`, and `react-dom` are peer dependencies — match the ranges in this package's `peerDependencies`.

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

Pass a full `NessoGraphDocument` (from `@nesso-how/vocab-learning`) via `graph` instead of separate `nodes`/`edges`:

```tsx
import { deserialize } from '@nesso-how/vocab-learning'

const doc = deserialize(json)
;<NessoGraph graph={doc} style={{ width: '100%', height: 400 }} />
```

Or build React Flow props yourself with `documentToRenderGraph(doc)` when you need the raw `nodes`/`edges` arrays.

`nodes`/`edges` render read-only by default — no drag, connect, or selection. Default `nodeTypes`/`edgeTypes` use `ConceptNode` and `NessoEdge` from this package (display settings via `GraphDisplayContext`).

Pass `display`/`palette` to control categories, glyphs, and curves. Use `categoryColorMode: 'css'` when `--cat-*` CSS variables are set on the page (the main app); embeds default to `palette` (hex from `PALETTES` in `@nesso-how/vocab-learning`). Optional `getRelationLabel` and `isItemSelected` customize labels and selection. Pass any other [`ReactFlow`](https://reactflow.dev/api-reference/react-flow) prop through `reactFlowProps`.

Full guide: [Embedding graphs](https://nesso.how/docs/guides/embedding-graphs/).

### Interactivity

Turn on `nodesDraggable`/`nodesConnectable`/`elementsSelectable` as needed. How you provide nodes determines who owns their state:

- `nodes`/`edges` — _controlled_: you own the state and must also pass `onNodesChange`/`onEdgesChange`/`onConnect` to apply updates (e.g. the main app, where positions live in its own store).
- `defaultNodes`/`defaultEdges` — _uncontrolled_: React Flow seeds its internal state once and manages drag/connect/selection itself — no wiring needed, the right choice for decorative or one-off embeds.

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
