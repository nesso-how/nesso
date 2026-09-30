# @nesso/plugin

Types-only plugin contract for Nesso. The host owns the concrete store — a Zustand vanilla store living outside React — and injects it into each plugin; plugins never import app code or a store implementation.

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
    run: () => store.setConceptLabel(store.getState().focusId, 'Renamed'),
  }],
})
```

Register plugins in the static list in the host (`src/plugins.ts`).

If you are building a renderer plugin, React is the only place it shows up: the component closes over the injected store and subscribes to it with `useSyncExternalStore` — no React context or state library required on your side.

```tsx
import { useSyncExternalStore } from 'react'

export const exampleRendererPlugin: Plugin = ({ store }) => ({
  renderers: [{
    id: 'example',
    label: 'Example',
    component: function ExampleRenderer() {
      const focusId = useSyncExternalStore(store.subscribe, () => store.getState().focusId)
      return <div>{focusId}</div>
    },
  }],
})
```

## API

- `Plugin`: factory `(context: PluginContext) => PluginDefinition`.
- `PluginContext`: supplies the host-created `NessoStore`.
- `PluginDefinition`: optional `renderers`, `vocabs`, and `actions` contributions.
- `NessoState`: deeply readonly snapshot — whole graph, visible graph (`viewGraph`), view mode, focus, selection, vocabs, active ids.
- `NessoStore`: read/subscribe plus domain writes; `editGraph` candidates are validated and committed atomically or rejected with `SchemaError`.
- Domain writes preserve unchanged graph objects. `setConceptPositions([{ id, position }])` applies a position batch atomically with one notification; repeated ids use the last position, unknown ids and unchanged positions are ignored. `setConceptPosition` uses the same path. Every graph commit still validates the whole document and materializes `viewGraph`.
- `setRelationType(relationId, typeId)` selects an existing document or active-vocabulary type by IRI; `createRelationType(relationId, label)` creates and assigns a new type atomically. Labels need not be unique.
- The host owns copies of registered vocabularies and `editGraph` results; mutating their original inputs or retained drafts cannot change published state.
- `RendererDefinition`, `VocabDefinition`, `ActionDefinition`: contribution shapes; actions are `{ id, label, run }` commands reading current state at invocation.
