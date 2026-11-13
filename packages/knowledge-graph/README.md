# @nesso-how/knowledge-graph

Trusted Canvas 2D renderer showing the complete graph in the Overview, when no saved view is active.

## Usage

Render `KnowledgeGraph` with an injected `NessoStore`, a host-owned `KnowledgeGraphLayout` cache, and `focusRef`. Concepts are bubbles sized by their number of relations and joined by straight directed lines, laid out by a d3-force simulation. Initial positions derive from concept IDs; the layout settles before the first frame, is cached in the given map for the session, and is never persisted. Theme tokens and fonts are inherited from the host.

## Controls

- Click a bubble or line to select it; Shift-, Ctrl-, or Cmd-click toggles it. Click the background to clear the selection; Shift-drag on the background adds the bubbles inside the rectangle to it. Selected concepts dim everything except their neighbors and show the relation types of their lines; hovering a bubble or line shows the relation types of those lines without dimming.
- Drag a bubble to pull the layout; it settles again on release. Drag the background to pan, scroll to zoom, and press F or the fit button to fit the graph. Labels and their backgrounds shrink when zooming out and stop growing at natural size: 12 CSS pixels for concepts and 11 for relations, including on hover and selection. At distant zoom levels, only selected, hovered, and selection-neighbor concept labels remain visible.
- Undo and Redo buttons step through document history; they are hidden when `readOnly` is set.
- Double-click a bubble to ask the host to open it through `onOpen(id, point)`.
- Delete or Backspace removes selected concepts and relations from the graph through the host, after confirmation when a concept appears in a saved view.

Selection goes through the injected store, so the host's inspector, deletion rule, and shortcuts apply unchanged. Control and accessible labels use local English, Italian, and Simplified Chinese catalogs; concept labels and relation types are displayed unchanged.

## API

- `KnowledgeGraph({ store, layout, readOnly?, focusRef?, onOpen?, ref? })`: renders the overview. `ref` exposes `focusConcept(id)` to center a concept. See [src/index.tsx](src/index.tsx).
- `settle(graph, layout)` and `viewPositions(layout, ids)` from `@nesso-how/knowledge-graph/layout`: compute the cached layout without rendering, and scale cached positions to seed a new saved view. See [src/layout.ts](src/layout.ts).
- `renderKnowledgeGraphImage({ state, layout, theme, scale?, signal })` from `@nesso-how/knowledge-graph/image`: returns `{ mediaType: 'image/png', base64 }` of the settled overview, within the same pixel and byte budgets as view images. See [src/image.ts](src/image.ts).
