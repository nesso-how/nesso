# @nesso-how/schema

A framework-independent graph model with Zod schemas, inferred TypeScript types, and a minimal JSON-LD profile. Maps hold the presentation of their member concepts.

## Usage

```ts
import {
  parseGraph,
  relationKey,
  serializeGraph,
  validateGraph,
  type ConceptMap,
  type Graph,
} from '@nesso-how/schema'

const graph: Graph = {
  concepts: [
    { id: 'urn:learning', label: 'Learning' },
    { id: 'urn:practice', label: 'Practice' },
  ],
  relationTypes: [{ id: 'urn:uses', label: 'uses' }],
  relations: [{ source: 'urn:learning', predicate: 'urn:uses', target: 'urn:practice' }],
}
const maps: ConceptMap[] = [
  {
    id: 'urn:study',
    name: 'Study',
    members: [
      { id: 'urn:learning', position: { x: 0, y: 0 }, bold: true },
      { id: 'urn:practice', position: { x: 160, y: 100 } },
    ],
  },
]
const document = serializeGraph(graph, maps)
const restored = parseGraph(document)
console.log(validateGraph(restored.graph, restored.maps), relationKey(graph.relations[0]))
```

## JSON-LD profile

Documents carry `schemaVersion: 4`, an inline `@context`, and `@graph` entries for concepts and `rdf:Property` relation types, both identified by absolute IRIs. The `rdf`, `rdfs`, `schemaVersion`, and `position` mappings must match `schemaContext`. `schemaVersion` identifies the Nesso profile, which is versioned separately from the app, storage, backups, and plugins, and it is not the JSON-LD standard's `@version` keyword.

Concepts have an optional `notes` string, serialized as `rdfs:comment`, so the JSON-LD representation does not depend on the in-memory property name.

Maps are optional `@graph` entries with `@type: 'Map'`, an `rdfs:label` name, and `members`. Each member references a `concept` and has a `position`, plus optional `color`, `bold`, `italic`, and `strikethrough`. `color` is either a fixed `#rrggbb` value or one of the preset ids in `colorPresets` (`neutral`, `sand`, `peach`, `rose`, `sage`, `mint`, `sky`, `lavender`), and the active theme defines the value of each preset.

Maps may also carry `relationBends`, an array of `{ source, predicate, target, bend }` entries stored through the matching `@json` context term. Each entry references an existing relation whose endpoints both belong to the map. A relation can appear only once, and self-relations are not allowed. `bend` is a finite, nonzero, signed fraction of the length of the directed segment between the endpoints, and positive bends move the curve midpoint along its left normal in graph coordinates. Relations without an entry use the automatic curve. Presentation never changes semantic triples.

`parseGraph` accepts the current profile and supported legacy documents without modifying its input, while `serializeGraph` always writes the current profile.

Profile 2 has no manual curves and migrates to profile 3 unchanged. Profile 3 migrates to profile 4 by renaming the `View` term and type to `Map`, while the IRI stays the same.

Relations use absolute predicate IRIs or local aliases mapped to known relation types with `@type: '@id'`. Relation types cannot use concept property keys such as `rdfs:label` or `rdfs:comment`. Remote contexts are not resolved and other non-predicate context terms are ignored, but unsupported document and graph-entry properties are rejected.

## API

- `parseGraph`: read a supported JSON-LD document into a `Graph` and its `ConceptMap`s.
- `serializeGraph`: write a `Graph` and optional maps as one JSON-LD document.
- `validateGraph`: return issues for invalid references, duplicates, and presentation. It does not throw.
- `newIri`: generate a UUID IRI.
- `relationKey`: identify a relation by its source, predicate, and target.
- `schemaContext`: the JSON-LD context of the profile.
- `colorPresets`: the preset ids accepted as concept colors.
- `migratePresetColor`: replace a member's legacy preset hex color with its preset id.

Parsing and serialization validate the graph and, on failure, throw `SchemaError`, a subclass of `NessoError`, with structured `issues`. See [schemas and inferred types](src/types.ts) and [exports](src/index.ts).
