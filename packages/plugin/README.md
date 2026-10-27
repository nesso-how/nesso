# Nesso Plugin SDK

Build Nesso plugins with TypeScript: **actions** read and edit graphs, **vocabularies** define relation types, and **themes** customize appearance.

## Create a plugin

Copy the [standalone action example](example/) into a separate project. It includes the SDK, TypeScript configuration, and bundler setup:

```sh
npm install
npm run build
```

Choose your own package name and action ID, then edit `src/index.ts`:

```ts
import type { ActionContribution, NessoOperation } from '@nesso-how/plugin'
import source from '../package.json' with { type: 'json' }

export const create = (): readonly ActionContribution[] => {
  const action: ActionContribution = {
    id: 'uppercase-labels',
    label: source.i18n.metadata.name,
    run: async ({ store }) => {
      const state = store.getState()

      const operations: readonly NessoOperation[] = state.viewGraph.concepts.map(({ id, label }) => ({
        kind: 'concept.label',
        id,
        value: label.toUpperCase(),
      }))

      await store.applyOperations(operations)
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
    "apiVersion": 1,
    "kind": "actions",
    "entry": "dist/index.js",
    "writes": ["concept.label"],
    "capabilities": []
  },
  "i18n": {
    "metadata": {
      "name": { "en": "Uppercase labels" },
      "description": { "en": "Uppercase concept labels in a view." },
      "documentation": { "en": "Updates labels in one undoable batch." }
    }
  }
}
```

Declare the operations your action uses in `writes` and file/notification access in `capabilities`. All fields shown under `nesso` and `i18n.metadata` are required. Add the `nesso-plugin` keyword for discovery in Settings → Plugins.

Labels and metadata use `{ en: string, it?: string, 'zh-CN'?: string }`, with English required as the fallback.

### Build and test

Run `npm run build`, then follow the example's [local testing instructions](example/README.md#test-an-unpublished-build).

Actions must ship one self-contained browser ES module with dependencies bundled; the example's build handles this. Test and install external plugins in the desktop app.

## Action API

Nesso passes `{ store, files, notifications, signal, viewId }` to `run` as `ActionContext`.

`create()` receives no arguments and returns an array of actions with unique lowercase kebab-case IDs, localized labels, optional icons, and `run(context)` handlers. Use `ActionIconName` for supported icons.

Keep graph reads and effects inside `run`. **Await every write, file dialog, and notification** before returning; the action ends when `run` finishes. Use `signal` to detect cancellation.

### Read the invoked view

- `store.getState()` returns the latest readonly local snapshot synchronously and makes it the basis for subsequent writes.
- `await store.refresh()` fetches and reads a fresh snapshot. Use it after deferred work, such as a file dialog, before computing edits.
- `store.subscribe(listener)` notifies you of snapshot changes and returns an unsubscribe function. Read the new state with `getState()`.

The graph snapshot provides:

- `viewGraph`: `{ concepts, relations, relationTypes }` for the invoked view.
- `selected`: the invoked view's selection.
- `targetViewId`: the invoked view's ID, or `null` for All; navigation does not change the target.
- `activeVocab`: the current vocabulary, or `null`.

Concept and relation-type IDs are absolute IRIs. Relations are `{ source, predicate, target }` triples; use `JSON.stringify([source, predicate, target])` as their selection/write ID.

### Write the graph

Call helpers on `store` and declare their operation kinds in `nesso.writes`:

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

`addConcept` returns the new IRI. New concepts join the active saved view and link to the single selected concept, if any. These links and `connect` use the vocabulary's default relation type. `createRelationType` creates and assigns a type to the given relation.

For related edits, use `store.applyOperations(operations)` as in the quickstart. The entire batch succeeds or changes nothing. Separate calls are separate transactions. Raw `concept.add` operations require an explicit new absolute IRI.

Every write checks against the last snapshot you read, or the initial snapshot if you haven't read one. Successful writes advance that baseline, so awaited sequential writes work normally. Incoming updates alone do not advance it. A conflict rejects with `stale-state`; let the failure propagate so Nesso can ask the user to run the action again. Never retry mutations automatically or read a new snapshot just to submit edits calculated from old data.

The invoked view is **not a write sandbox**: permitted writes can affect the whole document. Only the operations listed above are available to plugins.

### Files, notifications, and failures

| API | Required capability | Result |
| --- | --- | --- |
| `files.open({ extensions: ['json'], mimeTypes: ['application/json'] })` | `files.open` | `{ name, mediaType, text }`, or `null` on cancellation. Extensions omit the dot. |
| `files.save({ name: 'graph.json', mediaType: 'application/json', text })` | `files.save` | `{ saved: boolean }`; cancellation returns `false`. |
| `notifications.notify({ tone: 'info', title: { en: 'Done' }, description: { en: 'Labels updated' } })` | `notifications.notify` | A notification ID. Tone is `info` or `warning`; description is optional. |

Files use UTF-8 text. Plugins have no Node, host DOM, direct filesystem, clipboard, or network access.

Failures throw `PluginError` with `code` and `{ path, message }[]` issues. Let them propagate instead of reporting success. Files and notifications cannot be rolled back with graph edits.

## Vocabularies

Set `nesso.kind` to `"vocab"`, `entry` to a package-local JSON file such as `"dist/definition.json"`, and both `writes` and `capabilities` to `[]`. Keep the same package metadata structure. The entry contains a `VocabDefinition`:

```json
{
  "id": "my-vocab",
  "relationTypes": [
    { "id": "urn:my-vocab:depends-on", "label": "depends on" }
  ],
  "defaultTypeId": "urn:my-vocab:depends-on"
}
```

Use stable absolute IRIs for relation types and choose a default from your own list. See [Base Vocab](../../plugins/base-vocab/) for a larger example.

## Themes

Set `nesso.kind` to `"theme"`, point `entry` to your JSON definition, and use empty `writes` and `capabilities`. A `ThemeDefinition` contains:

- `id`: a lowercase kebab-case contribution ID.
- `colors`: every required token, using `#RRGGBB` or `#RRGGBBAA`. Start with [Paper's palette](../../plugins/paper-theme/src/index.ts) or [Kernel's](../../plugins/kernel-theme/src/index.ts).
- `metrics`: `radius-control` and `radius-object` in pixels, and `duration-state` in milliseconds.
- `fonts`: `sans` and `mono`, each with a `faces` array. Use `[]` for system fallbacks, or include local WOFF2 files with package-relative `path`, `weight: [min, max]`, and `style: "normal"` or `"italic"`.

Only light themes are supported. Use readable text contrast; arbitrary CSS and remote fonts are unsupported.

For the full API and validation rules, see [action types](src/runtime.ts), [graph operations](src/types.ts), and [theme/vocabulary schemas](src/definitions.ts).
