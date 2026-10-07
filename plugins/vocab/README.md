# @nesso/vocab

Nesso's default relation vocabulary plugin: `linksTo`, `partOf`, `causes`, and `kindOf`.

## Usage

Register `vocabPlugin` using the [plugin guide](../../packages/plugin/README.md#register-it). Its default type is `linksTo`; the graph renderer hides the active vocabulary's default relation label.

## API

- `relationIds`: stable IRIs for the four relation types.
- `defaultRelationId`: the IRI of `linksTo`.
- `defaultRelationTypes`: the same types as `{ id, label }` entries.
- `vocabPlugin`: read-only operation declaration and factory returning the vocabulary contribution.

See [src/index.ts](src/index.ts) for definitions.
