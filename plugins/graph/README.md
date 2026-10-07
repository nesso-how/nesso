# @nesso/graph

React Flow renderer plugin: canvas, node/edge views, and adapters rendering the host-provided `viewGraph`.

## Usage

Register `graphPlugin` using the [plugin guide](../../packages/plugin/README.md#register-it). The host displays the renderer for the active saved view or complete graph.

## Controls

- Hold Shift, Ctrl, or Cmd to add items to the selection. Ctrl/Cmd+A selects the visible graph; Escape clears selection. Drag selected concepts together.
- **Add concept** creates a concept near a single selected concept, linked with the active vocabulary's default type. Otherwise it starts disconnected at the viewport center. New concepts join the active view.
- **Delete selected**, Delete, or Backspace removes selected items, but cannot remove the last concept.
- Select a single concept to create a relation, or a single relation to reconnect it. Reconnection preserves the relation type; self-connections and duplicates are rejected.
- **Undo** and **Redo** control shared document history, including saved-view edits, not only the selection.
- Fit the view or lock canvas gestures with the canvas controls; double-click zooms.

Canvas controls and accessibility messages use local English/Italian catalogs through `@nesso/i18n`. The renderer subscribes to the injected store's locale preference; concept labels and relation types are displayed unchanged.

## API

- `graphPlugin`: declared operations and a factory binding the injected store to its renderer instance. See [src/index.tsx](src/index.tsx).
