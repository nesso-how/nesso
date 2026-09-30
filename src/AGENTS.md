# Host

- Keep Zustand state data-only in `src/store`; methods live on `NessoStore`, with `useNessoStore` for React.
- All graph edits share one commit boundary: validate with `validateGraph`, reject atomically with `SchemaError`, then reconcile focus/selection. Keep at least one concept; deletion removes incident relations. No blanket normalization or pruning unused types.
- Materialize `viewGraph` (focus neighborhood or whole document) in the commit boundary and on `setFocus`/`setView`; it is the single writer. `setFocus` implies focus view.
- Use static registration and small lookups; no lifecycle, runtime loading, uninstall, permissions, or event bus. Allow multiple renderers/vocabs, validate registration/activation, and keep one valid active id for each in state; renderer components stay in the registry.
- Vocabulary switching never rewrites the graph; using a new type adds its definition atomically.
- Editing forms live in the Inspector; the canvas exposes only selection-scoped commands (add concept, delete selected) and gestures, all mapped to domain writes — no forms in plugins.
