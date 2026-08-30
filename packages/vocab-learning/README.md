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
  vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
  name: 'My graph',
  concepts: [{ id: 'n1', label: 'Idea', x: 0, y: 0, data: { elaboration: { definition: '...' } } }],
  relations: [{ id: 'e1', source: 'n1', target: 'n2', type: 'causes' }],
})
const doc: NessoGraphDocument = deserialize(json)
```

**Shared content vs review state.** `serialize` / `deserialize` handle the portable graph file: concept labels, positions, `elaboration`, relation types, and layout hints. FSRS fields (`stability`, `difficulty`, `due`, etc.) are runtime node parameters for spaced repetition — they are typed here via `defaultConceptReviewFields()` but are **not** written into shared graph JSON; the Nesso app persists them separately.

### Notes documents (elaboration)

The current `0.1.0` `ConceptElaboration` is definition-only. Its notes-aware
shape is enabled automatically when the vocabulary advances to `0.2.0` through
the app's migration ladder. `notes` is a native TipTap JSON document
(`{ type: 'doc', content: [...] }`) persisted verbatim, including custom block
types. The vocabulary guards it **block-agnostically**: unknown block types pass,
so newer documents still load in older apps.

- `NOTES_MAX_DEPTH` / `NOTES_MAX_SERIALIZED_CHARS` bound nesting and serialized size.
- `notesToPlainText` flattens any document (blocks joined with newlines); unknown
  blocks degrade to their text, never destroyed.
- `paragraphNotesFromPlainText(text)` builds the minimal paragraph document used by
  plain-text boundaries (MCP).

Relation types reference: [Relation types](https://nesso.how/docs/reference/relation-types/).

## Persisted vocabulary compatibility

Learning-vocabulary documents must declare
`@nesso-how/vocab-learning` and a supported normative vocabulary version.
The first protected baseline is vocabulary `0.1.0` with definition-only
concept elaboration.

Removed alpha-only `examples`, `notes`, and image fields are not migrated or
discarded. Documents containing them are rejected.

## License

MIT
