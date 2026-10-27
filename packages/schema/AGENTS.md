# @nesso-how/schema

See [README.md](README.md) for usage, the JSON-LD profile, and the public API overview.

- Define only the graph data model, its JSON-LD profile, and framework-independent utilities.
- Allow only `@nesso-how/errors` as a runtime dependency. Keep the package independent of the app and default vocabulary.
- Keep JSON-LD support local and limited to the documented profile; never resolve remote contexts.
- Validate parsing and serialization with `SchemaError` failures; preserve graph semantics across round trips and never return partial or unvalidated output.
- Keep package tests self-contained; do not load app data or fixtures.
