# @nesso-how/base-vocab

Base's default relation vocabulary plugin: `linksTo`, `partOf`, `causes`, `kindOf`, `dependsOn`, `exampleOf`, `contradicts`, `defines`, `enables`, and `precedes`.

## Usage

The build supplies the manifest and `definition.json` data. The host parses and validates the definition without executing it. Its default type is `linksTo`; the graph renderer hides the active vocabulary's default relation label. See the [plugin guide](../../packages/plugin/README.md).

Display labels are supplied in English, Italian, and Simplified Chinese in `src/labels.json`. They follow the app locale without changing the canonical labels or stable IRIs saved in the graph. User-defined relation types are not translated.

## API

- `relationIds`: stable IRIs for the ten relation types.
- `defaultRelationId`: the IRI of `linksTo`.
- `defaultRelationTypes`: the same types as `{ id, label }` entries.
- `definition.json`: the static vocabulary contribution, generated from `src/index.ts` at build time. Metadata and empty access declarations live in `package.json`.

See [src/index.ts](src/index.ts) for definitions.
