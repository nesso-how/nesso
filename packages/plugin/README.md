# Nesso Plugin SDK

Build Nesso plugins with TypeScript: **actions** read and edit graphs, **vocabularies** define relation types, and **themes** customize appearance.

## Install

Use Node.js 24. Add the SDK to an existing TypeScript project with:

```sh
npm install --save-dev @nesso-how/plugin
```

For a new project, start with the [standalone example](example/), which includes TypeScript, Vite, and React configuration. Plugins can be installed locally through MCP without publishing to npm.

The app, UI package, SDK, and official example share a release version on npm's default `latest` channel, including beta versions. Plugin compatibility is identified separately by `nesso.apiVersion`; matching the app's exact version is not required.

The desktop plugin catalog offers the newest compatible version on `latest`. Other prerelease channels are not included.

## Create a plugin

### With an agent

Use an agent such as Claude Code or Codex that can create files and run commands on your computer. Nesso's internal chat cannot build or install plugins.

1. In the desktop app, open Settings → AI → MCP and start the server. If `plugins` and `propose_plugin` are not available, update Nesso.
2. In your agent's MCP configuration, connect to the URL shown in Nesso using Streamable HTTP and an `Authorization: Bearer <token>` header. Copy the token from Settings into the client's configuration, not into a chat message, source file, or repository. Keep Nesso open.
3. Describe the plugin you want, or use this prompt:

> Build a Nesso plugin that [describe the behavior]. Call `read_docs` for `plugin` and `plugin-example` through Nesso MCP and follow the documented workflow, then propose a local installation for my approval in Nesso.

