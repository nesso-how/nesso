// SPDX-License-Identifier: MIT
import { deepMerge } from './merge.js'
import type { ModeTokens, ThemeMode, ThemePack } from './types.js'

/** Fully resolved colour + shadow tokens for a mode (dark = light + dark diff). */
export function resolveMode(pack: ThemePack, mode: ThemeMode): ModeTokens {
  return mode === 'light' ? pack.light : deepMerge(pack.light, pack.dark)
}

/** Mode-varying CSS variables (`--paper`, `--ink-2`, `--accent`, `--shadow-md` …). */
export function modeVars(pack: ThemePack, mode: ThemeMode): Record<string, string> {
  const { color: c, shadow: s } = resolveMode(pack, mode)
  return {
    '--paper': c.paper,
    '--paper-deep': c.paperDeep,
    '--ink': c.ink[1],
    '--ink-2': c.ink[2],
    '--ink-3': c.ink[3],
    '--ink-4': c.ink[4],
    '--ink-5': c.ink[5],
    '--bg-elev': c.bgElev,
    '--bg-card': c.bgCard,
    '--line': c.line,
    '--line-strong': c.lineStrong,
    '--grid-dot': c.gridDot,
    '--accent': c.accent,
    '--highlight': c.highlight,
    '--highlight-soft': c.highlightSoft,
    '--highlight-selection': c.highlightSelection,
    '--conf-1': c.recall[1],
    '--conf-2': c.recall[2],
    '--conf-3': c.recall[3],
    '--conf-4': c.recall[4],
    '--conf-5': c.recall[5],
    '--shadow-md': s.md,
    '--shadow-lg': s.lg,
    '--drop-shadow-lg': s.dropLg,
  }
}

/** Mode-invariant CSS variables (fonts, type scale, spacing, radii). */
export function baseVars(pack: ThemePack): Record<string, string> {
  const { font, type, space, radii } = pack
  return {
    '--font-display': font.display,
    '--font-sans': font.sans,
    '--font-mono': font.mono,
    '--font-feature': font.featureSettings,
    '--text-xs': type.size.xs,
    '--text-sm': type.size.sm,
    '--text-base': type.size.base,
    '--text-md': type.size.md,
    '--text-lg': type.size.lg,
    '--text-xl': type.size.xl,
    '--font-weight-regular': String(type.weight.regular),
    '--font-weight-medium': String(type.weight.medium),
    '--font-weight-semibold': String(type.weight.semibold),
    '--leading-tight': String(type.leading.tight),
    '--leading-normal': String(type.leading.normal),
    '--space-0': space[0],
    '--space-1': space[1],
    '--space-2': space[2],
    '--space-3': space[3],
    '--space-4': space[4],
    '--space-5': space[5],
    '--space-6': space[6],
    '--space-7': space[7],
    '--space-8': space[8],
    '--space-9': space[9],
    '--radius-none': radii.none,
    '--radius-sm': radii.sm,
    '--radius-md': radii.md,
    '--radius-lg': radii.lg,
    '--radius-xl': radii.xl,
    '--radius-pill': radii.pill,
    '--radius-circle': radii.circle,
  }
}

export function declarations(vars: Record<string, string>, indent = '  '): string {
  return Object.entries(vars)
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join('\n')
}

/**
 * Full stylesheet for a pack: mode-invariant tokens + light tokens under
 * `:root`, dark tokens under `[data-theme='dark']`. Category colours are NOT
 * emitted here — they come from `@nesso-how/relation-types` `PALETTES`, applied
 * separately so the palette switch stays orthogonal.
 */
export function themeCss(pack: ThemePack): string {
  const root = { ...baseVars(pack), ...modeVars(pack, 'light') }
  return [
    `:root {\n${declarations(root)}\n}`,
    `[data-theme='dark'] {\n${declarations(modeVars(pack, 'dark'))}\n}`,
  ].join('\n\n')
}
