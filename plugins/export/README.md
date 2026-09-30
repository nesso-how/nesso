# @nesso/export

Action plugin exporting the visible graph as a JSON-LD download.

## Usage

Add `exportPlugin` to the static plugin list in `src/plugins.ts`; it contributes an `Export` button to the navbar that downloads whatever the host currently shows (focused neighborhood or whole graph).

## API

- `exportPlugin`: static plugin factory contributing the `export-view` action.
