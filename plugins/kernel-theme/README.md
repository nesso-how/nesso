# @nesso-how/kernel-theme

Kernel, Nesso's default light-only theme, providing semantic tokens and bundled fonts.

## Usage

The build supplies the manifest, `definition.json` data, and local WOFF2 assets. The host parses and validates the definition without executing it. No Kernel stylesheet or executable module is imported into the host.

The host applies only validated tokens and generates font rules with content-scoped family names. The trusted renderer inherits these directly from the host. Component recipes and layout stay outside this plugin; Kernel is the bundled fallback theme.

## API

- `definition.json`: Kernel's concrete colors, numeric metrics, and local font-face descriptors, generated from `src/index.ts` at build time. Metadata and empty access declarations live in `package.json`.

See [src/index.ts](src/index.ts) for definitions and the [plugin guide](../../packages/plugin/README.md).
