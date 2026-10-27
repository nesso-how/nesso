# @nesso-how/plugin

Types, validation, and asynchronous clients for isolated Nesso actions plus data-only vocabularies and themes.

The [standalone example](example/) is a real plugin published as [`@nesso-how/plugin-example`](https://www.npmjs.com/package/@nesso-how/plugin-example). You can try it from Settings → Plugins in the desktop app or use its source as a starting point for your own plugin.

## Create a plugin

- **Actions** export `create(context)`, returning `{ id, label, icon?, run }` records. See [Write an action](#write-an-action) and the [standalone example](example/README.md).
- **Vocabularies** ship a `VocabDefinition` JSON file with stable absolute relation-type IRIs and a default among their own types. See [Base Vocab](../../plugins/base-vocab).
- **Themes** ship a light-only `ThemeDefinition` JSON file with colors, metrics, and local WOFF2 fonts; arbitrary CSS and remote fonts are unsupported. See [Kernel](../../plugins/kernel-theme) and [Paper](../../plugins/paper-theme).

Actions build one self-contained browser JavaScript ES module with dependencies bundled. Nesso does not install dependencies, run package scripts, compile received source, or load module graphs. It validates vocabulary and theme JSON without executing it.

## Write an action

This module uppercases labels in the invoked view with one atomic write. It requires `writes: ['concept.label']` and `capabilities: []`.

```js
export function create({ store }) {
  return [{
    id: 'uppercase-labels',
    label: { en: 'Uppercase labels' },
    run: async () => {
      const state = await store.refresh()
      const operations = state.viewGraph.concepts.map(({ id, label }) => ({
        kind: 'concept.label',
        id,
        value: label.toUpperCase(),
      }))
      await store.applyOperations(operations, { atRevision: state.revision })
    },
  }]
}
```

`create(context)` returns an array of 1–64 actions, even for one. IDs are unique lowercase kebab-case strings of at most 64 characters; labels are localized text with an English fallback. The optional `icon` uses an [`ActionIconName`](src/runtime.ts); unknown values render as `zap`.

### Discovery and invocation

Discovery calls `create(context)` to collect descriptors without graph access, writes, files, or notifications. Keep document reads and effects inside `run`, not at module scope or in `create`.

Each invocation loads a fresh isolated worker, calls `create` again, verifies unchanged descriptors, and calls the selected `run({ viewId })`. The instance closes when `run` finishes: await all writes and host effects; return values are ignored. There is no persistent background instance.

## Action context

Nesso injects `{ store, files, notifications, signal }`; do not create a client or import the host store. TypeScript authors can bundle `ActionContext`, `ActionContribution`, and `NessoOperation` types from `@nesso-how/plugin`.

`signal` is a standard `AbortSignal` for the action instance. When the instance closes, `signal.aborted` becomes `true` and an `abort` event fires. Use it to stop ongoing work and avoid starting further writes or effects.

### Read state

| API | Behavior |
| --- | --- |
| `store.getState()` | Returns the latest local snapshot synchronously. Snapshots are readonly; mutating them does not change Nesso. |
| `await store.refresh()` | Returns a fresh host snapshot. Use before edits and after deferred work such as a file dialog. |
| `store.subscribe(listener)` | Returns an unsubscribe function. The listener receives no arguments; read with `getState()`. |

Discovery exposes only `revision`, `contextId`, `locale`, `theme`, and `conceptPlacementOffset`. Invocation adds:

| State field | Meaning |
| --- | --- |
| `viewGraph` | Host-materialized `{ concepts, relations, relationTypes }` for the invoked view. Concept and relation-type IDs are absolute IRIs; relations are `{ source, predicate, target }` triples without an `id`. |
| `selected` | Concept or relation selections in the invoked view. A relation ID is `JSON.stringify([source, predicate, target])`. |
| `targetViewId` | Invoked saved-view ID, or `null` for All. |
| `workspace` | `{ activeViewId, savedViews }`; saved-view summaries contain `{ id, name, pinned }`, and the active view may differ from the invoked view. |
| `activeVocab` | `{ id, relationTypes, defaultTypeId }`, or `null`. Preserve existing type IRIs. |
| `history` | `{ canUndo, canRedo }` metadata, not permission to invoke history. |

`ActionState` covers both phases; narrow with `'viewGraph' in state` when needed. The host's complete graph, preferences, renderer state, and store are not exposed.

`run({ viewId })` retains its target despite navigation; `null` exposes the complete graph. Saved views share concepts, so edits appear in every view containing them. Deleting the target view or resetting the document revokes the context.

### Write state

Every write is asynchronous and requires its declared operation kind:

| Helper | Required `writes` entry |
| --- | --- |
| `setConceptLabel(id, value)` | `concept.label` |
| `setConceptDescription(id, value)` | `concept.description` |
| `setConceptColor(id, value)` | `concept.color` |
| `setConceptBold(id, value)` | `concept.bold` |
| `setConceptItalic(id, value)` | `concept.italic` |
| `setConceptPosition(id, { x, y })` | `concept.position` |
| `setConceptPositions([{ id, position: { x, y } }])` | `concept.positions` |
| `addConcept(position?)` | `concept.add` |
| `removeConcept(id)` | `concept.remove` |
| `connect(source, target)` | `relation.connect` |
| `reconnectRelation(id, source, target)` | `relation.reconnect` |
| `setRelationType(id, typeId)` | `relation.type` |
| `createRelationType(id, label)` | `relation.type.create` |
| `removeRelation(id)` | `relation.remove` |
| `setSelection([{ kind, id }])` | `selection.set` |
| `setViewMembership(viewId, conceptId, included)` | `view.membership` |

Await helpers on `store`. `addConcept` resolves to the new IRI; other helpers return no value. Relation IDs identify existing triples. `createRelationType` also assigns the new type to that relation, while `connect` uses the active vocabulary's default. New concepts join the active saved view and, with exactly one concept selected, link to it using that default.

For multiple edits, prefer `store.applyOperations(operations, { atRevision: state.revision })`. Operations follow `NessoOperation`: `concept.add` needs an explicit new absolute IRI, and `relation.connect` accepts an optional `{ id, label }` type. The complete ordered batch is validated atomically and resolves to `{ revision, changed }`.

`state.revision` is local to the action instance, not a persisted document version. A stale `atRevision` rejects with `stale-state` and applies nothing; without it, the batch uses current state. Never retry mutations automatically. Separate write calls are separate transactions.

The invoked view is **not a write sandbox**: declared writes can affect the whole document, and undeclared operations are rejected. Reset, history, view management/navigation, preferences, viewport, and renderer APIs are unavailable.

### Files, notifications, and failures

| API | Required capability | Result |
| --- | --- | --- |
| `files.open({ extensions: ['json'], mimeTypes: ['application/json'] })` | `files.open` | `{ name, mediaType, text }`, or `null` on cancellation. Extensions omit the dot. |
| `files.save({ name: 'graph.json', mediaType: 'application/json', text })` | `files.save` | `{ saved: boolean }`; cancellation returns `false`. |
| `notifications.notify({ tone: 'info', title: { en: 'Done' }, description: { en: 'Labels updated' } })` | `notifications.notify` | A notification ID. Tone is `info` or `warning`; description is optional. |

Await these host-mediated effects. Files are UTF-8 text up to 16 MiB; arbitrary paths, filesystem, clipboard, network, navigation, and host UI are unavailable. Refresh state after a file dialog before computing edits.

Host requests reject with `PluginError`, containing `code` and bounded `{ path, message }[]` issues. Authors can throw it with an optional localized display message. Let failures propagate instead of reporting success. File and notification effects cannot be rolled back with document transactions.

## Manifest and translations

Use the [example package.json](example/package.json). Package names are valid npm names and versions exact SemVer. All technical declarations under `nesso` are required:

| `nesso` field | Supported value |
| --- | --- |
| `apiVersion` | `1` |
| `kind` | `actions`, `vocab`, or `theme` |
| `entry` | Package-local `.js` for actions or `.json` for themes/vocabularies |
| `writes` | Unique operation kinds from the helper table |
| `capabilities` | Unique subset of `files.open`, `files.save`, `notifications.notify` |

Themes and vocabularies require empty `writes` and `capabilities`; unknown declarations are rejected. Contribution IDs are unique by kind.

`i18n.metadata` requires localized `name`, `description`, and `documentation`. `LocalizedText` has `{ en: string, it?: string, 'zh-CN'?: string }` shape, with English fallback. Use it for action labels, notification text, and `PluginError` display messages; diagnostic issues remain strings. Bundle JSON imports at build time.

## Installation and isolation

External installation is desktop-only; web runs bundled plugins. Publish versioned npm packages: installation pins an exact version and revalidates received files. Approval covers the exact code and access declarations before any execution; failed updates retain the previous installation. For local development, use the example's `propose` call.

Plugins receive no Node, host DOM, credentials, arbitrary filesystem, or network access. Actions use interruptible workers, and the host revokes effects before teardown. This does not guarantee hard CPU/RAM containment or host responsiveness.

## SDK development

```sh
pnpm --dir packages/plugin build
pnpm --dir packages/plugin pack --pack-destination /absolute/output
```

Use **pnpm pack** so workspace exports become compiled ESM and declarations. The SDK exposes `@nesso-how/plugin` for authors, `/runtime` for validation/client code, and `/package` for package tooling, without other workspace dependencies.

See `src/runtime.ts`, `src/definitions.ts`, and `test/` for the complete contract and limits. Run `pnpm test` for contract tests and `pnpm test:plugin-runtime` for desktop/web integration checks.
