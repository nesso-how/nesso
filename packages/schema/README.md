# @nesso/schema

A framework-independent graph model, validation, and a minimal JSON-LD profile. No runtime dependencies.

## Usage

```ts
import { parseGraph, relationKey, serializeGraph, validateGraph, type Graph } from '@nesso/schema'

const graph: Graph = {
  concepts: [
    { id: 'urn:learning', label: 'Learning', position: { x: 0, y: 0 } },
    { id: 'urn:practice', label: 'Practice', position: { x: 160, y: 100 } },
  ],
  relationTypes: [{ id: 'urn:uses', label: 'uses' }],
  relations: [{ source: 'urn:learning', predicate: 'urn:uses', target: 'urn:practice' }],
}
const document = serializeGraph(graph)
const restored = parseGraph(document)
console.log(validateGraph(restored), relationKey(restored.relations[0]))
```

## JSON-LD profile

Documents use an inline `@context` and `@graph` entries for concepts and `rdf:Property` relation types, identified by absolute IRIs. The `rdf`, `rdfs`, and `position` mappings must match `schemaContext`.

Relations use absolute predicate IRIs or local aliases mapped to known relation types with `@type: '@id'`. Remote contexts are not resolved; other non-predicate context terms are ignored. Unsupported document and graph-entry properties are rejected.

## API

- `parseGraph`: read a supported JSON-LD document into a `Graph`.
- `serializeGraph`: write a `Graph` as one JSON-LD document.
- `validateGraph`: return issues for invalid references, duplicates, and positions, without throwing.
- `newIri`: generate a UUID IRI.
- `relationKey`: identify a relation by its source, predicate, and target.
- `schemaContext`: the JSON-LD context of the profile.

Parsing and serialization validate the graph and throw `SchemaError` with structured `issues` on failure. See [types](src/types.ts) and [exports](src/index.ts).
