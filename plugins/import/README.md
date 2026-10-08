# @nesso/import

Action plugin importing a Nesso JSON-LD file into the current graph.

## Usage

Register `importPlugin` using the [plugin guide](../../packages/plugin/README.md#register-it). Its **Import** action reads a user-selected file, merges its concepts, relations, and missing relation types with fresh concept IDs, and joins the imported concepts to the view it runs on. Invalid files report a localized alert without touching the graph.

## API

- `importPlugin`: operation declaration and factory contributing the `import-view` action.
- `buildImportOperations(snapshot, state, viewId)`: pure merge of a parsed graph into one atomic operation batch.

See [src/index.ts](src/index.ts) for definitions.
