# @nesso/kernel

Kernel, Nesso's default light-only theme, providing semantic tokens and bundled fonts.

## Usage

The build supplies the manifest, autonomous module, and local WOFF2 assets. The host calls `create(context)` inside an isolated definition frame, validates the contribution, then destroys the frame. No Kernel stylesheet or executable module is imported into the host.

The host applies only validated tokens and generates font rules with content-scoped family names. The trusted renderer inherits these directly from the host. Component recipes and layout stay outside this plugin; Kernel is the bundled fallback theme.

## API

- `create`: returns Kernel's concrete colors, numeric metrics, and local font-face descriptors. Metadata and empty access declarations live in `package.json`.

See [src/index.ts](src/index.ts) for definitions and the [plugin guide](../../packages/plugin/README.md).
