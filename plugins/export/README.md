# @nesso/export

Action plugin exporting the visible graph as a JSON-LD download.

## Usage

Register `exportPlugin` using the [plugin guide](../../packages/plugin/README.md#register-it). Its navbar **Export view** action reads the current `viewGraph` when invoked.

Saved-view menus use `downloadGraph` with a host-materialized view, including inactive or empty views, without changing navigation. Interface labels use local English/Italian catalogs; graph contents are exported unchanged.

## API

- `exportPlugin`: read-only operation declaration and factory contributing the `export-view` action.
- `downloadGraph(graph, name = 'graph')`: download JSON-LD as `nesso-<name>.jsonld`, sanitizing the supplied name for the filename.

See [src/index.ts](src/index.ts) for definitions.
