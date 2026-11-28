# @nesso-how/concept-map

A trusted React Flow renderer that provides the canvas, the node and edge views, and the adapters that render the host-provided `mapGraph`.

## Usage

Render `ConceptMap` with an injected `NessoStore` from `@nesso-how/core`, host commands, and `focusRef`. It subscribes to that store instance and applies local gesture edits synchronously through `applyOperations`. It is a trusted React component rather than an isolated plugin, yet it never imports host internals or accesses the system clipboard.

The host's `GraphWorkspace` configures `ConceptMap` and mounts the renderer-independent interactions in `src/graph`, which cover shortcuts, clipboard I/O, deletion policy and confirmation requests, notifications, and clipboard async guards. The renderer owns geometry, local gestures, inline editing state, and its temporary gesture lock. It exposes its root element through `focusRef` so the host can restore focus without renderer DOM selectors. Intro uses a separate store and workspace with both `readOnly` and `preview` enabled.

## Controls

For gestures, keyboard shortcuts, grouping, and deletion rules, see [Work on a map](../../docs/guide.md#work-on-a-map) (`read_docs` topic: `guide`).

Canvas controls and accessibility messages use local English, Italian, and Simplified Chinese catalogs through `@nesso-how/i18n`, and the renderer subscribes to the store locale. Concept labels and relation types are displayed unchanged.

Context menus use the shared `MenuPopup` and `MenuItem` primitives from `@nesso-how/ui`. The host owns deletion policy and confirmation, clipboard serialization and lifecycle, and shortcut routing. Graph shortcuts are scoped to the canvas, and history shortcuts work across the app except in text fields, which keep their native editing. The renderer updates selection through the injected store and maps connection gestures. It also cancels local interactions before Escape reaches the host and supplies graph coordinates for contextual paste. Deletion and clipboard actions in the toolbar and menus invoke the same injected host commands.

## API

- `ConceptMap({ store, commands, focusRef, readOnly?, preview?, connection?, bottomInset?, conceptLabelMaxLength?, restoreViewport? })`: renders the canvas with injected host callbacks. `GraphCommands` supplies deletion, clipboard actions, a cut-availability selector, and Select All, while gesture selection and undo/redo go through the injected store. The host sets read-only mode through `readOnly`, which keeps selection available, and focuses the renderer's root element through `focusRef`. `preview` frames content above `bottomInset`, and combining it with `readOnly` disables editing. The host supplies `conceptLabelMaxLength` for inline editing, and the canvas inherits theme tokens and fonts from the host. See [src/index.tsx](src/index.tsx).
  - `connection?: { source, target }`: allows creating only that directed relation, even in read-only mode, and blocks parallel connections between those two concepts.
  - `restoreViewport?`: defaults to `true`, which restores the saved viewport on mount. With `false`, the canvas fits the active map instead.
  - `onPresentation?`: captures the current graph, map, and visible groups for image export. It does not persist renderer geometry.
- `conceptMapShortcuts(locale)`: returns the translated title and key combinations for the renderer's local shortcuts. The return value must stay assignable to the host's `ShortcutSection` in `src/components/app/ShortcutSettings.tsx` without the renderer importing host code. See [src/shortcuts.ts](src/shortcuts.ts).
- `ref?: Ref<ConceptMapHandle>` exposes `focusConcept(id)`, which frames a visible concept and focuses the canvas once the concept's nodes are measured. With `bottomInset`, it pans at the current zoom to center the concept above the covered area, and focus stays on the overlay. The viewport stays unchanged when the whole concept is already visible in the uncovered canvas and no framing is in progress. The host owns map navigation and selection, while the renderer owns framing, including reduced-motion behavior. The handle also exposes `addToMap(id)`, which adds an existing concept to the active map near its map neighbors without moving focus.
- `renderConceptMapImage({ store, theme, scale?, signal })` from `@nesso-how/concept-map/image`: returns a canvas rendered from an immutable store snapshot and a captured theme, embedding the host's fonts and leaving the live canvas unchanged. See [src/image.ts](src/image.ts).
