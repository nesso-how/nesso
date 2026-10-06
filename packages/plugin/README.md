# @nesso/plugin

Types-only plugin contract for Nesso. Plugins use the injected store, without importing app internals.

## Usage

```ts
import type { Plugin } from '@nesso/plugin'

export const examplePlugin: Plugin = ({ store }) => ({
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
})
```

Register plugins in the static list in the host (`src/plugins.ts`).

Renderers subscribe to the injected store with `useSyncExternalStore`:

```tsx
import { useSyncExternalStore } from 'react'

export const exampleRendererPlugin: Plugin = ({ store }) => ({
  renderers: [{
    id: 'example',
    label: 'Example',
    component: function ExampleRenderer() {
      const selected = useSyncExternalStore(store.subscribe, () => store.getState().selected)
      return <div>{selected?.id ?? 'No selection'}</div>
    },
  }],
})
```

## API

- `Plugin`: factory `(context: PluginContext) => PluginDefinition`.
- `PluginContext`: supplies the host-created `NessoStore`.
- `PluginDefinition`: optional `renderers`, `vocabs`, `actions`, and `themes` contributions.
- `NessoState`: readonly graph, workspace, preferences, visible graph, selection, and vocabulary definitions.
- `NessoStore`: read/subscribe, graph editing, navigation, viewport, and active-plugin commands. Single-write methods delegate to `applyOperations`.
- `applyOperations`: ordered graph writes, validated and committed atomically or rejected with `SchemaError`; no-ops do not notify. Creation operations require explicit IDs, generated with `newIri` from `@nesso/schema`.
- `GraphOperation`: readonly domain writes for concepts and relations.
- `RendererDefinition`, `VocabDefinition`, `ActionDefinition`: contribution shapes. Actions are `{ id, label, run }` commands; renderer components use the injected store.
- `SavedView`: readonly named concept set with pin metadata. `WorkspaceState` holds saved views, the active view id, and renderer viewports; null active view means the complete graph.
- `ThemeDefinition`: id and label. Statically imported CSS scopes tokens to `:root[data-theme='<id>']`; the host owns the active theme preference and DOM application.

See [`src/types.ts`](src/types.ts) for all exported types and method signatures.
