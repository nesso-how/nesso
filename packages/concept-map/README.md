# @nesso/concept-map

Trusted React Flow renderer: canvas, node/edge views, and adapters rendering the host-provided `viewGraph`.

## Usage

Render `ConceptMap` with an injected store, host commands, and `focusRef`. It subscribes to that store instance and applies local gesture edits synchronously through `applyOperations`. It is a trusted React component, not an isolated plugin; it never imports host internals or accesses the system clipboard.

The host's `GraphWorkspace` configures `ConceptMap` and mounts the renderer-independent interactions in `src/graph`: shortcuts, clipboard I/O, deletion policy and confirmation requests, notifications, and clipboard async guards. The renderer owns geometry, local gestures, inline editing state, and its temporary gesture lock. It exposes its root element through `focusRef` so host focus restoration needs no renderer DOM selectors. Intro uses a separate store and workspace with both `readOnly` and `preview` enabled.

## Controls

- Hold Shift, Ctrl, or Cmd to add items to the selection. Ctrl/Cmd+A selects the visible graph; Escape clears selection. Drag selected concepts together.
- Ctrl/Cmd+C, X, and V copy, cut, and paste selected concepts and relations, also available beside undo/redo and in context menus. Pasted concepts join the active view with labels, types, and layout preserved. Cut and paste are undoable; text fields keep native clipboard behavior.
- **Add concept** creates a concept near a single selected concept, linked with the active vocabulary's default type. Otherwise it starts disconnected at the viewport center. New concepts join the active view.
- **Delete**, Delete, or Backspace removes selected items. Deleting a selection containing every visible concept requests the host's view-deletion confirmation; clearing the complete graph leaves one fresh concept and remains undoable. Cut never invokes that dialog or removes the last concept.
- Double-click a concept label to edit it inline. New concepts open their label editor automatically. Enter or blur commits, Escape cancels, and the host-supplied label limit bounds input.
- Select a single concept to create a relation, or a single relation to reconnect it. Reconnection preserves the relation type; self-connections and duplicates are rejected.
- **Undo** and **Redo** control shared document history, including saved-view edits, not only the selection.
- Right-click the background, a concept, a relation, or a selected group for contextual graph actions. When unlocked, a selected target keeps the group and an unselected target replaces the selection. Background clicks keep the selection, and **Add concept** places the new concept at the clicked point. Shift+F10 or the context-menu key opens the menu for the focused item. Escape closes the menu without clearing selection.
- The background menu has no deletion action, and relation menus have no concept creation action. Undo and redo remain in the toolbar, not in context menus.
- Fit the view or lock canvas gestures with the canvas controls; double-click the background to add a concept. The renderer-local lock disables editing gestures, inline editing, and the renderer's Cut, Paste, Delete, Add concept, and Select all controls. Copy, viewport navigation, and history remain available. The lock does not restrict host commands or shortcuts.

Canvas controls and accessibility messages use local English, Italian, and Simplified Chinese catalogs through `@nesso/i18n`. The renderer subscribes to the store locale; concept labels and relation types are displayed unchanged.

Context menus use the shared `MenuPopup` and `MenuItem` primitives from `@nesso/ui`. The host owns deletion policy and confirmation, clipboard serialization and lifecycle, and shortcut routing. Graph shortcuts are scoped to the canvas; history shortcuts work across the app, while text fields retain native editing. The renderer updates selection through the injected store, maps connection gestures, cancels local interactions before Escape reaches the host, and supplies graph coordinates for contextual paste. Toolbar and menu deletion/clipboard actions invoke the same injected host commands.

## API

- `ConceptMap({ store, commands, focusRef, readOnly?, preview?, bottomInset?, conceptLabelMaxLength? })`: renders the canvas with injected host callbacks. `GraphCommands` supplies deletion and clipboard actions; selection and button availability use the injected store, and history controls use its undo/redo methods. The host controls read-only mode through `readOnly` and uses `focusRef` to focus the renderer's root element; the renderer owns its temporary gesture lock. `preview` frames content above `bottomInset` and permits selection even in read-only mode; use it with `readOnly` to disable editing. The host supplies `conceptLabelMaxLength` for inline editing. Theme tokens and fonts are inherited from the host. See [src/index.tsx](src/index.tsx).
