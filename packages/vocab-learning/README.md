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
  name: 'My graph',
  concepts: [{ id: 'n1', label: 'Idea', x: 0, y: 0, data: { elaboration: { ... } } }],
  relations: [{ id: 'e1', source: 'n1', target: 'n2', type: 'causes' }],
})
const doc: NessoGraphDocument = deserialize(json)
```

**Shared content vs review state.** `serialize` / `deserialize` handle the portable graph file: concept labels, positions, `elaboration`, relation types, and layout hints. FSRS fields (`stability`, `difficulty`, `due`, etc.) are runtime node parameters for spaced repetition — they are typed here via `defaultConceptReviewFields()` but are **not** written into shared graph JSON; the Nesso app persists them separately.

Relation types reference: [Relation types](https://nesso.how/docs/reference/relation-types/).

## License

MIT
