# @nesso-how/export

An isolated action plugin that exports a map as JSON-LD or PNG.

## Usage

The bundled **Export json** and **Export PNG** actions each run in a fresh worker and receive only the invoked map, where a `null` target means the complete graph. Running them does not change navigation, and the host saves the file through a native desktop dialog or a browser download.

PNG export captures the full map at 4× resolution with the current theme and fonts, leaving out selection and canvas controls. In the graph, it captures every concept as shown on the graph canvas. See the [plugin SDK](../../packages/plugin/README.md#files-images-notifications-and-failures) for image and file APIs.

The host lists map-scoped actions in the map menus and resolves their labels and notifications from the English, Italian, and Simplified Chinese messages in `package.json.i18n`. Graph contents are exported unchanged. A completion notification is sent only after the host accepts the save, and cancellation or failure sends none.

## API

- `create()`: factory contributing the `export` and `export-png` actions, whose `run(context)` receives their execution APIs. `package.json` declares no writes and the `files`, `images`, and `notifications` capabilities.

See [src/index.ts](src/index.ts) for definitions.
