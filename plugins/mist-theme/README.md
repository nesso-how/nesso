# @nesso-how/mist-theme

Mist is a cool light-only theme with misty blue surfaces, slate text, and steel blue accents. It uses Geist and IBM Plex Mono.

## Usage

Select Mist in Settings → General → Theme, or open Mist under Plugins and choose Use. Kernel remains the default and fallback theme. Changing themes does not modify the graph or views.

The package supplies the manifest and `definition.json`. The host validates and applies these data without executing plugin code, and supplies the fonts independently of themes. The trusted renderer inherits the same tokens and host fonts.

## API

- `definition.json`: colors and numeric metrics, generated from `src/index.ts`. Metadata and empty access declarations live in `package.json`.

See [src/index.ts](src/index.ts) and the [plugin guide](../../packages/plugin/README.md).
