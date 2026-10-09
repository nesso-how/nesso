# @nesso/kernel

Kernel, Nesso's default light-only theme, providing semantic tokens and bundled fonts.

## Usage

Register `kernelPlugin` using the [plugin guide](../../packages/plugin/README.md#register-it) and import `@nesso/kernel/styles.css` in [src/index.css](../../src/index.css).

Registration contributes identity metadata, not CSS loading. Stylesheets and fonts are bundled statically; tokens are scoped to `:root[data-theme='kernel']`. The host applies `activeThemeId` as `data-theme` on the document root. Component recipes and layout stay outside this plugin; there is currently one theme and no theme selector.

## API

- `kernelTheme`: Kernel's ID.
- `kernelPlugin`: declares no writes and returns the theme identity.
- `styles.css`: semantic theme tokens and font imports.
- `fonts.css`: bundled Geist and IBM Plex Mono imports.

See [src/index.ts](src/index.ts) and [src/styles.css](src/styles.css) for definitions.
