# @nesso/plugin

Types-only definitions for Nesso's plugin system.

## Create a plugin

A plugin declares the operation kinds it needs and returns renderers, vocabularies, actions, or themes from `create({ store })`.

Save this minimal action plugin as `src/example-plugin.ts`:

```ts
import type { Plugin } from '@nesso/plugin'

export const examplePlugin: Plugin = {
  operations: ['concept.label'],
  create: ({ store }) => ({
    actions: [{
      id: 'rename-selected',
      label: () => 'Rename selected concept',
      run: () => {
        const selected = store.getState().selected
        if (selected.length === 1 && selected[0].kind === 'concept') {
          store.setConceptLabel(selected[0].id, 'Renamed')
        }
      },
    }],
  }),
}
```

### Register it

Import `examplePlugin` from `./example-plugin` in [`src/plugins.ts`](../../src/plugins.ts) and append it to the existing `plugins` array. Plugins are registered statically and bundled with the app.

Run `pnpm dev`, select one concept, and choose **Rename selected concept** from the navbar's **Graph menu**.

### Add a renderer

Renderer components subscribe to their injected store instance with `useSyncExternalStore`:

```tsx
import type { Plugin } from '@nesso/plugin'
import { useSyncExternalStore } from 'react'

export const exampleRendererPlugin: Plugin = {
  operations: [],
  create: ({ store }) => ({
    renderers: [{
      id: 'example',
      label: 'Example',
      component: function ExampleRenderer() {
        const selected = useSyncExternalStore(store.subscribe, () => store.getState().selected)
        return <div>{selected.length} selected</div>
      },
    }],
  }),
}
```

When displaying a graph, subscribe to `state.viewGraph`; the host already materializes the active view.

## Contract

Use only the store injected into `create`; do not import host internals or keep a shared store at module scope. State snapshots, contributions, and operations are readonly. Read current state when an action runs; `selected` is an array of concept/relation references.

Saved views hold concept IDs and pin metadata; `workspace.activeViewId: null` means the complete graph. Registration and persistence diagnostics remain internal to the host.

### Writes

- Declare only needed operation kinds in `operations`. The host copies the allowlist before initialization; every write helper delegates to `applyOperations` and follows the same check. Undeclared writes reject the whole batch. Empty declarations grant no writes, but reads and subscriptions remain available. This is not a security sandbox.
- `applyOperations` evaluates state writes in order, validates the final candidate, and publishes at most once. Invalid batches throw structured `SchemaError` or host errors; no-ops do not notify.
- Creation and reset operations require explicit stable IDs, generated with `newIri` from `@nesso/schema`; convenience helpers generate them. New concepts join the view active at their creation. Reuse the host's `conceptPlacementOffset` when placing concepts near the selection.
- `reconnectRelation` preserves the predicate and updates selection; unchanged endpoints, self-connections, and duplicates are no-ops.
- `getViewGraph(id)` asks the host for a saved view without activating it.

### History

Declare `history.undo` or `history.redo` to use the matching helper. Each must be alone in its call; mixed batches are rejected before changing state or history. Commands control shared document history, including host and other plugins' edits, without requiring the original edit kinds.

History includes graph and saved-view edits, not navigation, selection, viewport, or preferences. Undo/redo restore recorded effects without replaying requests or recording a new edit; empty history is a no-op.

Pass `{ historyGroup: string }` to coalesce adjacent label/position writes from one interaction. Use a fresh ID per text session or drag; this metadata never grants write access.

### Contributions and locale

- Actions are `{ id, label(locale), run }`; the host passes its active locale when displaying labels.
- `preferences.locale` supports English and Italian, defaulting to English when unset. `setLocale` requires `preferences.locale` in the operation declaration. Use [@nesso/i18n](../i18n/README.md) with your own JSON catalogs.
- A vocabulary's `defaultTypeId` must be one of its own relation types.
- Themes contribute ID/label metadata. Import CSS statically and scope tokens to `:root[data-theme='<id>']`; the host applies the active theme to the DOM.

## Reference

See [src/types.ts](src/types.ts) for state, operation, contribution, and store method definitions.
