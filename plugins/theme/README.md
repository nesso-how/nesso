# @nesso/theme

Light-only theme plugin providing the app's palette, Geist font, and base radius.

## Usage

Add `themePlugin` to the static plugin list in `src/plugins.ts` and import `@nesso/theme/styles.css` in `src/index.css`.

The host resolves the active theme id in app preferences and applies it as `data-theme` to the document root, so portaled UI inherits the same tokens. It maps tokens to Tailwind utilities and applies global base styles; component recipes and layout remain outside this plugin.

Stylesheets are bundled at build time, not fetched when a theme is selected. Registering a theme does not load its CSS: the stylesheet must also be imported statically. The host observes `activeThemeId` and switches themes by changing `data-theme`; each stylesheet scopes its tokens to its own theme id. There is currently one theme and no theme selector.

Including theme CSS upfront avoids a stylesheet download on switching, at the cost of a larger initial CSS bundle. The browser still recalculates styles and repaints, and new fonts may load separately.

## API

- `themePlugin`: static plugin factory contributing the `nesso-light` theme definition without accessing the store or DOM.
- `@nesso/theme/styles.css`: Geist font assets and semantic CSS tokens scoped to `:root[data-theme='nesso-light']`.
