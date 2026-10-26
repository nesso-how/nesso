import type { createNessoStore } from '../store/create.ts'
import type { ThemeDefinition } from '@nesso-how/plugin'

export const connectTheme = (
  host: ReturnType<typeof createNessoStore>,
  applyTheme: (definition: ThemeDefinition) => void,
): (() => void) => {
  let applied: ThemeDefinition | undefined
  const apply = (): void => {
    const id = host.store.getState().preferences.activeThemeId
    const definition = host.getTheme(id)
    if (definition === applied || !definition) return
    applyTheme(definition)
    applied = definition
  }
  apply()
  return host.store.subscribe(apply)
}
