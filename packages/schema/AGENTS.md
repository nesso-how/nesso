# @nesso-how/schema

See [README.md](README.md) for usage, the JSON-LD profile, and the public API overview.

- Define only the graph data model, its JSON-LD profile, and framework-independent utilities.
- Use Zod for runtime schemas and derive graph types from them. Keep runtime dependencies limited to Zod and `@nesso-how/errors`, independent of the app and default vocabulary.
- Keep JSON-LD support local and limited to the documented profile; never resolve remote contexts.
- Validate parsing and serialization with `SchemaError` failures; preserve graph semantics across round trips and never return partial or unvalidated output.
- Keep package tests self-contained; do not load app data or fixtures.
