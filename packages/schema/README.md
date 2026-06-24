# @nesso-how/schema

Vocabulary-agnostic JSON schema for [Nesso](https://nesso.how) knowledge graph documents.

Defines the on-disk envelope (`version`, optional `vocabulary`, `name`, `concepts`, `relations`, optional `meta`) and structural validation on parse. Relation type ids and concept `data` shapes are opaque here — vocabulary packages add typed aliases and extra validation.

## Install

```bash
npm install @nesso-how/schema
```

## Usage

```ts
import { GRAPH_FORMAT_VERSION, deserialize, serialize, type GraphDocument } from '@nesso-how/schema'

const json = serialize({
  name: 'My graph',
  vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
  concepts: [{ id: 'n1', label: 'Idea', x: 0, y: 0 }],
  relations: [],
})
const doc: GraphDocument = deserialize(json)
// doc.version === GRAPH_FORMAT_VERSION
```

Vocabulary-specific serialization (e.g. Nesso Learning Vocabulary) lives in [`@nesso-how/vocab-learning`](../vocab-learning/README.md).

## License

MIT
