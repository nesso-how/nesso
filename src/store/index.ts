import { parseGraph } from '@nesso/schema'
import { useSyncExternalStore } from 'react'
import seed from '../data/seed-graph.json'
import seedViews from '../data/seed-views.json'
import { createNessoStore } from './create.ts'
import { connectPersistence, loadPersistence } from './persistence.ts'
import type { HostState } from './types.ts'
import { createDesktopStorage, createIndexedDbStorage } from './storage.ts'

const storage = window.nessoPersistence
  ? createDesktopStorage(window.nessoPersistence)
  : createIndexedDbStorage(() => window.indexedDB)
const loaded = await loadPersistence(storage)

const firstRun = loaded.graph === undefined && !loaded.blocked.includes('document')
const graph = firstRun ? parseGraph(seed) : loaded.graph ?? null
export const host = createNessoStore(graph, firstRun ? {
  ...loaded,
  workspace: { activeViewId: null, savedViews: seedViews, viewports: {} },
} : loaded)
host.setPersistenceIssues(loaded.issues)

export const { store: nessoStore, registerVocab, registerRenderer, getRenderer, registerTheme } = host

export const startAutosave = (): (() => void) => {
  const persistence = connectPersistence(host, storage, loaded)
  const save = async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    await persistence.flush()
    return host.store.getState().persistenceIssues.length === 0
  }
  const stopUpdateSave = window.nessoUpdater?.beforeInstall(save)
  const stopCloseSave = window.nessoPersistence?.beforeClose(save)
  const flush = () => { void persistence.flush() }
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    stopUpdateSave?.()
    stopCloseSave?.()
    window.removeEventListener('pagehide', flush)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    void persistence.dispose()
  }
}

export function useNessoStore<T>(selector: (state: HostState) => T): T {
  return useSyncExternalStore(nessoStore.subscribe, () => selector(nessoStore.getState()))
}
