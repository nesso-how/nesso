# @nesso-how/notes

Isolated action plugin for free-form Markdown notes on each view without changing the graph.

## Usage

Open the bundled **Notes** action from a view’s actions. The view name is the title; the shared `MarkdownInput` editor provides live preview and autosave without a toolbar or Save button. Undo/redo stays local to the editor. Overview has document-level notes; each saved view has its own notes. Reopening the panel restores each view's scroll position from memory until the app closes or the document changes; it is never saved.

Notes are private plugin data, separate from concept notes, JSON-LD exports, and graph history, but included in backups. Deleting a view retains its notes across restart; undoing deletion reconnects them. There is no automatic cleanup or orphan-recovery interface.

Invalid saved data is never overwritten. Failed writes preserve the visible draft and block further edits; copy the text before reopening. Both failures show a persistent warning banner at the bottom of the panel, outside the scrolling content; restore failures offer **Reload notes**. Closing the panel or changing views can interrupt pending saves.

## API

- `create()`: factory contributing the `notes` action with an isolated React panel. Metadata and `storage`/`ui` access declarations live in `package.json`; localized action labels and panel messages live in `src/index.ts` and `src/i18n.ts`.
- `createNotes(storage, viewId)`: plugin-local draft and serialized autosave, without debounce or automatic retries. Stores a versioned `notes` record at document scope for `null`, otherwise at `{ kind: 'view', id: viewId }`. The host owns persistence; the plugin owns the payload schema.

See [src/index.ts](src/index.ts), [src/notes.ts](src/notes.ts), and the [plugin guide](../../packages/plugin/README.md).
