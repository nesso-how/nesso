// SPDX-License-Identifier: MIT
import { declarations, resolveMode } from './css.js'
import type { ThemeMode, ThemePack } from './types.js'

/**
 * Map the theme tokens that the Starlight docs/landing site shares with the app
 * onto Starlight's `--sl-color-*` namespace. Only the cleanly-shared tokens are
 * emitted (surface, ink scale, accent, hairline); docs-specific chrome that does
 * not derive from a theme token (admonition colours, the deeper-than-surface
 * code background, the lighter/darker accent variants, the near-black `gray-7`)
 * stays owned by `docs/src/styles/custom.css`.
 */
function starlightVars(pack: ThemePack, mode: ThemeMode): Record<string, string> {
  const { color: c } = resolveMode(pack, mode)
  return {
    '--sl-color-bg': c.paper,
    '--sl-color-bg-nav': c.paper,
    '--sl-color-bg-sidebar': c.paper,
    '--sl-color-text': c.ink[1],
    '--sl-color-text-accent': c.accent,
    '--sl-color-white': c.ink[1],
    '--sl-color-black': c.paper,
    '--sl-color-accent': c.accent,
    '--sl-color-hairline': c.line,
    '--sl-color-gray-1': c.ink[1],
    '--sl-color-gray-2': c.ink[2],
    '--sl-color-gray-3': c.ink[3],
    '--sl-color-gray-4': c.ink[4],
    '--sl-color-gray-5': c.ink[5],
    '--sl-color-gray-6': c.paperDeep,
    // App-named tokens consumed directly by docs structural CSS:
    '--highlight-selection': c.highlightSelection,
  }
}

/**
 * Full Starlight stylesheet for a pack. Starlight's default theme is dark
 * (`:root`); light lives under `:root[data-theme='light']`. `--font-display` is
 * mode-invariant, so it is emitted once under `:root`.
 */
export function starlightCss(pack: ThemePack): string {
  const dark = { ...starlightVars(pack, 'dark'), '--font-display': pack.font.display }
  return [
    `:root {\n${declarations(dark)}\n}`,
    `:root[data-theme='light'] {\n${declarations(starlightVars(pack, 'light'))}\n}`,
  ].join('\n\n')
}
