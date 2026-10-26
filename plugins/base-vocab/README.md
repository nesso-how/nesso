# @nesso-how/base-vocab

Base's default relation vocabulary plugin: `linksTo`, `partOf`, `causes`, `kindOf`, `dependsOn`, `exampleOf`, `contradicts`, `defines`, `enables`, and `precedes`.

## Usage

The build supplies the manifest and `definition.json` data. The host parses and validates the definition without executing it. Its default type is `linksTo`; the graph renderer hides the active vocabulary's default relation label. See the [plugin guide](../../packages/plugin/README.md).

## API

- `relationIds`: stable IRIs for the ten relation types.
- `defaultRelationId`: the IRI of `linksTo`.
- `defaultRelationTypes`: the same types as `{ id, label }` entries.
- `definition.json`: the static vocabulary contribution, generated from `src/index.ts` at build time. Metadata and empty access declarations live in `package.json`.

See [src/index.ts](src/index.ts) for definitions.
