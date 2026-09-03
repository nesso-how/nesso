# Graph model

## Vocabulary and files

Every Nesso graph declares a vocabulary identity and normative version. The
first vocabulary is `@nesso-how/vocab-learning`, whose `VOCABULARY` definition
is authoritative for relation semantics, display settings, and node parameters.
The envelope format version is owned independently by `@nesso-how/schema`.

`@nesso-how/schema` validates and serializes the envelope. The vocabulary
package validates relation types and elaborations. The app's
`src/lib/graphLoadNormalizer.ts` is the single app-side boundary that combines
envelope deserialization, vocabulary migration, and render-graph mapping. See
[`compatibility.md`](compatibility.md) for version and persistence policy.

## Nodes and elaboration

Runtime concept nodes contain their text and learning fields. An elaboration is
`{ definition: string; notes?: NotesDocument }`, with `NotesDocument` being the
bounded native TipTap JSON shape validated by the vocabulary package. FSRS
fields are runtime/review state and do not belong in graph JSON.

Writing Mode commits valid notes synchronously through the store and leaves
invalid or oversized documents visible without committing them. Definition
edits go through the elaboration helper and must preserve existing notes.

## Relations

The vocabulary owns the 52 relation types in 8 categories, their inverse or
symmetric semantics, and their type-level properties. `strength` is a semantic
weight of a relation type, not per-edge confidence. Use the canonical
definitions and category order from `@nesso-how/vocab-learning`; do not copy
the schema or relation table into app code.

Every canvas edge carries `data.type: RelationTypeName` and is rendered with
`type: 'nesso'` by `NessoEdge` from `@nesso-how/graph`. Never use a default
React Flow edge type.

## Rendering

`edgeEncoding` controls full, category, or minimal relation rendering.
Category colours belong to the vocabulary palettes and are exposed as CSS
variables. Theme tokens belong to `@nesso-how/theme`; do not move category
colours there or hardcode colour literals. Exact interfaces and field shapes
belong to the source packages and their tests.
