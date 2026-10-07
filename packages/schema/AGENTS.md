# @nesso/schema

- Define only the graph data model, its JSON-LD profile, and framework-independent utilities.
- Declare no runtime dependencies. Keep the package independent of the app and default vocabulary.
- Keep JSON-LD support limited to an inline context with canonical `rdf`, `rdfs`, and `position` mappings. Accept absolute predicates and local aliases mapped with `@type: '@id'` to known relation types; do not resolve remote contexts.
- Ignore other non-predicate context terms; reject unsupported document and graph-entry properties.
- Preserve concepts, relation definitions, positions, and relations through `parseGraph(serializeGraph(…))`; relation ordering is not significant.
- Everything crossing the boundary is validated: `parseGraph` and `serializeGraph` run `validateGraph` and throw `SchemaError` — no partial or unvalidated output.
- Keep package tests self-contained; do not load app data or fixtures.
