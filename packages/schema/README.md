# @nesso/schema

A framework-independent graph model and a minimal JSON-LD profile.

## Graph

`Graph` is the in-memory data model: concepts (labels, tags, positions), relation
types, and directed relations identified by IRIs.

## Functions

- `parseGraph`: read a supported JSON-LD document into a `Graph`.
- `serializeGraph`: write a `Graph` as one JSON-LD document.
- `validateGraph`: report invalid references, duplicates, and positions.
- `newIri`: generate a UUID IRI.
- `relationKey`: identify a relation by its source, predicate, and target.
