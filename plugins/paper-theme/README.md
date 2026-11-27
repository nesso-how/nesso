# @nesso-how/paper-theme

Paper is a warm theme with light and dark palettes, terracotta accents, and slightly softer corners than Kernel.

## Usage

Select Paper in Settings → General → Theme, or open Paper under Plugins and choose Use. Kernel remains the default and fallback theme. Changing themes leaves the graph and maps untouched.

The package supplies the manifest and `definition.json`, which the host validates and applies without executing plugin code. The host supplies the fonts independently of themes, and the trusted renderer inherits the same tokens and host fonts.

## API

- `definition.json`: colors and numeric metrics, generated from `src/index.ts`. Metadata and empty access declarations live in `package.json`.

See [src/index.ts](src/index.ts) and the [plugin guide](../../packages/plugin/README.md).
