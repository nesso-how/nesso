# Nesso-min

- Keep the app minimal and light-only. Edits stay in memory; `data/sample-graph.json` is the self-contained JSON-LD starting graph, including positions.
- Concepts have tags; relations are directed with stable type IRIs. Users may name new types. New concepts link to the focus with the active vocabulary's default type (`linksTo` for Nesso), displayed unlabeled.
- Explorer groups concepts by tag, including Untagged; tag filters use AND. Selection never changes focus. Inspector edits the selection, falling back to the focused concept.
- Use English and TypeScript for code, tests, and scripts; JavaScript only when required by tooling. Keep data and documentation in native formats. No code comments.
- Report failures with a package-scoped `<Package>Error extends Error` carrying `readonly issues: { path: string; message: string }[]`, joined into the message; follow `SchemaError`.
- Libraries in `packages/` have no runtime dependencies; type-only imports require peer + dev dependencies. Plugins in `plugins/` may declare runtime dependencies. Keep `@nesso/schema` independent of the app and default vocabulary.

## Architecture

- The host (`src/`) owns one Graph, its store, and plugin registration; `@nesso/plugin` owns shared contracts. Relation identity is source+predicate+target (`relationKey`).
- Plugins use only the injected store, never app internals or a concrete store. Keep instances isolated; no module-global mutable store. React subscriptions use the injected instance with `useSyncExternalStore`.
- State holds the whole document (`graph`) plus the visible portion (`viewGraph`: focused neighborhood or whole graph, user-chosen via `view`). The host materializes `viewGraph`; plugins never recompute it. Actions are `{ id, label, run }` commands rendered as navbar buttons, reading current state at invocation; the shell owns editing forms, the canvas only selection-scoped commands and gestures.
- React Flow components, types, and event mapping stay in `plugins/graph`; the host never imports it.
