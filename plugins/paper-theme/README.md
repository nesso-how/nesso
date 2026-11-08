# @nesso-how/paper-theme

Paper is a light-only theme with ivory surfaces, ink text, and restrained terracotta accents. It uses Geist and IBM Plex Mono, with slightly softer corners than Kernel.

## Usage

Select Paper in Settings → General → Theme, or open Paper under Plugins and choose Use. Kernel remains the default and fallback theme. Changing themes does not modify the graph or views.

The package supplies the manifest and `definition.json`. The host validates and applies these data without executing plugin code, and supplies the fonts independently of themes. The trusted renderer inherits the same tokens and host fonts.

## API

- `definition.json`: colors and numeric metrics, generated from `src/index.ts`. Metadata and empty access declarations live in `package.json`.

See [src/index.ts](src/index.ts) and the [plugin guide](../../packages/plugin/README.md).
