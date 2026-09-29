# Nesso-min

- Keep this a minimal, light-only knowledge graph app. Prefer removing complexity over adding abstractions.
- Maintain one `@nesso/schema` Graph in the Zustand store. React Flow nodes and edges are app-side views; the canvas shows the focused concept and its direct neighbors, and selecting an item does not change focus.
- Concepts have tags; relations are directed and use types with stable IRIs. `@nesso/vocab` supplies defaults, while users can name new types. New concepts link to the focus with `linksTo`, which appears unlabeled.
- The Explorer groups concepts by tag (including Untagged); multiple selected tags filter with AND. Edit the selected item in the Inspector, or the focused concept when nothing is selected.
- Keep edits in memory; `data/sample-graph.json` is the self-contained JSON-LD starting graph, including positions. Keep `@nesso/schema` independent of the app and the default vocabulary.
- Write UI, code, and documentation in English. Do not add comments to code.
- Use TypeScript for source code, tests, and scripts (`.ts`, or `.tsx` for JSX). Use JavaScript only when a tool does not support TypeScript; keep data and documentation in their native formats.
- Report failures with a package-scoped `<Package>Error extends Error` carrying `readonly issues: { path: string; message: string }[]`, joined into the error message (see `SchemaError` in `@nesso/schema`). Reuse this shape in future packages; keep packages dependency-free.
- Check changes with `pnpm build` and `pnpm lint`. Stage changes for review, and do not commit until the user has reviewed the diff and explicitly approves.
