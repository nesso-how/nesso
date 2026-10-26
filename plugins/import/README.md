# @nesso-how/import

Action plugin importing a Nesso JSON-LD file into the current graph.

## Usage

The bundled **Import** action runs in an isolated worker and reads a user-selected file through the host. It merges concepts, relations, and missing relation types with fresh concept IDs into one atomic history entry. Imported concepts join the invoked view even if navigation changes during file selection. Invalid files report a localized failure without touching the graph.

## API

- `create(context)`: factory contributing the `import-view` action. Access declarations and localized labels/failure text live in `package.json`; Nesso resolves the current language with an English fallback.
- `buildImportOperations(snapshot, activeViewId, viewId)`: pure merge of a parsed graph into one atomic operation batch.

See [src/index.ts](src/index.ts) for definitions.
