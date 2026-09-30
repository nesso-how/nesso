import { parseGraph } from '@nesso/schema'
import { useSyncExternalStore } from 'react'
import seed from '../data/seed-graph.json'
import { createNessoStore } from './create.ts'
import { connectPersistence, loadPersistence } from './persistence.ts'
import type { HostState } from './types.ts'

const storage = () => window.localStorage
const loaded = loadPersistence(storage)

export const host = createNessoStore(
  loaded.graph === undefined && !loaded.blocked.includes('document') ? parseGraph(seed) : loaded.graph ?? null,
  loaded,
)
host.ui.setPersistenceIssues(loaded.issues)

export const { store: nessoStore, registerVocab, registerRenderer, getRenderer, listRenderers } = host

export const startAutosave = (): (() => void) => {
  const persistence = connectPersistence(host, storage, loaded)
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') persistence.flush()
  }
  window.addEventListener('pagehide', persistence.flush)
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    window.removeEventListener('pagehide', persistence.flush)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    persistence.dispose()
  }
}

export function useNessoStore<T>(selector: (state: HostState) => T): T {
  return useSyncExternalStore(nessoStore.subscribe, () => selector(nessoStore.getState()))
}
