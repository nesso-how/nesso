# @nesso/export

Action plugin exporting a view as a JSON-LD download.

## Usage

Register `exportPlugin` using the [plugin guide](../../packages/plugin/README.md#register-it). Its **Export** action targets the view it runs on (`null` targets the complete graph), reading that view without changing navigation.

The host lists view-scoped actions in the saved-view menus. Interface labels use local English/Italian catalogs; graph contents are exported unchanged.

## API

- `exportPlugin`: read-only operation declaration and factory contributing the `export-view` action.
- `downloadGraph(graph, name = 'graph')`: download JSON-LD as `nesso-<name>.jsonld`, sanitizing the supplied name for the filename.

See [src/index.ts](src/index.ts) for definitions.
