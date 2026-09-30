import type { NessoState, NessoStore } from '@nesso/plugin'
import { createContext, useContext, useSyncExternalStore } from 'react'

export const StoreContext = createContext<NessoStore | null>(null)

export function useStore(): NessoStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('Graph renderer rendered outside its provider')
  return store
}

export function useNesso<T>(selector: (state: NessoState) => T): T {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()))
}
