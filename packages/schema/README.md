# @nesso/schema

A framework-independent graph model and a minimal JSON-LD profile.

## Usage

```ts
import { parseGraph, relationKey, validateGraph } from '@nesso/schema'

const graph = parseGraph(document)
const issues = validateGraph(graph)
const id = relationKey({ source, predicate, target })
```

## API

- `parseGraph`: read a supported JSON-LD document into a `Graph`.
- `serializeGraph`: write a `Graph` as one JSON-LD document.
- `validateGraph`: report invalid references, duplicates, and positions.
- `newIri`: generate a UUID IRI.
- `relationKey`: identify a relation by its source, predicate, and target.
- `schemaContext`: the JSON-LD context of the profile.
- Types: `Graph`, `Concept`, `Relation`, `RelationType`, `Position`, `SchemaIssue`; failures throw `SchemaError`.
