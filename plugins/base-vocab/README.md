# @nesso-how/base-vocab

The plugin for Base, the default relation vocabulary. It defines `linksTo`, `partOf`, `causes`, `kindOf`, `dependsOn`, `exampleOf`, `contradicts`, `defines`, `enables`, and `precedes`.

## Usage

The build supplies the manifest and the `definition.json` data, which the host parses and validates without executing. The default type is `linksTo`, and the graph renderer hides the label of the active vocabulary's default relation. See the [plugin guide](../../packages/plugin/README.md).

Display labels in English, Italian, and Simplified Chinese live in `src/labels.json` and follow the app locale, while the canonical labels and stable IRIs saved in the graph stay the same. User-defined relation types are not translated.

## API

- `relationIds`: stable IRIs for the ten relation types.
- `defaultRelationId`: the IRI of `linksTo`.
- `defaultRelationTypes`: the same types as `{ id, label }` entries.
- `definition.json`: the static vocabulary contribution, generated from `src/index.ts` at build time. Metadata and empty access declarations live in `package.json`.

See [src/index.ts](src/index.ts) for definitions.
