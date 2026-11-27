# Nesso Plugin SDK

Build Nesso plugins with TypeScript. A plugin can contribute **actions** that read and edit graphs, **vocabularies** that define relation types, or **themes** that customize appearance.

## Install

Use Node.js 24. To add the SDK to an existing TypeScript project, run:

```sh
npm install --save-dev @nesso-how/plugin
```

For a new action plugin, start with the [standalone example](example/README.md#build-your-own), which comes with TypeScript, Vite, and React configuration. Over MCP, its setup instructions are in the `plugin-example` topic of `read_docs`, and you can install plugins locally through MCP without publishing them to npm.

The app, UI package, SDK, and official example share one release version and publish to npm's default `latest` channel, beta versions included. Plugin compatibility is tracked separately by `nesso.apiVersion`, so your plugin does not need to match the app's exact version.

The desktop plugin catalog offers the newest compatible version on `latest` and leaves out other prerelease channels. The [compatibility guide](../../docs/compatibility.md#plugin-api) explains API support and version changes.

## Create a plugin

### With an agent

Use an agent that can create files and run commands on your computer, such as Claude Code or Codex. Nesso's internal chat cannot build or install plugins.

1. In the desktop app, open Settings → AI → MCP and start the server. If `plugins` and `propose_plugin` are missing, update Nesso.
2. In your agent's MCP configuration, connect to the URL shown in Nesso using Streamable HTTP and an `Authorization: Bearer <token>` header. Copy the token from Settings into the client's configuration only, and keep it out of chat messages, source files, and repositories. Keep Nesso open.
3. Describe the plugin you want, or use this prompt:

> Build a Nesso plugin that [describe the behavior]. Call `read_docs` for `plugin` and `plugin-example` through Nesso MCP and follow the documented workflow, then propose a local installation for my approval in Nesso.

The agent should work in a separate project, choose a unique package name, and request only the permissions the plugin needs. For a panel, it should also call `read_docs` with `{"topic":"ui"}`. [Examples by use case](#examples-by-use-case) lists relevant implementations. Follow [Build and test](#build-and-test), then [Install or update through MCP](#install-or-update-through-mcp). Nesso reads the finished package as it is and never installs dependencies or runs build scripts.

### By hand

Copy the [standalone example](example/README.md#build-your-own) into a separate project and install its dependencies:

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

      const operations: readonly NessoOperation[] = state.mapGraph.concepts.map(
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

`create()` defines the action, and Nesso calls `run` when the user invokes it. This action uppercases every concept label in the map in one undoable batch, and a shared concept changes in every map that contains it.

### Package metadata and permissions

Keep the example's build configuration and set these fields in `package.json`:

```json
{
  "name": "nesso-plugin-my-action",
  "version": "1.0.0",
  "keywords": ["nesso-plugin"],
  "nesso": {
    "apiVersion": 7,
    "kind": "actions",
    "entry": "dist/index.js",
    "writes": ["concept.label"],
    "capabilities": []
  },
  "i18n": {
    "metadata": {
      "name": { "en": "Label tools" },
      "description": { "en": "Uppercase concept labels in a map." },
      "documentation": { "en": "Updates labels in one undoable batch." }
    }
  }
}
```

List the operations your action uses in `writes`. The available capabilities are `files`, `images`, `notifications`, and `storage`, which grant access to the API of the same name, and `ui`, which allows interactive panels. Declare only what you use. Every field shown under `nesso` and `i18n.metadata` is required, and the `nesso-plugin` keyword lets users find published packages in Settings → Plugins.

`nesso.apiVersion` identifies the plugin API. It is separate from the SDK version and from your package's version.

`i18n.metadata.name` is the plugin's name in Settings, while each action sets its own `label` for menus, which can differ from the plugin name. Labels and metadata use `{ en: string, it?: string, 'zh-CN'?: string }`, and English is required because it is the fallback.

### Build and test

Run `npm run build` to typecheck and build the example. Use `npm run check` to typecheck without building.

Test calculations, graph edit generation, and storage transformations apart from React and the host APIs. Node.js 24 runs these as pure TypeScript tests with `node --test "src/**/*.test.ts"`, using `node:test` and `node:assert/strict`. The tests need `.ts` imports and cannot load JSX or modules that depend on the DOM. If needed, add `@types/node` and `node` to `types` in your test TypeScript configuration.

An action package ships one browser ES module. Bundle every dependency except `react`, `react/*`, `react-dom`, and `react-dom/*`, because Nesso supplies React 19 in the sandbox. The example's Vite configuration already does this.

Before you install, validate the built package with `preparePluginPackage`. Save this as `validate.ts` in the project root and run `node validate.ts` after each build:

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

The script checks metadata, permission declarations, file sizes, UTF-8, and theme/vocabulary definitions, and a validation failure throws `PluginError` with details in `issues`. It never calls `create()` or runs any action code, so it tests no behavior and you still need to test the plugin in Nesso.

### Install or update through MCP

Connect to the [desktop MCP server](#with-an-agent) and call `plugins` to see installed names and local builds. Then call `propose_plugin` with the absolute path of the package root, which holds `package.json` and the built entry:

```json
{ "directory": "/absolute/path/to/nesso-plugin-my-action" }
```

Pass the package root itself, because `dist`, archives, and inline JavaScript are not accepted. Nesso reads only `package.json` and the `nesso.entry` file, and it rejects relative paths, oversized files, and files outside the directory, including files reached through symlinks.

Tell the user to switch to Nesso before you propose. The user must approve every install or replacement within the **120-second** request timeout, and processing time counts toward it. The result is one of:

- `installed`: includes `name`, `version`, and `contentId`.
- `cancelled`: the user did not approve the proposal. Do not propose again automatically.
- `failed`: includes `{ path, message }[]` issues. Fix them before you make a new proposal.

If the client times out or disconnects, call `plugins` to check whether the installation completed instead of retrying automatically, and report success only after you confirm it.

Local plugins stay installed across restarts and appear in Settings → Plugins with a **Local** badge. npm does not verify them, and Nesso does not check npm for updates to them. Rebuilding your project leaves the installed copy unchanged.

To update a local plugin that the user asked you to replace, call `plugins`, find its entry with `local: true`, and pass its current `contentId` as `replacing` together with `directory`. MCP cannot replace or shadow npm-installed or bundled plugins, so give your local copy a different package name.

Try the installed action from a map's actions menu, or pick the theme or vocabulary in Settings. Check that the plugin handles cancellation and stale-state errors and closes cleanly, then restart Nesso and check that saved data comes back.

### Examples by use case

- **Panel with persistent data:** [Notes](https://github.com/nesso-how/nesso/blob/main/plugins/notes/README.md#api) shows autosave and map-scoped storage, while [Review](https://github.com/nesso-how/nesso/blob/main/plugins/review/README.md#api) shows action badges, concept-scoped progress, and a private data migration.
- **Graph import or export:** Read the `schema` topic in `read_docs` for the JSON-LD profile. [Import](https://github.com/nesso-how/nesso/blob/main/plugins/import/README.md#api) builds an atomic batch of graph edits from a file, and [Export](https://github.com/nesso-how/nesso/blob/main/plugins/export/README.md#api) saves JSON-LD or a PNG through the host.
- **Theme or vocabulary:** [Paper](https://github.com/nesso-how/nesso/blob/main/plugins/paper-theme/README.md#api) shows theme tokens and metrics, and [Base Vocab](https://github.com/nesso-how/nesso/blob/main/plugins/base-vocab/README.md#api) shows stable relation IRIs and translated labels.
- **Update an existing plugin:** Read the [compatibility guide](https://github.com/nesso-how/nesso/blob/main/docs/compatibility.md#plugin-api) for supported API versions and how upgrades, downgrades, and backups affect private plugin data.

For source that matches a specific Nesso release, use its `vX.Y.Z` Git tag instead of `main`.

## Action API

Nesso passes `{ document, storage, files, images, notifications, signal, mapId }` to `run` as `ActionContext`. `document` exposes the shared graph, map membership, and transient selection, while `storage` holds the plugin's private data for that document.

`create()` takes no arguments and returns an array of actions. Each action has a unique lowercase kebab-case ID, a localized label, an optional icon (see `ActionIconName` for the supported icons), and either a `run(context)` handler or a React component in `ui`, but never both.

Keep graph reads and effects inside `run`. **Await every write, file dialog, and notification** before you return, because the action ends when `run` finishes, and use `signal` to detect cancellation.

### Action UI

Declare the `ui` capability and set the action's `ui` property to a React component in place of a `run` handler. Nesso mounts the component in an isolated central panel and unmounts it when the session ends.

```tsx
import { useSyncExternalStore } from 'react'
import type { ActionContext, ActionContribution } from '@nesso-how/plugin'

function Browse({ document }: ActionContext) {
  const state = useSyncExternalStore(document.subscribe, document.getState)
  return (
    <ul>
      {state.mapGraph.concepts.map(({ id, label }) => (
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

Components receive `ActionContext` directly as props and get the same APIs and permissions as `run`, with `mapId` and the supplied `mapGraph` referring to the invoked map. Subscribe with `useSyncExternalStore` when you render snapshot data. Because discovery runs `create()` in a Worker, keep DOM access and effects inside components or `run`, and out of module scope and `create()`. The panel can access its own DOM but cannot reach the host DOM, the native bridge, the network, or persistent storage directly, so use the injected APIs for files and storage.

#### Styling

Nesso supplies React, the `@nesso-how/ui` component stylesheet, and theme CSS variables such as `var(--background)` and `var(--foreground)`. Import your own CSS as usual, and the [standalone example](example/) bundles and injects it. Bundle every dependency other than React and React DOM and inline your assets, because remote or separate assets are not supported. The host does not compile Tailwind classes in plugins.

For translated content, read `locale` from `document.getState()`. `colorScheme` (`light` or `dark`) reports the resolved appearance, and Nesso applies it to the panel's `color-scheme`, so use theme variables in place of fixed colors. Give inputs labels and keep Tab/Shift+Tab navigation working.

#### Lifecycle

Nesso provides the panel title, the close control, and the loading and error screens. Opening a panel or changing the active map starts a new React instance and invalidates the previous context. The session ends when the user closes the panel or changes documents, when the plugin is replaced or removed, or when the runtime fails.

Keep mutable state in the component instance or in `storage`, and clean up subscriptions in React effects. Module-scope state may not survive between sessions, because Nesso may reuse or discard the runtime. Save progress through `storage` as it changes, since cleanup may not finish. Panels have no action execution timeout, but initialization and API requests still have deadlines. Handle expected errors in the UI, because an uncaught error or rejected promise fails the session.

### Action badges

You can add an optional `badge(input)` to a `run` or `ui` action. It can return a value directly or a promise:

```ts
badge: ({ mapGraph }) => ({
  value: mapGraph.concepts.length,
})
```

- `input` is readonly and holds `mapId` (`null` for the graph), the target `mapGraph`, the private document storage `records`, and `now` in Unix milliseconds. `records` requires `storage` and is empty otherwise.
- Return `{ value: number | null, refreshAt?: number }`, where `value` is an integer from 0 to 999,999. Zero and `null` hide the badge.
- For counts that depend on time, calculate from `now` and return `refreshAt` as an absolute Unix-millisecond timestamp. Otherwise omit it. Timed refreshes run at most once every 15 seconds.

The badge runs in an isolated Worker with no action APIs and a 2-second calculation limit. Nesso calculates only visible badges and refreshes them after the graph, a map, or plugin storage changes. Results are not persisted, and a failure hides the badge.

### Read the invoked map

- `document.getState()` synchronously returns the latest readonly local snapshot, which becomes the basis for later writes.
- `await document.refresh()` fetches and reads a fresh snapshot. Call it after deferred work, such as a file dialog, and before you compute edits.
- `document.subscribe(listener)` notifies you when the snapshot changes and returns an unsubscribe function. Read the new state with `getState()`.

The graph snapshot provides:

- `mapGraph`: `{ concepts, relations, relationTypes }` for the invoked map. When the action runs on a map rather than on Graph, concepts carry the map's `position`, `color`, `bold`, `italic`, and `strikethrough`, and relations may carry a map-local `bend`. `color` is either a preset id such as `sand`, shown with `var(--preset-sand)`, or a fixed `#rrggbb` value.
- `selected`: the invoked map's selection.
- `targetMapId`: the invoked map's ID, or `null` for the graph. It stays fixed for each invocation, so headless actions keep their target while the user navigates, and panels restart with a new invocation when the active map changes.
- `activeVocab`: the current vocabulary, or `null`.

`mapGraph` contains the stored relation-type labels. To display them, `@nesso-how/plugin` exports `resolveRelationTypeLabel(type, vocabs, locale)`, which returns a translated display label from the supplied vocabularies and keeps custom labels as they are.

Concept and relation-type IDs are absolute IRIs. Relations are `{ source, predicate, target }` triples, and `JSON.stringify([source, predicate, target])` serves as a relation's ID for selection and writes.

### Write the graph

Call helpers on `document` and declare their operation kinds in `nesso.writes`:

| Helper                                              | Required `writes` entry |
| --------------------------------------------------- | ----------------------- |
| `setConceptLabel(id, value)`                        | `concept.label`         |
| `setConceptNotes(id, value)`                        | `concept.notes`         |
| `setConceptColor(id, value)`                        | `concept.color`         |
| `setConceptBold(id, value)`                         | `concept.bold`          |
| `setConceptItalic(id, value)`                       | `concept.italic`        |
| `setConceptStrikethrough(id, value)`                | `concept.strikethrough` |
| `setConceptPosition(id, { x, y })`                  | `concept.position`      |
| `setConceptPositions([{ id, position: { x, y } }])` | `concept.positions`     |
| `addConcept(position?)`                             | `concept.add`           |
| `removeConcept(id)`                                 | `concept.remove`        |
| `connect(source, target)`                           | `relation.connect`      |
| `reconnectRelation(id, source, target)`             | `relation.reconnect`    |
| `setRelationType(id, typeId)`                       | `relation.type`         |
| `createRelationType(id, label)`                     | `relation.type.create`  |
| `removeRelation(id)`                                | `relation.remove`       |
| `setRelationBend(id, value)`                        | `relation.bend`         |
| `setSelection([{ kind, id }])`                      | `selection.set`         |
| `setMapMembership(mapId, conceptId, included)`      | `map.membership`        |

Position, color, and style helpers edit the invoked map, so they reject the batch when the target is the graph, after the user navigates away, and for concepts outside the map. `addConcept` returns the new IRI. The new concept joins the active map at the given position, or near the single selected concept if you omit the position, and when exactly one concept is selected it also links to that concept. These links and `connect` use the vocabulary's default relation type, while `createRelationType` creates a type and assigns it to the given relation. The selection keeps only the concepts and relations visible in the active map.

`setRelationBend` follows the same active-map guard, requires both endpoints to belong to the active map, and cannot bend self-relations. Its finite value gives the signed midpoint displacement as a fraction of the length of the segment between the endpoints, and `0` restores the automatic curve. Removing or reconnecting a relation clears its bends, but changing only its predicate keeps them.

For related edits, use `document.applyOperations(operations)` as in the quickstart, so that either the whole batch succeeds or nothing changes. Separate calls are separate transactions. The batch is rejected if it edits, reconnects, retypes, or removes an unknown concept or relation, or if it reconnects or retypes a relation onto an existing one. It may still remove an item that an earlier operation in the same batch already removed, such as a relation of a removed concept. Raw `concept.add` operations need an explicit new absolute IRI.

Every write is checked against the last snapshot you read, or against the initial snapshot if you have not read one. Each successful write advances that baseline, so awaited sequential writes work normally, while incoming updates alone leave it where it is. A conflict rejects with `stale-state`, and you should let that failure propagate so Nesso can ask the user to run the action again. Never retry mutations automatically, and never read a new snapshot just to submit edits you calculated from old data.

The invoked map is **not a write sandbox**, because permitted writes can affect the whole document. Plugins can use only the operations listed above.

### Files, images, notifications, and failures

| API                                                                                                    | Required capability | Result                                                                           |
| ------------------------------------------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------------------------- |
| `files.open({ extensions: ['json'], mimeTypes: ['application/json'] })`                                | `files`             | `{ name, mediaType, text }`, or `null` on cancellation. Extensions omit the dot. |
| `files.save({ name: 'graph.json', mediaType: 'application/json', text })`                              | `files`             | `{ saved: boolean }`. Cancellation returns `false`.                              |
| `files.save({ name: 'graph.png', mediaType: 'image/png', base64 })`                                    | `files`             | `{ saved: boolean }`. The host decodes canonical base64 before saving.           |
| `images.renderCanvas({ format: 'png', scale: 2 })`                                                     | `images`            | `{ mediaType: 'image/png', base64 }` for the invoked canvas.                     |
| `notifications.notify({ tone: 'info', title: { en: 'Done' }, description: { en: 'Labels updated' } })` | `notifications`     | A notification ID. Tone is `info` or `warning`. Description is optional.         |

A file save takes exactly one of UTF-8 `text` or canonical `base64` without a data URL prefix, and its decoded size limit is 16 MiB. Opening a file returns UTF-8 text only. Saves and opens go through host-managed dialogs or browser downloads, which grant no unrestricted filesystem access, and plugins have no access to Node, the host DOM, the filesystem directly, the clipboard, or the network.

`images.renderCanvas` captures the canvas the action was invoked from with the current theme and fonts, leaving out the selection and canvas controls. For a map it captures the map, and for the graph (`mapId` `null`) it captures every concept as shown on the graph canvas. Scale defaults to `2`, also accepts `4`, and acts as a maximum. A canvas too large for it renders at the highest of `4`, `2`, or `1` that fits within 8192 pixels per side and 16,777,216 pixels in total. Rendering fails for empty canvases, for canvases over that budget at scale `1`, and for PNGs over 16 MiB. To save the result, call `files.save({ name: 'map.png', ...image })` separately, which also requires `files`.

Failures throw `PluginError` with a `code` and `{ path, message }[]` issues. Let them propagate and do not report success, keeping in mind that graph edits can be rolled back but files and notifications cannot.

### Private persistent storage

Declare `storage` to read, write, or delete private data. Each combination of package name, installation source (local or npm), and document gets its own storage, which all versions and action instances of that package share. A local install and an npm install never share data, even under the same name, and plugins cannot pick another package's namespace.

```ts
const records = await storage.list()

await storage.set(
  'progress',
  { attempts: 1, answers: ['good'] },
  { kind: 'concept', id: concept.id },
)
await storage.set('settings', { enabled: true })
if (mapId !== null)
  await storage.set('notes', { text: 'Project ideas' }, { kind: 'map', id: mapId })
await storage.delete('progress', { kind: 'concept', id: concept.id })
```

`storage.list()` returns every record as an array, including records tied to deleted concepts or maps. Each record has a `key`, a JSON `value`, and an optional `scope`:

- Without `scope`, the record belongs to the document. Use this for plugin configuration or for notes on the graph (`mapId === null`).
- With `{ kind: 'concept', id }`, it belongs to that concept, and every map containing the concept shares its data.
- With `{ kind: 'map', id }`, it belongs to that map regardless of the map's name and membership. Use a non-null `mapId`.
- Scopes identify records inside one plugin/document namespace without creating separate namespaces or revision baselines. You can use the same key at document scope and for different concepts and maps, even for a concept and a map that share an ID.
- Your plugin owns the payload format and any migrations, and Nesso does not interpret its fields. Give the format its own version, separate from the SDK and package versions.

The [downgrade and backup policy](../../docs/compatibility.md#downgrades-and-backups) also applies to private plugin data.

`storage.set(key, value, scope?)` saves one record and `storage.delete(key, scope?)` removes one, each in a single transaction. Both return `true` if data changed and `false` if nothing changed, for example when you save an identical value or delete a missing record. Failed writes throw.

Setting a scoped record requires the concept or map to exist, while deleting a record also works with references to deleted entities. Concept IDs must be absolute IRIs, and map IDs are opaque identifiers.

Each write checks the storage revision from your last `storage.list()` or successful write, and if you have not listed storage yet, the SDK reads the initial revision for you. If storage changed concurrently, the write rejects with `stale-state`, and the SDK neither retries nor refreshes the revision. List storage again and recompute your changes instead of resubmitting the old data.

Document and storage revisions are independent, so reading one does not refresh the other. Graph edits and storage calls are separate transactions.

Await all storage calls before the action returns. A successful call means the change is in memory, but it may not be on disk yet. Nesso autosaves and reports save failures in its persistence banner, and the desktop app waits for saving to finish before it closes. Unreadable records need recovery by the user, and Nesso never overwrites them automatically.

#### Data lifecycle

- A document has a persistent identity stored outside the graph JSON-LD, and resetting the document creates a new identity and empty plugin storage. If a saved identity does not match, Nesso reports and protects it and never attaches that data silently to another document.
- Renaming a map or changing its membership leaves scoped records unchanged. Removing a map keeps concept data.
- Deleting a concept or map keeps its records, across restarts and backup restoration too. Document Undo/Redo can bring the entity back during the current app session, and its records then reconnect through the same ID, although private storage changes themselves stay out of graph history. A different entity created with the same name does not pick up the old records.
- Use scopes for concept or map data, logs included, because Nesso does not interpret IDs embedded in keys or payloads. It never deletes orphaned records automatically, so your plugin must clean them up itself.
- Disabling, uninstalling, or replacing a plugin keeps its stored data, and so does a plugin crash.

#### Limits

Storage accepts finite JSON primitives, dense arrays, and plain objects, `null` included, and rejects `undefined`, dates, maps, functions, cyclic data, and custom prototypes. Returned snapshots and stored payloads are independent copies.

| Budget                            | Limit            |
| --------------------------------- | ---------------- |
| Record, encoded as UTF-8 JSON     | 256 KiB          |
| Namespace snapshot                | 8 MiB            |
| Total plugin storage per document | 64 MiB           |
| Records per plugin                | 10,000           |
| Plugin namespaces per document    | 128              |
| Record nesting                    | 24 levels        |
| Record key                        | 1–128 characters |

Keys are logical identifiers with no meaning as file paths. The action channel's size, deadline, rate, and cancellation limits also apply.

## Vocabularies

Set `nesso.kind` to `"vocab"`, set `entry` to a JSON file inside the package, such as `"dist/definition.json"`, and set both `writes` and `capabilities` to `[]`. The rest of the package metadata has the same structure as for actions. The entry contains a `VocabDefinition`:

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

Use stable absolute IRIs for relation types and pick the default from your own list. [Base Vocab](../../plugins/base-vocab/) is a larger example.

`label` is the canonical label saved in the graph, and the optional `translations` field gives display labels for `en`, `it`, and `zh-CN`, each nonempty and at most 30 characters. The app tries the current locale first, then English, then `label`, and leaves document data unchanged. Translations apply only when the type's IRI and canonical label match an installed vocabulary, so custom labels stay as they are. When the vocabulary is missing or disabled, the app shows the stored label.

## Themes

Set `nesso.kind` to `"theme"`, point `entry` to your JSON definition, and leave `writes` and `capabilities` empty. A `ThemeDefinition` contains:

- `id`: a lowercase kebab-case contribution ID.
- `colors`: a `light` and a `dark` palette, each with every required token, using `#RRGGBB` or `#RRGGBBAA`. Start with [Paper's palettes](../../plugins/paper-theme/src/index.ts) or [Kernel's](../../plugins/kernel-theme/src/index.ts).
- `metrics`: `radius-control` and `radius-object` in pixels, and `duration-state` in milliseconds.

Users pick the appearance (system, light, or dark) in a separate setting, and Nesso applies the matching palette. Surfaces (`background`, `canvas`, `sidebar`) must be opaque, light in `light`, and dark in `dark`. Text needs 4.5:1 contrast on each surface and on `primary`. `shadow` colors elevated surfaces such as menus and popovers. Each `preset-*` token sets the background of a concept color preset, and because concept text uses `foreground`, `foreground` needs 4.5:1 contrast on every preset.

Themes cannot add arbitrary CSS or their own fonts, and a theme package ships only its JSON entry. Nesso owns `--font-sans` (Geist) and `--font-mono` (IBM Plex Mono), with system fallbacks for other scripts, so switching themes leaves typography unchanged.

## API reference

Import graph and operation types from `@nesso-how/plugin`. You do not need a separate `@nesso-how/core` dependency.

For the full API and validation rules, see [action types](src/runtime.ts), [graph operations](../core/src/types.ts), and [theme/vocabulary schemas](src/definitions.ts).
