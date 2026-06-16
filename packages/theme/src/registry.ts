// SPDX-License-Identifier: MIT
import { defaultTheme } from './default.js'
import { deepMerge } from './merge.js'
import type { DeepPartial, ThemeOverride, ThemePack } from './types.js'

/**
 * Derive a new theme pack from a base by overriding only what changes. This is
 * how the registry stays extensible: a new pack declares its diff, not a full
 * copy. The default pack is the conventional base.
 */
export function defineTheme(base: ThemePack, override: ThemeOverride): ThemePack {
  return deepMerge(base, override as DeepPartial<ThemePack>)
}

/** All built-in packs, keyed by `id`. Add new packs here once defined. */
export const themes: Record<string, ThemePack> = {
  [defaultTheme.id]: defaultTheme,
}

export function getTheme(id: string): ThemePack {
  return themes[id] ?? defaultTheme
}
