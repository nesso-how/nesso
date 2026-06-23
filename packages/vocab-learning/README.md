# @nesso-how/vocab-learning

The **Nesso Learning Vocabulary** for [Nesso](https://nesso.how) — a self-contained graph vocabulary: 52 typed relation types in 8 categories, semantic coefficients, category palettes, and private node parameters (FSRS review fields).

Graph JSON files declare which vocabulary they use via `VOCABULARY.id` and a normative `version`.

## Install

```bash
npm install @nesso-how/vocab-learning
```

## Usage

```ts
import {
  VOCABULARY,
  RELATION_TYPES,
  RELATION_TYPE_VALUES,
  defaultConceptReviewFields,
} from '@nesso-how/vocab-learning'

const def = RELATION_TYPES['causes']
// { cat: 'causal', label: 'causes', inverse: 'caused-by', ... }

const freshNode = defaultConceptReviewFields()
// { stability: 0, difficulty: 0, due: 0, ... }
```

Relation types reference: [Relation types](https://nesso.how/docs/reference/relation-types/).

## License

MIT
