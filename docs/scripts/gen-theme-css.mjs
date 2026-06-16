// SPDX-License-Identifier: MIT
import { writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { PALETTES } from '@nesso-how/relation-types'
import { defaultTheme, starlightCss, themeCss } from '@nesso-how/theme'

/**
 * Generate the docs theme CSS from `@nesso-how/theme` so the site consumes the
 * same source of truth as the app instead of hand-copied hex. Runs on
 * `predev` / `prebuild`; outputs are git-ignored. Edit theme values in
 * `packages/theme/src/default.ts`, never in the generated files.
 */
const header = (what) =>
  '/* SPDX-License-Identifier: MIT */\n' +
  `/* GENERATED ${what} from @nesso-how/theme by docs/scripts/gen-theme-css.mjs — do not edit. */\n\n`

const styles = (name) => fileURLToPath(new URL(`../src/styles/${name}`, import.meta.url))

// Starlight chrome (`--sl-color-*`) for the documentation pages.
writeFileSync(
  styles('theme.generated.css'),
  `${header('(Starlight)')}${starlightCss(defaultTheme)}\n`,
)

// App-namespace tokens (`--paper`/`--ink`/`--cat-*`/…) for the standalone landing
// page, which lives outside Starlight and consumes the app variables directly.
const palette = PALETTES[defaultTheme.categoryPalette] ?? PALETTES.default
const categoryRoot = `:root {\n${Object.entries(palette)
  .map(([cat, hex]) => `  --cat-${cat}: ${hex};`)
  .join('\n')}\n}`
writeFileSync(
  styles('theme.app.generated.css'),
  `${header('(app tokens)')}${themeCss(defaultTheme)}\n\n${categoryRoot}\n`,
)
