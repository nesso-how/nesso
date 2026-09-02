# @nesso-how/vocab-learning

The **Nesso Learning Vocabulary** for [Nesso](https://nesso.how) — a self-contained graph vocabulary: 52 typed relation types in 8 categories, type properties, category palettes, and private node parameters (FSRS review fields).

Graph JSON files declare which vocabulary they use via `VOCABULARY.id` and a normative `version`. File I/O builds on [`@nesso-how/schema`](../schema/README.md) and adds learning-vocabulary validation (elaboration shape, known relation type ids).

## Install

```bash
npm install @nesso-how/vocab-learning
```

## Usage

### Relation catalog and palettes

```ts
import {
  VOCABULARY,
  RELATION_CATEGORIES,
  RELATION_TYPES,
  RELATION_TYPE_VALUES,
  PALETTES,
  defaultConceptReviewFields,
} from '@nesso-how/vocab-learning'

const def = RELATION_TYPES['causes']
// { cat: 'causal', label: 'causes', inverse: 'caused-by', ... }

const freshNode = defaultConceptReviewFields()
// { stability: 0, difficulty: 0, due: 0, ... }
```

### Graph document I/O

```ts
import { deserialize, serialize, type NessoGraphDocument } from '@nesso-how/vocab-learning'

const json = serialize({
  vocabulary: { id: '@nesso-how/vocab-learning', version: '0.2.0' },
  name: 'My graph',
  concepts: [{ id: 'n1', label: 'Idea', x: 0, y: 0, data: { elaboration: { definition: '...' } } }],
  relations: [{ id: 'e1', source: 'n1', target: 'n2', type: 'causes' }],
})
const doc: NessoGraphDocument = deserialize(json)
```

**Shared content vs review state.** `serialize` / `deserialize` handle the portable graph file: concept labels, positions, `elaboration`, relation types, and layout hints. FSRS fields (`stability`, `difficulty`, `due`, etc.) are runtime node parameters for spaced repetition — they are typed here via `defaultConceptReviewFields()` but are **not** written into shared graph JSON; the Nesso app persists them separately.

### Notes documents (elaboration)

The current `0.2.0` `ConceptElaboration` is `{ definition, notes? }`. `notes` is
a native TipTap JSON document
(`{ type: 'doc', content: [...] }`) persisted verbatim, including custom block
types. Unknown block types pass the guard within this supported `0.2.0`
vocabulary because validation is block-agnostic. This does not make newer
vocabulary versions supported: documents declaring a version newer than
`0.2.0` are rejected by the forward guard.

- `NOTES_MAX_DEPTH` / `NOTES_MAX_SERIALIZED_CHARS` bound nesting and serialized size.
- `notesToPlainText` flattens any document (blocks joined with newlines); unknown
  blocks degrade to their text, never destroyed.
- `paragraphNotesFromPlainText(text)` builds the minimal paragraph document used by
  plain-text boundaries (MCP).

Relation types reference: [Relation types](https://nesso.how/docs/reference/relation-types/).

## Persisted vocabulary compatibility

Learning-vocabulary documents must declare
`@nesso-how/vocab-learning` and a supported normative vocabulary version.
The current version is `0.2.0`: concept elaboration is
`{ definition, notes? }` where `notes` is an optional bounded TipTap JSON
document (block-agnostic guard).

Legacy vocabulary `0.1.0` (definition-only elaboration) is migrated by the app's
`graphLoadNormalizer` sequential ladder; the source shape is validated before
relabeling. Removed alpha-only `examples`, string `notes`, and image fields are
not migrated or discarded — documents containing them are rejected.

## License

MIT
