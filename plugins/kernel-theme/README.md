# @nesso-how/kernel-theme

Kernel is Nesso's default and bundled fallback theme, with light and dark palettes.

## Usage

The package supplies the manifest and `definition.json` data, which the host parses and validates without executing. The host imports no Kernel stylesheet or executable module.

The host applies only validated tokens, while component recipes and layout stay outside this plugin. It supplies Geist and IBM Plex Mono independently of themes, and the trusted renderer inherits these fonts directly from the host.

## API

- `definition.json`: Kernel's concrete colors and numeric metrics, generated from `src/index.ts` at build time. Metadata and empty access declarations live in `package.json`.

See [src/index.ts](src/index.ts) for definitions and the [plugin guide](../../packages/plugin/README.md).
