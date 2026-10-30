import { useSyncExternalStore } from 'react'
import { initializeNessoStore } from './initialize.ts'
import { connectPersistence, loadPersistence } from './persistence.ts'
import type { HostState, HostStore } from './types.ts'
import { createDesktopStorage, createIndexedDbStorage } from './storage.ts'

const storage = window.nessoPersistence
  ? createDesktopStorage(window.nessoPersistence)
  : createIndexedDbStorage(() => window.indexedDB)
const loaded = await loadPersistence(storage)

export const host = initializeNessoStore(loaded, navigator.languages)

host.registerRenderer({ id: 'concept-map' })

export const { store: nessoStore, registerVocab, registerTheme } = host

export const startAutosave = (prepare: () => void) => {
  const persistence = connectPersistence(host, storage, loaded)
  const save = async () => {
    prepare()
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    return persistence.flush()
  }
  const stopUpdateSave = window.nessoUpdater?.beforeInstall(save)
  const stopMoveSave = window.nessoDataLocation?.beforeMove(async () => {
    prepare()
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    host.setWritesPaused(true)
    return persistence.flush()
  })
  const stopMoveState = window.nessoDataLocation?.subscribe((state) => {
    if (!state.moving) host.setWritesPaused(false)
  })
  const flush = () => {
    void persistence.flush()
  }
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', onVisibilityChange)
  return {
    ...persistence,
    save,
    dispose: () => {
      stopUpdateSave?.()
      stopMoveSave?.()
      stopMoveState?.()
      host.setWritesPaused(false)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void persistence.dispose()
    },
  }
}

export function useNessoStore<T>(
  selector: (state: HostState) => T,
  store: HostStore = nessoStore,
): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()))
}
