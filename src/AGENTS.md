# Host

## Store

- Keep Zustand state data-only in `src/store`; methods live on `NessoStore`, with `useNessoStore` for React.
- Route all public writes through `applyOperations`, including undo/redo. Keep registration and persistence diagnostics internal.
- Collapsed sections are optional preferences with stable IDs; unspecified sections are open. Share their state across selections and documents.

## Transactions and history

- Apply ordered `NessoOperation` writes to immutable graph, workspace, preference, and selection candidates. Validate the final state and publish at most once; empty, unchanged, and cancelling batches do not notify.
- Preserve references to unchanged parts. Copy each edited list once per batch and record touched entities as history deltas; keep full graph validation.
- Validate graph edits with `validateGraph`, reject atomically with `SchemaError`, then reconcile selection. Cancelled graph changes discard implicit selection effects without discarding explicit selection or navigation.
- Creation and reset operations require explicit stable IDs; convenience methods generate them. New concepts join the view active at their operation.
- Keep at least one concept; deletion removes incident relations. Remove non-vocabulary relation types when their last use in the whole graph is removed or retyped, preserving unrelated unused definitions. No blanket normalization.
- Update `viewGraph` in the commit boundary and on view/membership changes. Membership edits preserve off-view selection; graph deletion prunes saved memberships atomically.
- Vocabulary switching never rewrites the graph; using a new type adds its definition atomically.
- Keep up to 100 document deltas in host-owned memory. Include graph and saved-view edits, including pins; exclude navigation, selection, viewport, and preferences.
- Expose history flags and declared `history.undo`/`history.redo` commands through the injected store. Each history operation must be alone in its call; reject mixed batches before changing state or history. Commands control the shared document history, not only a plugin's edits.
- Restore recorded effects exactly without replaying domain requests, automatic cleanup, or recording a new edit. Preserve valid current navigation and reconcile selection.
- New document edits clear redo; reset clears all history even when batched with other state writes. Explicit interaction IDs group adjacent label/position writes.

## Persistence

- Persist versioned document/workspace and preference records separately using localStorage. Validate restoration before autosave, resolve active plugin IDs during registration, debounce durable changes, and flush on page hide.
- Never overwrite unreadable records. Report storage failures visibly and keep editing available in memory.
- `src/data/seed-graph.json` and `seed-views.json` seed only the first document. Legacy deleted records and unreadable documents start with one fresh concept instead.
- `resetGraph` atomically creates a fresh single-concept graph with no saved views, preserving preferences. Do not persist history.

## Plugins and UI

- Use static registration and small lookups; no lifecycle, runtime loading, uninstall, dynamic permission system, or event bus.
- Snapshot each plugin's operation allowlist before initialization and check the whole batch before applying it. Host and plugin stores share command helpers; no helper bypasses the check.
- Support multiple renderer, vocabulary, and theme definitions. Validate registration and activation, keeping one valid active ID for each registered kind; renderer components stay in the registry.
- Keep app-specific components in `src/components/app`. Concept/relation editing and membership forms live in the Inspector; view creation lives in the Explorer. Map canvas commands and gestures to domain writes.
- Keep canvas undo/redo controls next to delete.
