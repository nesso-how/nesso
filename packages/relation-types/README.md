# @nesso-how/relation-types

Semantic relation types for [Nesso](https://nesso.how) — 52 typed edges in 8 categories.

## Install

```bash
npm install @nesso-how/relation-types
```

## Usage

```ts
import {
  RELATION_TYPES,
  RELATION_TYPE_VALUES,
} from "@nesso-how/relation-types";

const def = RELATION_TYPES["causes"];
// { cat: 'causal', label: 'causes', inverse: 'caused-by', ... }
```

Full reference: [Relation types](https://nesso.how/docs/reference/relation-types/).

## License

MIT
