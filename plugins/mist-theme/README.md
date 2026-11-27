# @nesso-how/mist-theme

Mist is a cool theme with light and dark palettes and steel blue accents.

## Usage

Select Mist in Settings → General → Theme, or open Mist under Plugins and choose Use. Kernel remains the default and fallback theme. Changing themes leaves the graph and maps untouched.

The package supplies the manifest and `definition.json`, which the host validates and applies without executing plugin code. The host supplies the fonts independently of themes, and the trusted renderer inherits the same tokens and host fonts.

## API

- `definition.json`: colors and numeric metrics, generated from `src/index.ts`. Metadata and empty access declarations live in `package.json`.

See [src/index.ts](src/index.ts) and the [plugin guide](../../packages/plugin/README.md).
