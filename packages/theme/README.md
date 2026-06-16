# @nesso-how/theme

The design tokens for Nesso. This is the one place colours, fonts, spacing and radii are defined. The app, the graph package and the docs site all read from here, so changing a value once changes it everywhere.

Tokens are plain TypeScript objects. Each consumer turns them into CSS variables (or reads the raw hex, for embeds). There is no `theme.css` to import, because the consumers don't share a variable namespace: the app reads `--paper`, Starlight reads `--sl-color-bg`, and so on. Each one emits the variables it needs from the same source.

## What lives here, and what doesn't

Category colours (the `--cat-*` variables for edge types) belong to the relation vocabulary, so they stay in `@nesso-how/relation-types`, not here. A theme pack only names the palette it pairs with (`categoryPalette`); the palette switch and the theme switch stay independent.

A token belongs in this package when it both varies by theme or mode and is shared across the app, the graph and the docs. That covers surface and ink colours, accent, shadows, fonts, and the type, spacing and radii scales. It leaves out anything structural rather than visual: z-index, breakpoints and app layout sizes (status bar height, sidebar width) live in the app, and motion is a foundation constant unless a pack needs to tune it.

## How a theme pack is shaped

A `ThemePack` has two halves.

The mode-varying half is `light` and `dark`: surface colours, accent, the recall heatmap and shadows. You write `dark` as a diff over `light`, listing only what changes. Anything you leave out (the recall scale, in the default pack) is inherited from light, so the two modes never double the work.

The mode-invariant half is identical in light and dark: the fonts, the type scale (sizes, weights, line heights), spacing and radii.

One thing to know about radii: `sm` through `xl` are steps on a scale, but `pill` (999px) and `circle` (50%) are shapes, not steps. Don't reach for them as the small or large end of the ramp.

## Turning tokens into CSS

```ts
import { defaultTheme, themeCss, modeVars, baseVars } from '@nesso-how/theme'

// A full stylesheet: light tokens under :root, dark under [data-theme='dark'].
themeCss(defaultTheme)

// Or the flat records, to set on an element yourself.
baseVars(defaultTheme) // { '--font-sans': "...", '--space-6': '12px', ... }
modeVars(defaultTheme, 'dark') // { '--paper': '#1a1714', '--accent': '#c47a82', ... }
```

The app injects `themeCss(defaultTheme)` into the page head at build time, through the `nessoTheme()` Vite plugin in `vite.config.ts`, so the variables exist before the first paint. Category colours are applied separately, from the relation-types palette. The docs site does the same through `docs/scripts/gen-theme-css.mjs`, which also produces a Starlight version with `starlightCss`.

## Changing the default theme

Edit `src/default.ts`. Every colour, font, spacing and radius value the app uses is in there. Change it here, not in the app's CSS or components, and it flows everywhere.

## Adding a theme pack

Start from the default, override only what differs, then register it:

```ts
// src/packs/ledger.ts
import { defaultTheme, defineTheme } from '@nesso-how/theme'

export const ledger = defineTheme(defaultTheme, {
  id: 'ledger',
  name: 'Ledger',
  categoryPalette: 'muted',
  radii: { sm: '2px', md: '3px', lg: '4px' }, // a sharper look
  light: { color: { paper: '#f7f3e8' } }, // parchment
  dark: { color: { paper: '#14120d' } }, // its own dark, not a global invert
})
```

Then add it to the `themes` map in `src/registry.ts`. `defineTheme` deep-merges and never touches the base, so a pack states only what it changes.
