# Nesso-min

- Do not add backward-compatibility code or migration ladders.
- Keep the app light-only. Prefer the smallest clear implementation that satisfies the requirements. Reuse existing code; avoid unnecessary abstractions, duplication, and redundant tests. Minimize code without sacrificing readability, correctness, or essential coverage.
- Never model views as graph copies or tags; Complete graph is non-deletable. Keep relation type IRIs stable. New concepts link only to a selected concept with the active vocabulary's default type, displayed unlabeled; otherwise they start disconnected. New concepts join the active saved view.
- Explorer groups views by pinned status; pinning and collapsing never change scope. Selection never changes view membership. There is no persistent concept focus. Inspector closes without a selection.
- Use English and TypeScript for code, tests, and scripts; JavaScript only when required by tooling. Keep data and documentation in native formats. No code comments.
- Report failures with a package-scoped `<Package>Error extends Error` carrying `readonly issues: { path: string; message: string }[]`, joined into the message; follow `SchemaError`.

## Architecture

- Plugins use only the injected store, never app internals or a concrete store. Keep instances isolated; no module-global mutable store. React subscriptions use the injected instance with `useSyncExternalStore`.
- Only the host materializes `viewGraph`; plugins never recompute it. Selection, plugin definitions, and `viewGraph` are not persisted. Navbar actions read current state at invocation; the app interface owns editing forms and reset confirmation, the canvas only selection-scoped commands and gestures.
- React Flow components, types, event mapping, and renderer-specific styles stay in `plugins/graph`; the host never imports React Flow. The graph plugin consumes theme tokens without depending on `@nesso/ui`.
