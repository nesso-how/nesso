# @nesso/graph

React Flow renderer plugin: canvas, node/edge views, and adapters rendering the host-provided `viewGraph`.

## Usage

Add `graphPlugin` to the static plugin list in `src/plugins.ts`; the host renders its renderer when active (saved view or complete graph). The canvas offers `Add concept` (+) and `Delete selected` (trash, enabled only with a selection) as one horizontal control group top right; double-click zooms.

New concepts appear near the selected concept or at the viewport center, and join the active view. Only the selected node shows its creation handle; selected edges expose reconnect handles that preserve the relation type. Self-connections and duplicates are rejected.

## API

- `graphPlugin`: operation declaration and factory binding the injected `NessoStore` to its renderer instance.
