# @nesso-how/import

Action plugin importing concepts and maps from a Nesso JSON-LD file.

## Usage

The bundled **Import** action runs in an isolated worker and reads a user-selected file through the host. It imports concepts with fresh IDs, preserving labels, notes, relations, and missing relation types in one atomic history entry. Each map in the file becomes a new map with its layout and styles, using the file name when unnamed. The last imported map is activated, so the canvas frames it. Files without maps import only concepts and relations, without creating maps, changing navigation, or adding concepts to the active map. Invalid files report a localized failure without touching the graph.

Import/export exchange graph data and optional maps, not the complete application state; use a manual backup for full restoration.

## API

- `create()`: factory contributing the `import` action; `run(context)` receives its execution APIs. Access declarations and localized labels/failure text live in `package.json`; Nesso resolves the current language with an English fallback.
- `deriveMapName(fileName)`: file basename without extension and `nesso-` prefix, dashes normalized, max 70 chars.
- `buildImportOperations(snapshot, mapId, mapName)`: pure creation of an atomic operation batch merging a parsed graph and recreating only the maps present in the file.

See [src/index.ts](src/index.ts) for definitions.
