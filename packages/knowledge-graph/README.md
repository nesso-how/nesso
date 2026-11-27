# @nesso-how/knowledge-graph

A trusted Canvas 2D renderer that shows the complete graph when no map is active.

## Usage

Render `KnowledgeGraph` with an injected `NessoStore`, a host-owned `KnowledgeGraphLayout` cache, and `focusRef`. Concepts appear as bubbles sized by their number of relations and joined by straight directed lines, laid out by a d3-force simulation. Initial positions derive from concept IDs, and a concept added later starts beside a neighbor that is already placed. The larger the share of new concepts, the more energy the simulation restarts with. The simulation settles across frames, showing bubbles as they move. With reduced motion it draws only the settled layout, and without a saved viewport it refits the view once settled unless you moved it. The host's `KnowledgeGraphLayout` cache keeps positions and remaining energy for the session without ever persisting them, so a Graph closed mid-settle resumes where it stopped. Theme tokens and fonts are inherited from the host.

## Controls

See [Explore the graph](../../docs/guide.md#explore-the-graph) for selection, navigation, and opening a concept on a map (`read_docs` topic: `guide`). Double-click hands map navigation to the host through `onOpen(id, point)`.

Selection goes through the injected store, so the host's inspector, deletion rule, and shortcuts apply unchanged. Control and accessible labels use local English, Italian, and Simplified Chinese catalogs, while concept labels and relation types are displayed unchanged.

## API

- `KnowledgeGraph({ store, layout, readOnly?, focusRef?, onOpen?, ref? })`: renders the graph. `ref` exposes `focusConcept(id)`, which centers a concept. See [src/index.tsx](src/index.tsx).
- `settle(graph, layout)` and `mapPositions(layout, ids)` from `@nesso-how/knowledge-graph/layout`: `settle` completes the cached layout synchronously without rendering, and `mapPositions` scales cached positions to seed a new map. See [src/layout.ts](src/layout.ts).
- `renderKnowledgeGraphImage({ state, layout, theme, scale?, signal })` from `@nesso-how/knowledge-graph/image`: returns a canvas of the settled graph, using the same pixel budget as map images. See [src/image.ts](src/image.ts).
