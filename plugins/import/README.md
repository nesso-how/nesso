# @nesso-how/import

An action plugin that imports concepts and maps from a Nesso JSON-LD file.

## Usage

The bundled **Import** action runs in an isolated worker and reads a file the user selects through the host. It imports concepts with fresh IDs and brings along labels, concept notes, relations, and missing relation types, all in one atomic history entry.

Each map in the file becomes a new map with its layout and styles, and an unnamed map takes the file name. The last imported map becomes active, so the canvas frames it. A file without maps imports only concepts and relations, so it creates no maps, leaves navigation as it is, and adds nothing to the active map. An invalid file reports a localized failure and leaves the graph untouched.

Import and export exchange graph data and optional maps, but not the complete application state. Use a manual backup for full restoration.

## API

- `create()`: factory contributing the `import` action, whose `run(context)` receives its execution APIs. Access declarations and the localized labels and failure text live in `package.json`, and Nesso resolves the current language with English as the fallback.
- `deriveMapName(fileName)`: returns the file basename without its extension or `nesso-` prefix, with dashes normalized, at most 70 characters long.
- `buildImportOperations(snapshot, mapId, mapName)`: a pure function that builds an atomic operation batch, which merges a parsed graph and recreates only the maps present in the file.

See [src/index.ts](src/index.ts) for definitions.
