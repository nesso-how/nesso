---
title: MCP tools
description: Reference for the four tools exposed by the @nesso-how/mcp server.
---

The `@nesso-how/mcp` server exposes four tools. See [MCP](../../guides/mcp/) for setup and workflow.

### `get_nesso_docs`

Fetches documentation pages from this site. Call it without a `slug` to get a table of contents, or with a slug (e.g. `"guides/getting-started"`) to get the full page content.

### `get_relation_types`

Returns the complete list of relation types grouped by category id (`taxonomic`, `structural`, and so on from `RELATION_CATEGORIES` in `@nesso-how/vocab-learning`), with glyph, symmetry, and type properties (transitive, inverse, strength, polarity, cardinality). Use this whenever you need valid type names for graph JSON or explanations for the learner.

### `validate_graph`

**Input:** `{ "graph": "<json string>" }`: a Nesso graph document (`concepts[]`, `relations[]`), not runtime React Flow `nodes`/`edges`.

**Output:** `{ "valid": boolean, "errors": [{ "path", "message" }], "warnings": [{ "path", "message" }] }`

Runs envelope and vocabulary validation plus structural checks the deserializer does not cover today: duplicate ids, dangling relation endpoints, unknown relation types. Warnings flag missing `vocabulary` or relation `type` (the app falls back to `causes` at render time).

`valid` is `true` only when `errors` is empty.

### `build_graph`

**Input:**

```json
{
  "name": "Photosynthesis",
  "concepts": [
    "Sunlight",
    {
      "text": "Chloroplast",
      "elaboration": { "definition": "..." }
    }
  ],
  "relations": [{ "from": "Sunlight", "to": "Chloroplast", "relation": "enables" }]
}
```

- `concepts`: label strings or objects with optional `id`, `text`, and `elaboration`.
- `relations`: `from` / `to` match concept `id` or label (must be unambiguous); `relation` must be a valid type id from `get_relation_types`.

**Output:** Pretty-printed graph document JSON ready to write to disk (includes `vocabulary`, generated ids, and dagre layout positions). FSRS review fields and React Flow edge shape (`type: "nesso"`, handles) are applied by the app on import, not stored in the file.
