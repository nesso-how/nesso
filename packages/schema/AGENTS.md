# @nesso/schema

- Define only the graph data model, its JSON-LD profile, and framework-independent utilities.
- Declare no runtime dependencies. Keep the package independent of the app and default vocabulary.
- The JSON-LD support is a fixed profile, not a general processor: canonical `schemaContext` only, no remote contexts or aliases — anything outside the profile is an error, never ignored.
- A valid graph survives `parseGraph(serializeGraph(…))` unchanged; keep the pipeline lossless.
- Everything crossing the boundary is validated: `parseGraph` and `serializeGraph` run `validateGraph` and throw `SchemaError` — no partial or unvalidated output.
- Keep package tests self-contained; do not load app data or fixtures.
