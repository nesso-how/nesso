# @nesso/graph

React Flow renderer plugin: canvas, node/edge views, and adapters rendering the host-provided `viewGraph`.

## Usage

Add `graphPlugin` to the static plugin list in `src/plugins.ts`; the host renders its renderer when active (saved view or complete graph). The canvas offers `Add concept` (+) and `Delete selected` (trash, enabled only with a selection) as one horizontal control group top right; double-click zooms.

New concepts appear near the selected concept using the injected store's `conceptPlacementOffset`, constrained to the visible canvas with a 24px margin; without a selected concept, they appear at the viewport center. Placement accounts for pan, zoom, node dimensions, and the Inspector opening without reframing the graph.

The canvas restores `workspace.viewports.graph` on mount and records the viewport at the end of pan/zoom gestures. Switching views fits the new scope; membership edits and pinning do not reframe it.

Nodes fit their single-line labels with a 120px minimum width and 50px height. Native measurements are retained during drag and used to choose facing borders. Only the selected node shows its creation handle; a native target handle covers each node during a connection. Hidden side handles attach native Bézier edges. The dashed preview shares the final edge's facing-side geometry and native Bézier renderer, ending at the pointer until a target is found. React Flow owns connection gestures, edge labels/hit areas, fit/lock controls, and the zoom readout. Self-connections and duplicate default relations are rejected.

Selected edges show native reconnect handles while editing is unlocked. Dragging either endpoint preserves the relation type and follows the same preview geometry; invalid or empty drops leave the original relation unchanged.

## API

- `graphPlugin`: operation declaration and factory binding the injected `NessoStore` to its renderer instance.
