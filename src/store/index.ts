import { useSyncExternalStore } from 'react'
import { initializeNessoStore } from './initialize.ts'
import { connectPersistence, loadPersistence } from './persistence.ts'
import type { HostState } from './types.ts'

const storage = () => window.localStorage
const loaded = loadPersistence(storage)

export const host = initializeNessoStore(loaded, navigator.languages)

export const { store: nessoStore, registerVocab, registerRenderer, getRenderer, registerTheme } = host

export const startAutosave = (): (() => void) => {
  const persistence = connectPersistence(host, storage, loaded)
  const stopUpdateSave = window.nessoUpdater?.beforeInstall(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    persistence.flush()
    return host.store.getState().persistenceIssues.length === 0
  })
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') persistence.flush()
  }
  window.addEventListener('pagehide', persistence.flush)
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    stopUpdateSave?.()
    window.removeEventListener('pagehide', persistence.flush)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    persistence.dispose()
  }
}

export function useNessoStore<T>(selector: (state: HostState) => T): T {
  return useSyncExternalStore(nessoStore.subscribe, () => selector(nessoStore.getState()))
}