The agent should work in a separate project, choose a unique package name, and request only the permissions the plugin needs. For a panel, also read `read_docs` with `{"topic":"ui"}`. Follow [Build and test](#build-and-test), then [Install or update through MCP](#install-or-update-through-mcp). Nesso reads the finished package; it never installs dependencies or runs build scripts.

### By hand

Copy the [standalone example](example/) into a separate project and install its dependencies:

```sh
npm install
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

`create()` defines the action; Nesso calls `run` when the user invokes it. This action uppercases every concept label in that view with one undoable batch. Shared concepts change in every view containing them.

### Package metadata and permissions

Keep the example's build configuration and set these fields in `package.json`:

```json
{
  "name": "nesso-plugin-my-action",
  "version": "1.0.0",
  "keywords": ["nesso-plugin"],
  "nesso": {
    "apiVersion": 3,
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

Declare the operations your action uses in `writes`. Available capabilities are `files`, `images`, `notifications`, `storage`, and `ui`: the first four grant access to their APIs; `ui` allows interactive panels. Declare only what you use. All fields shown under `nesso` and `i18n.metadata` are required. The `nesso-plugin` keyword makes published packages discoverable in Settings → Plugins.

`nesso.apiVersion` identifies the plugin API, not the SDK version or your package's version.

`i18n.metadata.name` names the plugin in Settings. Each action defines its own `label` for menus, independently of the plugin name. Labels and metadata use `{ en: string, it?: string, 'zh-CN'?: string }`, with English required as the fallback.

### Build and test

Run `npm run build` to typecheck and build the example. Use `npm run check` to typecheck without building.

Test calculations, graph edit generation, and storage transformations separately from React and host APIs. Node.js 24 can run pure TypeScript tests with `node --test "src/**/*.test.ts"`, using `node:test` and `node:assert/strict`. These tests need `.ts` imports and cannot load JSX or DOM-dependent modules. Add `@types/node` and `node` to your test TypeScript configuration's `types` if needed.

An action package ships one browser ES module. Bundle its dependencies except `react`, `react/*`, `react-dom`, and `react-dom/*`; Nesso supplies React 19 in the sandbox. The example's Vite configuration handles this.

Before installing, validate the built package with `preparePluginPackage`. Save this as `validate.ts` in the project root and run `node validate.ts` after building:

```ts
import { readFile } from 'node:fs/promises'
import { preparePluginPackage } from '@nesso-how/plugin/package'
import { parsePluginManifest } from '@nesso-how/plugin/runtime'

const manifest = JSON.parse(await readFile('package.json', 'utf8'))
const nesso = parsePluginManifest(manifest.nesso)
const entry = new Uint8Array(await readFile(nesso.entry))
const files = [{ path: nesso.entry, bytes: entry }]

const prepared = await preparePluginPackage({ manifest, files })
console.log(prepared.name, prepared.version, prepared.contentId)
```

This checks metadata, permission declarations, file sizes, UTF-8, and theme/vocabulary definitions without running action code. Validation failures throw `PluginError` with details in `issues`. It does not call `create()` or test behavior; those still need testing in Nesso.

### Install or update through MCP

Connect to the [desktop MCP server](#with-an-agent) and call `plugins` to check installed names and local builds. Then call `propose_plugin` with the absolute package root, containing `package.json` and the built entry:

```json
{ "directory": "/absolute/path/to/nesso-plugin-my-action" }
```

Pass the package root, not `dist`, an archive, or inline JavaScript. Nesso reads only `package.json` and the `nesso.entry` file. Relative paths, files outside the directory (including through symlinks), and oversized files are rejected.

Tell the user to switch to Nesso before proposing. Every install or replacement needs approval within the **120-second** request timeout, which includes processing time. The result is one of:

- `installed`: includes `name`, `version`, and `contentId`.
- `cancelled`: the proposal was not approved. Do not automatically propose again.
- `failed`: includes `{ path, message }[]` issues to fix before a new proposal.

If the client times out or disconnects, call `plugins` to check whether installation completed. Do not retry automatically or report success without confirmation.

Local plugins stay installed across restarts and appear in Settings → Plugins with a **Local** badge. They are not verified by npm or checked for npm updates. Rebuilding your project does not update the installed copy.

To update a local plugin the user has asked to replace, call `plugins`, find its entry with `local: true`, and pass its current `contentId` as `replacing` alongside `directory`. MCP cannot replace or shadow npm-installed or bundled plugins; use a different package name for your local copy.

Try the installed action from a view's actions menu, or choose the theme/vocabulary in Settings. Check that the plugin handles cancellation and stale-state errors, closes cleanly, and restores saved data after restarting Nesso.

## Action API

Nesso passes `{ document, storage, files, images, notifications, signal, viewId }` to `run` as `ActionContext`. `document` exposes the shared graph, view membership, and transient selection; `storage` holds the plugin's private data for that document.

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

Nesso provides the panel title, close control, and loading/error screens. Opening a panel or changing the active view starts a new React instance and invalidates the previous context. Closing it, changing documents, replacing/removing the plugin, or a runtime failure ends the session.

Keep mutable state inside the component and clean up subscriptions in React effects. Module-scope state is not guaranteed between sessions: Nesso may reuse or discard the runtime, so keep state in the instance or `storage`. Save progress through `storage` as it changes; cleanup may not finish. Panels have no action execution timeout, but initialization and API requests have deadlines. Handle expected errors in the UI; uncaught errors or rejected promises fail the session.

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

`images.renderView` captures the invoked view with the current theme and fonts, without selection or canvas controls. Scale defaults to `2`, or accepts `4`, and is a maximum: views too large for it render at the highest of `4`, `2`, or `1` within 8192 pixels per side and 16,777,216 pixels total. Empty views, views over that budget at scale `1`, and PNGs over 16 MiB fail. Save the result separately with `files.save({ name: 'view.png', ...image })`; this also requires `files`.

Failures throw `PluginError` with `code` and `{ path, message }[]` issues. Let them propagate instead of reporting success. Files and notifications cannot be rolled back with graph edits.

### Private persistent storage

Declare `storage` to read, write, or delete private data. Storage is separate for each package name, installation source (local or npm), and document. Versions and action instances of the same package share data; a local install and an npm install never do, even with the same name. Plugins cannot choose another package's namespace.

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
- Your plugin owns the payload format and any migrations. Version it independently of the SDK and package version; Nesso does not interpret its fields.

`storage.set(key, value, scope?)` saves one record and `storage.delete(key, scope?)` removes one. Each call is a single transaction returning `true` if data changed, or `false` if nothing changed, such as saving an identical value or deleting a missing record. Failed writes throw.

Setting a scoped record requires the concept or saved view to exist. Concept IDs must be absolute IRIs; view IDs are opaque identifiers. Deleting a record also accepts references to deleted entities.

Each write checks the storage revision from your last `storage.list()` or successful write. If you have not listed storage, the SDK reads the initial revision for you. Concurrent changes reject the write with `stale-state`; the SDK does not retry or refresh the revision. List storage again and recompute your changes rather than resubmitting old data.

Document and storage revisions are independent: reading one does not refresh the other. Graph edits and storage calls are separate transactions.

Await all storage calls before the action returns. Success means the change is in memory, not necessarily on disk. Nesso autosaves, reports save failures in its persistence banner, and waits for saving before closing the desktop app. Unreadable records require user recovery and are not overwritten automatically.

#### Data lifecycle

- A document has a persistent identity outside graph JSON-LD. Resetting it creates a new identity and empty plugin storage; a mismatched saved identity is reported and protected, never silently attached to another document.
- Renaming a view or changing membership does not affect scoped records. Removing a view does not delete concept data.
- Deleting a concept or saved view retains its records, including across restart and backup restoration. Document Undo/Redo can recover the entity during the current app session, reconnecting its records by the same ID; private storage changes themselves do not enter graph history. Creating a different entity with the same name does not reconnect old records.
- Use scopes for concept or view data, including logs. Nesso does not interpret IDs embedded in keys or payloads and does not automatically delete orphaned records; your plugin must clean them up explicitly.
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

Keys are logical identifiers, not file paths. Action channel size, deadline, rate, and cancellation limits also apply.

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

Only light themes are supported. Use readable text contrast; arbitrary CSS and plugin fonts are unsupported. Theme packages ship only their JSON entry. Nesso owns `--font-sans` (Geist) and `--font-mono` (IBM Plex Mono), with system fallbacks for other scripts. Switching themes does not change typography.

## API reference

Import graph and operation types from `@nesso-how/plugin`; no separate `@nesso-how/core` dependency is needed.

For the full API and validation rules, see [action types](src/runtime.ts), [graph operations](../core/src/types.ts), and [theme/vocabulary schemas](src/definitions.ts).
