# @nesso-how/import

Action plugin importing a Nesso JSON-LD file as a new view.

## Usage

The bundled **Import** action runs in an isolated worker and reads a user-selected file through the host. It creates a new view named after the file with fresh concept IDs, preserving labels, positions, relations, and missing relation types in one atomic history entry. The new view is activated, so the canvas frames it. Invalid files report a localized failure without touching the graph.

Import/export exchange a graph view, not the complete application state; use a manual backup for full restoration.

## API

- `create()`: factory contributing the `import` action; `run(context)` receives its execution APIs. Access declarations and localized labels/failure text live in `package.json`; Nesso resolves the current language with an English fallback.
- `deriveViewName(fileName)`: file basename without extension and `nesso-` prefix, dashes normalized, max 70 chars.
- `buildImportOperations(snapshot, viewId, viewName)`: pure creation of the new view plus merge of a parsed graph into one atomic operation batch.

See [src/index.ts](src/index.ts) for definitions.
