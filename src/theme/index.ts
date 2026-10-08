import type { createNessoStore } from '../store/create.ts'

export const connectTheme = (
  host: ReturnType<typeof createNessoStore>,
  root: Pick<HTMLElement, 'setAttribute'>,
): (() => void) => {
  let appliedId: string | undefined
  const apply = (): void => {
    const id = host.store.getState().preferences.activeThemeId
    if (id === appliedId || !host.getTheme(id)) return
    root.setAttribute('data-theme', id)
    appliedId = id
  }
  apply()
  return host.store.subscribe(apply)
}
