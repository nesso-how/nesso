# Nesso Plugin SDK

Build Nesso plugins with TypeScript: **actions** read and edit graphs, **vocabularies** define relation types, and **themes** customize appearance.

## Install

With Node.js and npm installed, add the SDK to your TypeScript project:

```sh
npm install --save-dev @nesso-how/plugin
```

This installs the development SDK, not a plugin in Nesso. If you are starting a new plugin, use the example below for TypeScript and bundler configuration, including React UI support. To install and try your built plugin in the desktop app, follow the [local testing instructions](example/README.md#test-an-unpublished-build).

## Create a plugin

Copy the [standalone action example](example/) into a separate project. It includes the SDK, TypeScript configuration, and bundler setup:

```sh
npm install
npm run build
```

Choose your own package name and action ID, then edit `src/index.ts`:

```ts
import type { ActionContribution, NessoOperation } from '@nesso-how/plugin'

export const create = (): readonly ActionContribution[] => {
  const action: ActionContribution = {
    id: 'uppercase-labels',
    label: { en: 'Uppercase labels' },
    run: async ({ document }) => {
      const state = document.getState()

      const operations: readonly NessoOperation[] = state.viewGraph.concepts.map(
        ({ id, label }) => ({
          kind: 'concept.label',
          id,
          value: label.toUpperCase(),
        }),
      )

      await document.applyOperations(operations)
    },
  }

  return [action]
}
```

This changes labels in the invoked view in one undoable batch. Shared concepts change in every view containing them.

How the example works:

- `create()` defines the actions. Nesso supplies the execution context to `run`, where graph data is always available.
- `applyOperations` takes an array of edits. Here, `.map()` creates one `concept.label` edit per concept, with its ID and new label.
- Writes automatically check that the snapshot you read is still current. If it changed, the entire batch is rejected rather than overwriting newer edits.

### Package metadata and permissions

Keep the example's build configuration and set these fields in `package.json`:

```json
{
  "name": "nesso-plugin-my-action",
  "version": "1.0.0",
  "keywords": ["nesso-plugin"],
  "nesso": {
    "apiVersion": 2,
    "kind": "actions",
    "entry": "dist/index.js",
    "writes": ["concept.label"],
    "capabilities": []
  },
  "i18n": {
    "metadata": {
      "name": { "en": "Label tools" },
      "description": { "en": "Uppercase concept labels in a view." },
      "documentation": { "en": "Updates labels in one undoable batch." }
    }
  }
}
```

Declare the operations your action uses in `writes`. The optional permissions listed in `capabilities` are `files`, `notifications`, `storage`, and `ui`. The first three authorize their APIs; `ui` authorizes interactive UI contributions. All fields shown under `nesso` and `i18n.metadata` are required. Add the `nesso-plugin` keyword for discovery in Settings → Plugins.

API version, npm SDK version, host storage envelope version, and private payload versions remain independent: bump only what your change affects.

`i18n.metadata.name` names the plugin in Settings. Each action defines its own `label` for menus, independently of the plugin name. Labels and metadata use `{ en: string, it?: string, 'zh-CN'?: string }`, with English required as the fallback.

### Build and test

Run `npm run build`, then follow the example's [local testing instructions](example/README.md#test-an-unpublished-build).

Actions ship one browser ES module with dependencies bundled except React and React DOM, which Nesso supplies inside the sandbox. Keep `react`, `react/*`, `react-dom`, and `react-dom/*` external in your bundler; the example's build handles this. The runtime supports React 19. Test and install external plugins in the desktop app.

## Action API

Nesso passes `{ document, storage, files, notifications, signal, viewId }` to `run` as `ActionContext`. `document` exposes the shared graph, view membership, and transient selection; `storage` holds the plugin's private data for that document.

`create()` receives no arguments and returns an array of actions with unique lowercase kebab-case IDs, localized labels, optional icons, and either a `run(context)` handler or a React component in `ui`. The two forms are mutually exclusive. Use `ActionIconName` for supported icons.

Keep graph reads and effects inside `run`. **Await every write, file dialog, and notification** before returning; the action ends when `run` finishes. Use `signal` to detect cancellation.

### Action UI

Declare the `ui` capability and set the action's `ui` property to a React component instead of a `run` handler. Nesso mounts it in an isolated central panel and unmounts it when the session ends.

```tsx
import { useSyncExternalStore } from 'react'
import type { ActionContext, ActionContribution } from '@nesso-how/plugin'

function Browse({ document }: ActionContext) {
  const state = useSyncExternalStore(document.subscribe, document.getState)
  return (
    <ul>
      {state.viewGraph.concepts.map(({ id, label }) => (
        <li key={id}>{label}</li>
      ))}
    </ul>
  )
}

export const create = (): readonly ActionContribution[] => [
  { id: 'browse', label: { en: 'Browse concepts' }, ui: Browse },
]
```

#### Context

Components receive `ActionContext` directly as props, with the same APIs and permissions as `run`. `viewId` and the supplied `viewGraph` refer to the invoked view. Subscribe with `useSyncExternalStore` when rendering snapshot data. Discovery runs `create()` in a Worker, so keep DOM access and effects inside components or `run`, not at module scope or in `create()`. The panel can access its own DOM, but not the host DOM, native bridge, network, or direct persistent storage; use the injected APIs for files and storage.

#### Styling

Nesso supplies React, the `@nesso-how/ui` component stylesheet, and theme CSS variables such as `var(--background)` and `var(--foreground)`. Import your own CSS normally; the [standalone example](example/) bundles and injects it. Bundle dependencies other than React/React DOM and inline assets; remote or separate assets are not supported. The host does not compile plugin Tailwind classes. Read `locale` from `document.getState()` for translated content. Label inputs and preserve Tab/Shift+Tab navigation.

#### Lifecycle

Use React effects to clean up subscriptions and resources. Panels have no action execution timeout, but initialization and API requests have deadlines. Uncaught errors or rejected promises fail the session; handle expected errors in your UI. Nesso provides the title, close control, and loading/failure screens. Each opening or active-view change revokes the previous channel and context and mounts a fresh React instance. Nesso preloads and retains sandboxes for a subset of built-in plugins, without a context or host channel until opened. Other sandboxes are discarded when their session ends. All sandboxes are discarded on failure, plugin replacement/removal, document change, or app unmount. Keep module scope free of mutable state and effects. Save progress through `storage` during use, not during cleanup, which is best effort.

### Action badges

Add optional `badge(input)` to a `run` or `ui` action. It may return synchronously or asynchronously:

```ts
badge: ({ viewGraph }) => ({
  value: viewGraph.concepts.length,
})
```

- `input`: readonly `viewId` (`null` for All), target `viewGraph`, private document storage `records` (requires `storage`; otherwise empty), and `now` in Unix milliseconds.
- Return `{ value: number | null, refreshAt?: number }`. `value` is an integer from 0 to 999,999; zero and `null` hide the badge.
- For time-dependent counts, calculate from `now` and return `refreshAt` as an absolute Unix-millisecond timestamp. Omit it otherwise. Timed refreshes run no more often than every 15 seconds.

Runs in an isolated Worker with no action APIs and a 2-second calculation limit. Nesso calculates only visible badges and refreshes them after graph, saved-view, or plugin storage changes. Results are not persisted; failures hide the badge.

### Read the invoked view

- `document.getState()` returns the latest readonly local snapshot synchronously and makes it the basis for subsequent writes.
- `await document.refresh()` fetches and reads a fresh snapshot. Use it after deferred work, such as a file dialog, before computing edits.
- `document.subscribe(listener)` notifies you of snapshot changes and returns an unsubscribe function. Read the new state with `getState()`.

The graph snapshot provides:

- `viewGraph`: `{ concepts, relations, relationTypes }` for the invoked view.
- `selected`: the invoked view's selection.
- `targetViewId`: the invoked view's ID, or `null` for All; fixed for each invocation. Headless actions keep their target during navigation; panels restart with a new invocation when the active view changes.
- `activeVocab`: the current vocabulary, or `null`.

Concept and relation-type IDs are absolute IRIs. Relations are `{ source, predicate, target }` triples; use `JSON.stringify([source, predicate, target])` as their selection/write ID.

### Write the graph

Call helpers on `document` and declare their operation kinds in `nesso.writes`:

| Helper                                              | Required `writes` entry |
| --------------------------------------------------- | ----------------------- |
| `setConceptLabel(id, value)`                        | `concept.label`         |
| `setConceptNotes(id, value)`                        | `concept.notes`         |
| `setConceptColor(id, value)`                        | `concept.color`         |
| `setConceptBold(id, value)`                         | `concept.bold`          |
| `setConceptItalic(id, value)`                       | `concept.italic`        |
| `setConceptPosition(id, { x, y })`                  | `concept.position`      |
| `setConceptPositions([{ id, position: { x, y } }])` | `concept.positions`     |
| `addConcept(position?)`                             | `concept.add`           |
| `removeConcept(id)`                                 | `concept.remove`        |
| `connect(source, target)`                           | `relation.connect`      |
| `reconnectRelation(id, source, target)`             | `relation.reconnect`    |
| `setRelationType(id, typeId)`                       | `relation.type`         |
| `createRelationType(id, label)`                     | `relation.type.create`  |
| `removeRelation(id)`                                | `relation.remove`       |
| `setSelection([{ kind, id }])`                      | `selection.set`         |
| `setViewMembership(viewId, conceptId, included)`    | `view.membership`       |

`addConcept` returns the new IRI. New concepts join the active saved view and link to the single selected concept, if any. These links and `connect` use the vocabulary's default relation type. `createRelationType` creates and assigns a type to the given relation.

For related edits, use `document.applyOperations(operations)` as in the quickstart. The entire batch succeeds or changes nothing. Editing, reconnecting, retyping, or removing an unknown concept or relation rejects the batch, as does reconnecting or retyping onto an existing relation; removing an item already removed earlier in the same batch, such as a relation of a removed concept, is allowed. Separate calls are separate transactions. Raw `concept.add` operations require an explicit new absolute IRI.

Every write checks against the last snapshot you read, or the initial snapshot if you haven't read one. Successful writes advance that baseline, so awaited sequential writes work normally. Incoming updates alone do not advance it. A conflict rejects with `stale-state`; let the failure propagate so Nesso can ask the user to run the action again. Never retry mutations automatically or read a new snapshot just to submit edits calculated from old data.

The invoked view is **not a write sandbox**: permitted writes can affect the whole document. Only the operations listed above are available to plugins.

### Files, images, notifications, and failures

| API                                                                                                    | Required capability | Result                                                                           |
| ------------------------------------------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------------------------- |
| `files.open({ extensions: ['json'], mimeTypes: ['application/json'] })`                                | `files`             | `{ name, mediaType, text }`, or `null` on cancellation. Extensions omit the dot. |
| `files.save({ name: 'graph.json', mediaType: 'application/json', text })`                              | `files`             | `{ saved: boolean }`; cancellation returns `false`.                              |
| `files.save({ name: 'graph.png', mediaType: 'image/png', base64 })`                                    | `files`             | `{ saved: boolean }`; the host decodes canonical base64 before saving.           |
| `images.renderView({ format: 'png', scale: 2 })`                                                       | `images`            | `{ mediaType: 'image/png', base64 }` for the invoked view.                       |
| `notifications.notify({ tone: 'info', title: { en: 'Done' }, description: { en: 'Labels updated' } })` | `notifications`     | A notification ID. Tone is `info` or `warning`; description is optional.         |

File saves accept exactly one of UTF-8 `text` or canonical `base64` (without a data URL prefix), with a 16 MiB decoded byte limit. File opening remains UTF-8 text only. Host-managed dialogs or browser downloads grant no unrestricted filesystem access. Plugins have no Node, host DOM, direct filesystem, clipboard, or network access.

`images.renderView` captures the invoked view with the current theme and fonts, without selection or canvas controls. Scale defaults to `2`, or accepts `4`. Empty or oversized images fail rather than silently downscaling (8192 pixels per side, 16,777,216 pixels total, 16 MiB PNG). Save the result separately with `files.save({ name: 'view.png', ...image })`; this also requires `files`.

Failures throw `PluginError` with `code` and `{ path, message }[]` issues. Let them propagate instead of reporting success. Files and notifications cannot be rolled back with graph edits.

### Private persistent storage

Declare `storage` to read, write, or delete your plugin's private data. Nesso derives the namespace from the authorized npm package name, its provenance, and the current document, never from plugin-provided identity fields. Different versions and action instances of the same package share data; different packages and documents do not. Locally installed packages and npm-installed packages never share data, even with the same name, and an installed package can only be replaced by one with the same provenance.

```ts
const records = await storage.list()

await storage.set(
  'progress',
  { attempts: 1, answers: ['good'] },
  { kind: 'concept', id: concept.id },
)
await storage.set('settings', { enabled: true })
if (viewId !== null)
  await storage.set('notes', { text: 'Project ideas' }, { kind: 'view', id: viewId })
await storage.delete('progress', { kind: 'concept', id: concept.id })
```

`storage.list()` returns all records as an array, including records associated with deleted concepts or views. Each record has a `key`, a JSON `value`, and an optional `scope`:

- Without `scope`, the record belongs to the document, for example plugin configuration or notes for Overview (`viewId === null`).
- With `{ kind: 'concept', id }`, it belongs to that concept. Its data is shared across all views containing the concept.
- With `{ kind: 'view', id }`, it belongs to that saved view, independently of its name or membership. Use a non-null `viewId`.
- Scopes identify records within the same plugin/document namespace; they do not create separate namespaces or revision baselines. The same key can be used at document scope and for different concepts and views, including a concept and view with the same ID.
- Payloads belong to the plugin: the host does not interpret their fields or implement domain logic.

`storage.set(key, value, scope?)` saves one record and `storage.delete(key, scope?)` removes one. Set requires the referenced concept or saved view to exist. Concept IDs must be absolute IRIs; view IDs are opaque identifiers. Delete also accepts references to deleted entities so plugins can explicitly remove orphan records. Each call is a single transaction returning `true` when storage changed and `false` for valid net-no-op writes, such as saving an identical value or deleting a missing record. Failed writes throw instead of returning `false`.

The SDK tracks storage revisions internally. Every mutation checks against the last listed snapshot or the preceding successful mutation. If you haven't listed storage, the first mutation reads its baseline automatically. Concurrent changes reject stale writes with `stale-state`, without refreshing the baseline or retrying automatically. List storage again before recomputing edits; never refresh just to resubmit edits calculated from old data. Document reads do not refresh the storage baseline, and storage writes do not invalidate the document snapshot. Document edits and private storage calls are separate transactions.

Await all storage calls before the action returns. Success means the validated change was committed in memory, not that a disk write has finished. Nesso autosaves through its shared persistence API, reports failures in its persistence banner, and waits for saving before desktop close, update installation, and data-folder transfers. Unreadable records are protected until explicit recovery; in-memory editing can continue but may remain unsaved.

#### Data lifecycle

- A document has a persistent identity outside graph JSON-LD. Resetting it creates a new identity and empty plugin storage; a mismatched saved identity is reported and protected, never silently attached to another document.
- Renaming a view or changing membership does not affect scoped records. Removing a view does not delete concept data.
- Deleting a concept or saved view retains its records, including across restart and backup restoration. Document Undo/Redo can recover the entity during the current app session, reconnecting its records by the same ID; private storage changes themselves do not enter graph history. Creating a different entity with the same name does not reconnect old records.
- Use explicit scopes to identify concept or view data, including logs. Plugins own payload schemas and any explicit cleanup; the host does not automatically purge orphan records. IDs embedded in arbitrary keys or payloads remain opaque to the host.
- Disabling, uninstalling, replacing, or crashing a plugin does not delete its stored data.

#### Limits

Storage accepts finite JSON primitives, dense arrays, and plain objects, including `null`; not `undefined`, dates, maps, functions, cyclic data, or custom prototypes. Returned snapshots and stored payloads are independent copies.

| Budget                            | Limit            |
| --------------------------------- | ---------------- |
| Record, encoded as UTF-8 JSON     | 256 KiB          |
| Namespace snapshot                | 8 MiB            |
| Total plugin storage per document | 64 MiB           |
| Records per plugin                | 10,000           |
| Plugin namespaces per document    | 128              |
| Record nesting                    | 24 levels        |
| Record key                        | 1–128 characters |

Concept IDs must be absolute IRIs and refer to an existing document concept when writing. Deletes may remove retained orphan records. Keys are logical identifiers, not paths. Normal action channel request, deadline, rate, and cancellation limits also apply.

## Vocabularies

Set `nesso.kind` to `"vocab"`, `entry` to a package-local JSON file such as `"dist/definition.json"`, and both `writes` and `capabilities` to `[]`. Keep the same package metadata structure. The entry contains a `VocabDefinition`:

```json
{
  "id": "my-vocab",
  "relationTypes": [
    {
      "id": "urn:my-vocab:depends-on",
      "label": "depends on",
      "translations": { "en": "depends on", "it": "dipende da", "zh-CN": "依赖于" }
    }
  ],
  "defaultTypeId": "urn:my-vocab:depends-on"
}
```

Use stable absolute IRIs for relation types and choose a default from your own list. See [Base Vocab](../../plugins/base-vocab/) for a larger example.

`label` is the canonical label saved in the graph. Optional `translations` provides display labels for `en`, `it`, and `zh-CN`, each nonempty and at most 30 characters. The app resolves the current locale, then English, then `label`, without changing document data. Translations apply only when the type's IRI and canonical label match an installed vocabulary; custom labels remain unchanged. Missing or disabled vocabularies fall back to the stored label.

## Themes

Set `nesso.kind` to `"theme"`, point `entry` to your JSON definition, and use empty `writes` and `capabilities`. A `ThemeDefinition` contains:

- `id`: a lowercase kebab-case contribution ID.
- `colors`: every required token, using `#RRGGBB` or `#RRGGBBAA`. Start with [Paper's palette](../../plugins/paper-theme/src/index.ts) or [Kernel's](../../plugins/kernel-theme/src/index.ts).
- `metrics`: `radius-control` and `radius-object` in pixels, and `duration-state` in milliseconds.
- `fonts`: `sans` and `mono`, each with a `faces` array. Use `[]` for system fallbacks, or include local WOFF2 files with package-relative `path`, `weight: [min, max]`, and `style: "normal"` or `"italic"`.

Only light themes are supported. Use readable text contrast; arbitrary CSS and remote fonts are unsupported.

The SDK exposes shared graph and operation types from the internal [`@nesso-how/core`](../core/) package. Trusted renderers use its synchronous store contract; plugins use only the permission-limited asynchronous `ActionContext` above. The published SDK bundles these shared contracts and helpers, so plugin projects need no separate core dependency.

For the full API and validation rules, see [action types](src/runtime.ts), [graph operations](../core/src/types.ts), and [theme/vocabulary schemas](src/definitions.ts).
