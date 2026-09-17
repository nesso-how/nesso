---
title: Graph file schema
description: The JSON envelope of a Nesso graph file — version, vocabulary, concepts, relations, and metadata.
---

A Nesso graph file is a single JSON document. The envelope — versioning, the
concept and relation arrays — is owned by
[`@nesso-how/schema`](https://www.npmjs.com/package/@nesso-how/schema) and is
vocabulary-agnostic; the meaning of the content is owned by the vocabulary
declared in `vocabulary`. The app exports exactly this shape, the
[`@nesso-how/graph`](https://www.npmjs.com/package/@nesso-how/graph) embed
renders it, and the MCP server's `validate_graph` and `build_graph` tools
check and produce it.

## Envelope

| Field        | Type                  | Description                                                                                                                                                                                            |
| ------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `version`    | `1`                   | Envelope format version. Older released formats upgrade on load; a newer unsupported version is rejected so its data is not misinterpreted.                                                            |
| `name`       | `string`              | Graph name.                                                                                                                                                                                            |
| `vocabulary` | `{ id, version }`     | The vocabulary the graph was built with, e.g. `{ "id": "@nesso-how/vocab-learning", "version": "0.2.0" }`. Files missing it, or declaring a foreign id or unsupported version, are rejected on import. |
| `id`         | `string` _(optional)_ | Internal graph id used by desktop project sync; omitted in manual exports.                                                                                                                             |
| `updatedAt`  | `number` _(optional)_ | Last save time as Unix milliseconds; desktop sync metadata.                                                                                                                                            |
| `concepts`   | `Concept[]`           | The nodes (see below).                                                                                                                                                                                 |
| `relations`  | `Relation[]`          | The edges (see below).                                                                                                                                                                                 |
| `meta`       | `object` _(optional)_ | App metadata. The app stores the graph's [display settings](../guides/building-a-graph/#display-options-sidebar) under `meta.display`. Opaque to the schema.                                           |

## Concepts

```json
{
  "id": "n1",
  "label": "Sunlight",
  "x": 120,
  "y": 80,
  "data": { "elaboration": { "definition": "Light energy from the sun." } }
}
```

- `id`: opaque string, unique within the file.
- `label`: the concept title shown on the canvas.
- `x`, `y`: canvas position.
- `data.elaboration` _(optional)_: `definition`, a short explanation in your
  own words that feeds [Review](../guides/review-mode/) and the AI mentor, and
  `notes`, an optional bounded rich-text document (`{ "type": "doc",
"content": [...] }`, at most 8 levels deep and 100,000 serialized
  characters). Blocks an app version does not know load as their plain text.
  See [How notes are stored](../guides/writing-mode/#how-notes-are-stored).

## Relations

```json
{ "id": "e1", "source": "n1", "target": "n2", "type": "enables" }
```

- `source`, `target`: `id`s of concepts in the same file; `validate_graph`
  reports a dangling endpoint as an error.
- `type`: a relation type id from the
  [relation types reference](./relation-types/). A missing type is reported as
  a warning by `validate_graph` (the app falls back to `causes` at render
  time); an unknown type is an error.
- `data` _(optional)_: `curveFlip` and `curveFlipPinned`, the manual curve
  bend controls from [Display options](../guides/building-a-graph/#display-options-sidebar).

## Example

```json
{
  "version": 1,
  "vocabulary": { "id": "@nesso-how/vocab-learning", "version": "0.2.0" },
  "name": "Photosynthesis",
  "concepts": [
    { "id": "n1", "label": "Sunlight", "x": 120, "y": 80 },
    {
      "id": "n2",
      "label": "Glucose",
      "x": 320,
      "y": 80,
      "data": { "elaboration": { "definition": "A sugar plants produce." } }
    }
  ],
  "relations": [{ "id": "e1", "source": "n1", "target": "n2", "type": "enables" }]
}
```

The [MCP server](../guides/mcp/) can build a complete document for you: its
`build_graph` tool assigns ids, vocabulary metadata, and layout positions, and
accepts notes as plain text (capped at 20,000 characters).

## What a graph file does not contain

- **FSRS review progress** (stability, difficulty, due dates): stored
  separately and never exported, so sharing a file never carries recall
  history. See [Export and import](../guides/graph-management/#export-and-import).
- **Runtime render state**: React Flow internals and selection live only in
  the app.

## Compatibility

Envelope and vocabulary versions are independent axes with sequential
migration ladders. See [File compatibility](../guides/graph-management/#file-compatibility)
for the policy and the supported baselines.
