# Theme tokens

`@nesso-how/theme` (`packages/theme/`) is the **single source of truth** for theme tokens — surface/ink colours, accent/highlight, recall heatmap, shadows, fonts, and the type/space/radii scales. Every theme change happens there.

## Hard rules

- **Never hardcode or duplicate a theme value elsewhere.** No hex, shadow, font, spacing, or radius literals in `src/**`, `packages/graph/**`, or `docs/**` for something that is a theme token. Add or edit the token in `packages/theme/src/default.ts` and consume the emitted CSS variable (`var(--paper)`, `var(--accent)`, `var(--space-6)`, `var(--radius-lg)`, …).
- **Tokens become CSS variables through the package emitters** (`themeCss`, `modeVars`, `baseVars` in `packages/theme/src/css.ts`), not by writing `:root` blocks by hand. The app injects them into `<head>` at build time via the `nessoTheme` Vite plugin in `vite.config.ts` (so the variables exist at first paint); `index.css` holds only structural CSS.
- **If you find app-side theme code, move it into the package.** A stray `:root`/`[data-theme]` token block, an inline hex that matches a token, or a re-mapped copy (e.g. Starlight `--sl-color-*` in `docs/`) is a regression — relocate the value to `default.ts` and consume it.

## Boundary with `@nesso-how/vocab-learning`

Category colours (`--cat-*`) are part of the relation-type **vocabulary** and live only in `@nesso-how/vocab-learning` `PALETTES`. The theme package references the active palette by name (`ThemePack.categoryPalette`); the palette switch stays **orthogonal** to the theme switch. Do not move category colours into the theme package, and do not duplicate them in `index.css`.

## What belongs here (and what does not)

A token enters the package only if it **(a) varies by theme or mode** _and_ **(b) is shared across app + graph + docs/landing**. That admits colour/shadow (mode-varying) and font/type/space/radii (theme-varying, mode-invariant).

It excludes, by design: z-index and breakpoints (structural constants → app-side, e.g. `src/lib/`), app layout dimensions (`STATUS_BAR_HEIGHT_PX`, `INSPECTOR_RAIL_WIDTH`, sidebar width → component constants), and motion (a foundation constant unless a pack needs to tune feel).

## Light/dark and new packs

`light` is full; `dark` is a **diff** over it (specify only what changes). Mode-invariant axes are not repeated per mode. New packs derive from the default via `defineTheme(defaultTheme, override)` and register in `packages/theme/src/registry.ts`. See `packages/theme/README.md` for the authoring guide.
