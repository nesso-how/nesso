# @nesso/concept-map

React Flow renderer plugin: canvas, node/edge views, and adapters rendering the host-provided `viewGraph`.

## Usage

Register `conceptMapPlugin` using the [plugin guide](../../packages/plugin/README.md#register-it). The host displays the renderer for the active saved view or complete graph.

## Controls

- Hold Shift, Ctrl, or Cmd to add items to the selection. Ctrl/Cmd+A selects the visible graph; Escape clears selection. Drag selected concepts together.
- **Add concept** creates a concept near a single selected concept, linked with the active vocabulary's default type. Otherwise it starts disconnected at the viewport center. New concepts join the active view.
- **Delete**, Delete, or Backspace removes selected items, but cannot remove the last concept.
- Select a single concept to create a relation, or a single relation to reconnect it. Reconnection preserves the relation type; self-connections and duplicates are rejected.
- **Undo** and **Redo** control shared document history, including saved-view edits, not only the selection.
- Right-click the background, a concept, a relation, or a selected group for contextual graph actions. A selected target keeps the group; an unselected target replaces the selection. Background clicks keep the selection, and **Add concept** places the new concept at the clicked point. Shift+F10 or the context-menu key opens the menu for the focused item. Escape closes the menu without clearing selection.
- The background menu has no deletion action, and relation menus have no concept creation action. Undo and redo remain in the toolbar, not in context menus.
- Fit the view or lock canvas gestures with the canvas controls; double-click the background to add a concept.

Canvas controls and accessibility messages use local English/Italian catalogs through `@nesso/i18n`. The renderer subscribes to the injected store's locale preference; concept labels and relation types are displayed unchanged.

Context menus use the shared `MenuPopup` and `MenuItem` primitives from `@nesso/ui`; graph-specific actions and selection stay in the renderer.

## API

- `conceptMapPlugin`: declared operations and a factory binding the injected store to its renderer instance. See [src/index.tsx](src/index.tsx).
