# Theme tokens

`@nesso-how/theme` (`packages/theme/`) is the single source of truth for shared
surface and ink colours, accents, heatmaps, shadows, fonts, and type, spacing,
and radius scales. Never duplicate theme values in `src/**`, `packages/graph/**`,
or `docs/**`; consume the emitted CSS variables.

Tokens become CSS variables through the package emitters `themeCss`, `modeVars`,
and `baseVars`. The `nessoTheme` Vite plugin injects them at first paint;
`index.css` contains structural CSS only. A stray token block or matching
literal is a regression and belongs back in the theme package.

Category colours are relation-vocabulary semantics owned by
`@nesso-how/vocab-learning` `PALETTES`. The theme package references the active
category palette by name, and must not duplicate or absorb those colours.

A token belongs in the shared package only when it varies by theme or mode and
is shared across app, graph, and docs. Structural constants such as z-indexes,
breakpoints, layout dimensions, and motion remain local unless a pack needs to
tune them.

`light` is the complete mode and `dark` is a diff. New packs derive from the
default with `defineTheme(defaultTheme, override)` and register in the theme
registry. See the package README for authoring details.
