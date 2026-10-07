# @nesso/plugin

Types-only plugin contract for Nesso. Plugins use the injected store, without importing app internals.

## Usage

```ts
import type { Plugin } from '@nesso/plugin'

export const examplePlugin: Plugin = {
  operations: ['concept.label'],
  create: ({ store }) => ({
    vocabs: [{
      id: 'example',
      label: 'Example',
      relationTypes: [{ id: 'urn:example:related', label: 'related' }],
      defaultTypeId: 'urn:example:related',
    }],
    actions: [{
      id: 'rename-selected',
      label: 'Rename selected concept',
      run: () => {
        const selected = store.getState().selected
        if (selected?.kind === 'concept') store.setConceptLabel(selected.id, 'Renamed')
      },
    }],
  }),
}
```

Register plugins in the static list in the host (`src/plugins.ts`).

Renderers subscribe to the injected store with `useSyncExternalStore`:

```tsx
import { useSyncExternalStore } from 'react'

export const exampleRendererPlugin: Plugin = {
  operations: [],
  create: ({ store }) => ({
    renderers: [{
      id: 'example',
      label: 'Example',
      component: function ExampleRenderer() {
        const selected = useSyncExternalStore(store.subscribe, () => store.getState().selected)
        return <div>{selected?.id ?? 'No selection'}</div>
      },
    }],
  }),
}
```

## API

- `Plugin`: required readonly `operations: NessoOperation['kind'][]` and factory `create(context: PluginContext): PluginDefinition`. Declare only the explicit writes needed; `operations: []` grants no writes.
- `PluginContext`: supplies a host-created `NessoStore` scoped to the plugin's declaration before `create` runs. The host snapshots the allowlist and rejects an entire batch containing undeclared operations with structured host errors. Helpers use the same check. Reads and subscriptions remain available. This controls store commands, not network access or other plugin code, and is not a security sandbox.
- `PluginDefinition`: optional `renderers`, `vocabs`, `actions`, and `themes` contributions.
- `NessoState`: readonly graph, workspace, preferences, visible graph, selection, vocabulary definitions, and history flags.
- `conceptPlacementOffset`: readonly host-provided offset for placing new concepts near the selection, shared by domain writes and renderers.
- `reconnectRelation`: change a relation's endpoints atomically, preserving its predicate and updating selection; unchanged endpoints, self-connections, and duplicates are no-ops.
- `NessoStore`: read/subscribe, graph and view editing, navigation, viewport, preferences, document reset, and host-owned undo/redo. Every write helper, including `undo` and `redo`, delegates to `applyOperations`; `getViewGraph` asks the host to materialize a saved view without activating it.
- `applyOperations`: ordered state writes, validated and committed atomically or rejected with structured `SchemaError` or host errors; no-ops do not notify. Creation and reset operations require explicit IDs, generated with `newIri` from `@nesso/schema`. Registration and persistence diagnostics stay internal.
- `NessoOperation`: readonly writes for concepts, relations, views, selection, viewport, preferences, reset, and history. State writes read the preceding candidate state; new concepts join the view active at their creation. Only the final state is published. The host records graph and saved-view effects for undo/redo, not navigation or preferences.
- `history.undo` and `history.redo`: declare these operation kinds to control the shared document history, including edits made by the host or other plugins. Each must be the only operation in its call; batches containing history alongside any other operation are rejected before changing state or history. Undo/redo restore recorded deltas without replaying original requests or recording a new edit. They do not require declarations for the original edit kinds, and an empty history is a no-op.
- `applyOperations` accepts optional `{ historyGroup: string }` metadata to coalesce adjacent label/position edits in one interaction. Use a fresh ID for each text session or drag. Metadata does not bypass operation declarations; undo/redo commands remain host-owned.
- `RendererDefinition`, `VocabDefinition`, `ActionDefinition`: contribution shapes. Actions are `{ id, label, run }` commands; renderer components use the injected store.
- `SavedView`: readonly named concept set with pin metadata. `WorkspaceState` holds saved views, the active view id, and renderer viewports; null active view means the complete graph.
- `ThemeDefinition`: id and label. Statically imported CSS scopes tokens to `:root[data-theme='<id>']`; theme activation uses the store and DOM application stays in the host.

See [`src/types.ts`](src/types.ts) for all exported types and method signatures.
