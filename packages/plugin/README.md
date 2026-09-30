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
    id: 'rename-focus',
    label: 'Rename focus',
    run: () => store.setConceptLabel(store.getState().workspace.focusId, 'Renamed'),
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
      const focusId = useSyncExternalStore(store.subscribe, () => store.getState().workspace.focusId)
      return <div>{focusId}</div>
    },
  }],
})
```

## API

- `Plugin`: factory `(context: PluginContext) => PluginDefinition`.
- `PluginContext`: supplies the host-created `NessoStore`.
- `PluginDefinition`: optional `renderers`, `vocabs`, and `actions` contributions.
- `NessoState`: readonly graph, workspace, preferences, visible graph, selection, and vocabulary definitions.
- `NessoStore`: read/subscribe, graph editing, navigation, viewport, and active-plugin commands. Single-write methods delegate to `applyOperations`.
- `applyOperations`: ordered graph writes, validated and committed atomically or rejected with `SchemaError`; no-ops do not notify. Creation operations require explicit IDs, generated with `newIri` from `@nesso/schema`.
- `GraphOperation`: readonly domain writes for concepts and relations.
- `RendererDefinition`, `VocabDefinition`, `ActionDefinition`: contribution shapes. Actions are `{ id, label, run }` commands; renderer components use the injected store.

See [`src/types.ts`](src/types.ts) for all exported types and method signatures.
