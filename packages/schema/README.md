# @nesso-how/schema

A framework-independent graph model with Zod schemas, inferred TypeScript types, and a minimal JSON-LD profile. Views hold the presentation of their member concepts.

## Usage

```ts
import {
  parseGraph,
  relationKey,
  serializeGraph,
  validateGraph,
  type Graph,
  type View,
} from '@nesso-how/schema'

const graph: Graph = {
  concepts: [
    { id: 'urn:learning', label: 'Learning' },
    { id: 'urn:practice', label: 'Practice' },
  ],
  relationTypes: [{ id: 'urn:uses', label: 'uses' }],
  relations: [{ source: 'urn:learning', predicate: 'urn:uses', target: 'urn:practice' }],
}
const views: View[] = [
  {
    id: 'urn:study',
    name: 'Study',
    members: [
      { id: 'urn:learning', position: { x: 0, y: 0 }, bold: true },
      { id: 'urn:practice', position: { x: 160, y: 100 } },
    ],
  },
]
const document = serializeGraph(graph, views)
const restored = parseGraph(document)
console.log(validateGraph(restored.graph, restored.views), relationKey(graph.relations[0]))
```

## JSON-LD profile

Documents carry `schemaVersion: 3`, an inline `@context`, and `@graph` entries for concepts and `rdf:Property` relation types, identified by absolute IRIs. The `rdf`, `rdfs`, `schemaVersion`, and `position` mappings must match `schemaContext`. `schemaVersion` identifies the Nesso profile, independently of app, storage, backup, and plugin versions; it is not the JSON-LD standard's `@version` keyword.

Concepts have an optional `notes` string, serialized as `rdfs:comment`. The JSON-LD representation is independent of the in-memory property name.

Views are optional `@graph` entries with `@type: 'View'`, an `rdfs:label` name, and `members`, each referencing a `concept` with its `position` and optional `color`, `bold`, `italic`, and `strikethrough`. `color` is either a fixed `#rrggbb` value or one of the preset ids in `colorPresets` (`neutral`, `sand`, `peach`, `rose`, `sage`, `mint`, `sky`, `lavender`), whose value the active theme defines.

Views may also carry `relationBends`, an array of `{ source, predicate, target, bend }` stored through the matching `@json` context term. Each entry references a unique, non-self relation whose endpoints belong to the view. `bend` is a finite, nonzero signed fraction of the directed endpoint segment's length: positive bends move the curve midpoint along its left normal in graph coordinates. Missing entries use the automatic curve. Presentation never changes semantic triples.

`parseGraph` accepts the current profile and supported legacy documents without modifying its input. `serializeGraph` always writes the current profile.

Profile 2 migrates to profile 3 unchanged, without manual curves.

Relations use absolute predicate IRIs or local aliases mapped to known relation types with `@type: '@id'`. Relation types cannot use concept property keys such as `rdfs:label` or `rdfs:comment`. Remote contexts are not resolved; other non-predicate context terms are ignored. Unsupported document and graph-entry properties are rejected.

## API

- `parseGraph`: read a supported JSON-LD document into a `Graph` and its `View`s.
- `serializeGraph`: write a `Graph` and optional views as one JSON-LD document.
- `validateGraph`: return issues for invalid references, duplicates, and presentation, without throwing.
- `newIri`: generate a UUID IRI.
- `relationKey`: identify a relation by its source, predicate, and target.
- `schemaContext`: the JSON-LD context of the profile.
- `colorPresets`: the preset ids accepted as concept colors.
- `migratePresetColor`: replace a member's legacy preset hex color with its preset id.

Parsing and serialization validate the graph and throw `SchemaError`, a subclass of `NessoError`, with structured `issues` on failure. See [schemas and inferred types](src/types.ts) and [exports](src/index.ts).
