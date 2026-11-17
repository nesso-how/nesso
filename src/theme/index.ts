import type { createNessoStore } from '../store/create.ts'
import type { ColorScheme, ThemeDefinition } from '@nesso-how/plugin'

export const connectTheme = (
  host: ReturnType<typeof createNessoStore>,
  systemDark: Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>,
  applyTheme: (definition: ThemeDefinition, scheme: ColorScheme) => void,
): (() => void) => {
  let applied: readonly [ThemeDefinition, ColorScheme] | undefined
  const apply = (): void => {
    const { activeThemeId, appearance = 'system' } = host.store.getState().preferences
    const definition = host.getTheme(activeThemeId)
    const scheme = appearance === 'system' ? (systemDark.matches ? 'dark' : 'light') : appearance
    if (!definition || (definition === applied?.[0] && scheme === applied[1])) return
    applyTheme(definition, scheme)
    applied = [definition, scheme]
  }
  apply()
  const stop = host.store.subscribe(apply)
  systemDark.addEventListener('change', apply)
  return () => {
    stop()
    systemDark.removeEventListener('change', apply)
  }
}
