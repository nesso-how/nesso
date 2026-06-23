# @nesso-how/types

Shared TypeScript types for [Nesso](https://nesso.how) — nodes, edges, settings, FSRS fields.

## Install

```bash
npm install @nesso-how/types
```

## Usage

```ts
import type { ConceptNodeData, NessoSettings } from '@nesso-how/types'
import { defaultConceptReviewFields, nodeToCard } from '@nesso-how/types'
```

`LearningNodeParams`, `defaultConceptReviewFields`, and `VOCABULARY` originate in the
`@nesso-how/vocab-learning` vocabulary and are re-exported here for convenience; `nodeToCard`
and `ConceptNodeData` are defined in this package.

## License

MIT
