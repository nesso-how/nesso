# @nesso-how/notes

Isolated action plugin for free-form Markdown notes on each map without changing the graph.

## Usage

Open the bundled **Notes** action from a map’s actions. The map name is the title; the shared `MarkdownInput` editor provides live preview, task-list checkboxes, and autosave without a toolbar or Save button. Undo/redo stays local to the editor. The graph has document-level notes; each map has its own notes. Reopening the panel restores each map's scroll position from memory until the app closes or the document changes; it is never saved.

With the editor focused, press Cmd/Ctrl+F to find text in the current note. Enter goes to the next match, Shift+Enter goes to the previous match, and Escape returns focus to the note.

Notes are private plugin data, separate from concept notes, JSON-LD exports, and graph history, but included in backups. Deleting a map retains its notes across restart; undoing deletion reconnects them. There is no automatic cleanup or orphan-recovery interface.

Invalid saved data is never overwritten. Failed writes preserve the visible draft and block further edits; copy the text before reopening. Both failures show a persistent warning banner at the bottom of the panel, outside the scrolling content; restore failures offer **Reload notes**. Closing the panel or changing maps can interrupt pending saves.

## API

- `create()`: factory contributing the `notes` action with an isolated React panel. Metadata and `storage`/`ui` access declarations live in `package.json`; localized action labels and panel messages live in `src/index.ts` and `src/i18n.ts`.
- `createNotes(storage, mapId)`: plugin-local draft and serialized autosave, without debounce or automatic retries. Stores a versioned `notes` record at document scope for `null`, otherwise at `{ kind: 'map', id: mapId }`. The host owns persistence; the plugin owns the payload schema.

See [src/index.ts](src/index.ts), [src/notes.ts](src/notes.ts), and the [plugin guide](../../packages/plugin/README.md).
