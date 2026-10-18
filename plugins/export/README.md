# @nesso/export

Isolated action plugin exporting a view as JSON-LD.

## Usage

The bundled **Export** action runs in a fresh worker. It receives only the invoked view (`null` targets the complete graph), without changing navigation. The host saves the JSON-LD through a native desktop dialog or browser download.

The host lists view-scoped actions in the saved-view menus and resolves labels and notifications from the English, Italian, and Simplified Chinese messages in `package.json.i18n`. Graph contents are exported unchanged. A completion notification is sent only after the host accepts the save, not on cancellation or failure.

## API

- `create(context)`: factory contributing the `export-view` action. Declarations live in `package.json`: `view` reads, no writes, and `files.save`/`notifications.notify` capabilities.

See [src/index.ts](src/index.ts) for definitions.
