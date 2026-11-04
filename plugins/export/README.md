# @nesso-how/export

Isolated action plugin exporting a view as JSON-LD or PNG.

## Usage

The bundled **Export json** and **Export PNG** actions run in a fresh worker. They receive only the invoked view (`null` targets the complete graph), without changing navigation. The host saves the file through a native desktop dialog or browser download.

PNG export captures the full view at 4× resolution with the current theme and fonts, without selection or canvas controls. See the [plugin SDK](../../packages/plugin/README.md#files-images-notifications-and-failures) for image and file APIs.

The host lists view-scoped actions in the saved-view menus and resolves labels and notifications from the English, Italian, and Simplified Chinese messages in `package.json.i18n`. Graph contents are exported unchanged. A completion notification is sent only after the host accepts the save, not on cancellation or failure.

## API

- `create()`: factory contributing the `export` and `export-png` actions; `run(context)` receives its execution APIs. Declarations live in `package.json`: no writes, and `files`/`images`/`notifications` capabilities.

See [src/index.ts](src/index.ts) for definitions.
