import type { createNessoStore } from '../store/create.ts'
import type { ColorScheme, ThemeDefinition } from '@nesso-how/plugin'
import type { Preferences } from '@nesso-how/core'

type Appearance = NonNullable<Preferences['appearance']>

export const connectTheme = (
  host: ReturnType<typeof createNessoStore>,
  systemDark: Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>,
  applyTheme: (definition: ThemeDefinition, scheme: ColorScheme, appearance: Appearance) => void,
): (() => void) => {
  let applied: readonly [ThemeDefinition, ColorScheme, Appearance] | undefined
  const apply = (): void => {
    const { activeThemeId, appearance = 'system' } = host.store.getState().preferences
    const definition = host.getTheme(activeThemeId)
    const scheme = appearance === 'system' ? (systemDark.matches ? 'dark' : 'light') : appearance
    const next = [definition, scheme, appearance] as const
    if (!definition || next.every((value, index) => value === applied?.[index])) return
    applyTheme(definition, scheme, appearance)
    applied = [definition, scheme, appearance]
  }
  apply()
  const stop = host.store.subscribe(apply)
  systemDark.addEventListener('change', apply)
  return () => {
    stop()
    systemDark.removeEventListener('change', apply)
  }
}
