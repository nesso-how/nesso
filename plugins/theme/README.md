# @nesso/theme

Kernel, the default light-only theme: white surfaces, silver navigation, mist canvas, graphite states, 3px controls, and 4px graph objects/dialogs.

## Usage

Add `themePlugin` to the static plugin list in `src/plugins.ts` and import `@nesso/theme/styles.css` in `src/index.css`.

The host validates theme identities, resolves `activeThemeId` from app preferences, and applies it as `data-theme` to the document root. Shared UI maps semantic tokens to Tailwind utilities; component recipes and layout remain outside this plugin.

Stylesheets and fonts are bundled statically. Each theme scopes its tokens to its own id; registration does not load CSS. The host observes the active theme preference, but there is currently one theme and no theme selector.

## API

- `kernelTheme`: Kernel's id and label (`ThemeDefinition` from `@nesso/plugin`).
- `themePlugin`: read-only operation declaration and factory returning the theme contribution; no store mutation or lifecycle hooks.
- `styles.css`: semantic CSS tokens scoped to `:root[data-theme='kernel']`, importing bundled fonts.
- `fonts.css`: locally bundled Geist and IBM Plex Mono font declarations.
