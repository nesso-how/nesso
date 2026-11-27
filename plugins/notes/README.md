# @nesso-how/notes

An isolated action plugin for free-form Markdown notes on each map. It leaves the graph unchanged.

## Usage

See [Notes in the map actions reference](../../docs/guide.md#notes) for editing, search, and recovery after a failed save.

## API

- `create()`: factory contributing the `notes` action with an isolated React panel. Metadata and `storage`/`ui` access declarations live in `package.json`, while localized action labels and panel messages live in `src/index.ts` and `src/i18n.ts`.
- `createNotes(storage, mapId)`: plugin-local draft and serialized autosave, with no debounce and no automatic retries. It stores a versioned `notes` record at document scope when `mapId` is `null` and at `{ kind: 'map', id: mapId }` otherwise. The host owns persistence, and the plugin owns the payload schema.

Scroll position is kept in memory for each map until the document changes or the app closes. A failed write makes the draft read-only but leaves search available, and closing a panel can interrupt a pending save. Deleting a map keeps its stored note, and these orphaned notes are not cleaned up automatically.

See [src/index.ts](src/index.ts), [src/notes.ts](src/notes.ts), and the [plugin guide](../../packages/plugin/README.md).
