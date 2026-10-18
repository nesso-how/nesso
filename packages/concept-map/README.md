# @nesso/concept-map

Trusted React Flow renderer: canvas, node/edge views, and adapters rendering the host-provided `viewGraph`.

## Usage

The app imports `ConceptMap` directly into its React tree. Inject a store, notifications, and clipboard; the package never imports host internals. Store subscriptions use the injected instance, and commands commit synchronously through `applyOperations`. There is no plugin manifest, iframe, permission check, or snapshot transport. Intro uses the same component with its own store and read-only interactions.

## Controls

- Hold Shift, Ctrl, or Cmd to add items to the selection. Ctrl/Cmd+A selects the visible graph; Escape clears selection. Drag selected concepts together.
- Ctrl/Cmd+C, X, and V copy, cut, and paste selected concepts and relations, also available beside undo/redo and in context menus. Pasted concepts join the active view with labels, types, and layout preserved. Cut and paste are undoable; text fields keep native clipboard behavior.
- **Add concept** creates a concept near a single selected concept, linked with the active vocabulary's default type. Otherwise it starts disconnected at the viewport center. New concepts join the active view.
- **Delete**, Delete, or Backspace removes selected items. Selecting every visible concept requests the host's view-deletion confirmation; clearing the complete graph leaves one fresh concept and remains undoable. Cut never invokes that dialog or removes the last concept.
- Double-click a concept label to edit it inline. New concepts open their label editor automatically. Enter or blur commits, Escape cancels, and the host-supplied label limit bounds input.
- Select a single concept to create a relation, or a single relation to reconnect it. Reconnection preserves the relation type; self-connections and duplicates are rejected.
- **Undo** and **Redo** control shared document history, including saved-view edits, not only the selection.
- Right-click the background, a concept, a relation, or a selected group for contextual graph actions. A selected target keeps the group; an unselected target replaces the selection. Background clicks keep the selection, and **Add concept** places the new concept at the clicked point. Shift+F10 or the context-menu key opens the menu for the focused item. Escape closes the menu without clearing selection.
- The background menu has no deletion action, and relation menus have no concept creation action. Undo and redo remain in the toolbar, not in context menus.
- Fit the view or lock canvas gestures with the canvas controls; double-click the background to add a concept.

Canvas controls and accessibility messages use local English, Italian, and Simplified Chinese catalogs through `@nesso/i18n`. The renderer subscribes to the store locale; concept labels and relation types are displayed unchanged.

Context menus use the shared `MenuPopup` and `MenuItem` primitives from `@nesso/ui`; graph-specific actions and selection stay in the renderer.

## API

- `ConceptMap({ store, notifications, clipboard, readOnly?, preview?, bottomInset?, onDeleteView?, conceptLabelMaxLength? })`: renders the canvas with direct injected APIs. `preview` preserves selection while disabling editing and frames content above the host narrative inset. `onDeleteView` requests the host-owned confirmation when every visible concept is selected; the host supplies `conceptLabelMaxLength` for inline editing. Theme tokens and fonts are inherited from the host. See [src/index.tsx](src/index.tsx).
