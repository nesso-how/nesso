# @nesso-how/kernel-theme

Kernel, Nesso's default light-only theme, providing semantic tokens.

## Usage

The package supplies the manifest and `definition.json` data. The host parses and validates the definition without executing it. No Kernel stylesheet or executable module is imported into the host.

The host applies only validated tokens and supplies Geist and IBM Plex Mono independently of themes. The trusted renderer inherits these directly from the host. Component recipes and layout stay outside this plugin; Kernel is the bundled fallback theme.

## API

- `definition.json`: Kernel's concrete colors and numeric metrics, generated from `src/index.ts` at build time. Metadata and empty access declarations live in `package.json`.

See [src/index.ts](src/index.ts) for definitions and the [plugin guide](../../packages/plugin/README.md).
