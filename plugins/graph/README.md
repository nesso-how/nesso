# @nesso/graph

React Flow renderer plugin: canvas, node/edge views, and adapters rendering the host-provided `viewGraph`.

## Usage

Add `graphPlugin` to the static plugin list in `src/plugins.ts`; the host renders its renderer when active (focused neighborhood or whole graph). The canvas offers `Add concept` (+) and `Delete selected` (trash, enabled only with a selection) as one horizontal control group top right; double-click zooms.

The canvas restores `workspace.viewports.graph` on mount and records the viewport at the end of pan/zoom gestures. Opening a saved workspace does not auto-fit over its viewport; changing focus or view mode still fits the new neighborhood or whole graph.

## API

- `graphPlugin`: factory binding the injected `NessoStore` to its renderer instance.
