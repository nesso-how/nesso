import type { NessoState, NessoStore, Notifications } from '@nesso/plugin'
import { NessoError } from '@nesso/errors'
import { createContext, useContext, useSyncExternalStore } from 'react'

export type ConceptMapContext = {
  readonly store: Pick<NessoStore, 'getState' | 'subscribe' | 'applyOperations' | 'conceptPlacementOffset'>
  readonly notifications: Pick<Notifications, 'notify'>
  readonly clipboard: Pick<Clipboard, 'readText' | 'writeText'>
}

export type CanvasProps = {
  readonly readOnly?: boolean
  readonly preview?: boolean
  readonly bottomInset?: number
  readonly onDeleteView?: () => void
  readonly conceptLabelMaxLength?: number
}

export const StoreContext = createContext<ConceptMapContext | null>(null)

class ConceptMapError extends NessoError {
  override name = 'ConceptMapError'
}

export function useCanvasContext(): ConceptMapContext {
  const context = useContext(StoreContext)
  if (!context) throw new ConceptMapError([{ path: 'context', message: 'Graph renderer rendered outside its provider' }])
  return context
}

export function useNesso<T>(selector: (state: NessoState) => T): T {
  const { store } = useCanvasContext()
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()))
}
