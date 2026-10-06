# @nesso/export

Action plugin exporting the visible graph as a JSON-LD download.

## Usage

Add `exportPlugin` to the static plugin list in `src/plugins.ts`; it contributes an `Export view` item to the navbar's actions menu that downloads the visible graph. Saved-view menus use the same label and export that view's own induced graph, including when inactive or empty, without changing navigation.

## API

- `exportPlugin`: read-only operation declaration and factory contributing the `export-view` action.
- `downloadGraph(graph, name?)`: export a graph with a filename derived from its name.
