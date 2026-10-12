import type { NessoState, PluginContext } from '@nesso/plugin'
import { createContext, useContext, useSyncExternalStore } from 'react'

export const StoreContext = createContext<PluginContext | null>(null)

export function usePluginContext(): PluginContext {
  const context = useContext(StoreContext)
  if (!context) throw new Error('Graph renderer rendered outside its provider')
  return context
}

export function useNesso<T>(selector: (state: NessoState) => T): T {
  const { store } = usePluginContext()
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()))
}
