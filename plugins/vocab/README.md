# @nesso/vocab

Nesso's default relation vocabulary plugin: `linksTo`, `partOf`, `causes`, and `kindOf`.

## Usage

Add `vocabPlugin` to the static plugin list in `src/plugins.ts`.

## API

- `relationIds`: stable IRIs for the four relation types.
- `defaultRelationId`: the IRI of `linksTo`.
- `defaultRelationTypes`: the same types as `{ id, label }` entries.
- `vocabPlugin`: static plugin factory returning the vocabulary contribution.
