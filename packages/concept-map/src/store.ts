import type { NessoState, NessoStore } from '@nesso-how/core'
import { NessoError } from '@nesso-how/errors'
import type { Position } from '@nesso-how/schema'
import { createContext, useContext, useSyncExternalStore, type RefObject } from 'react'

export type GraphCommands = {
  readonly deleteSelection: () => void
  readonly copy: (cut?: boolean) => Promise<void>
  readonly paste: (text?: string, position?: Position) => Promise<void>
}

export type ConceptMapContext = {
  readonly store: Pick<
    NessoStore,
    'getState' | 'subscribe' | 'applyOperations' | 'conceptPlacementOffset' | 'undo' | 'redo'
  >
  readonly commands: GraphCommands
}

export type CanvasProps = {
  readonly focusRef: RefObject<HTMLDivElement | null>
  readonly readOnly?: boolean
  readonly preview?: boolean
  readonly bottomInset?: number
  readonly conceptLabelMaxLength?: number
}

export const StoreContext = createContext<ConceptMapContext | null>(null)

class ConceptMapError extends NessoError {
  override name = 'ConceptMapError'
}

export function useCanvasContext(): ConceptMapContext {
  const context = useContext(StoreContext)
  if (!context)
    throw new ConceptMapError([
      { path: 'context', message: 'Graph renderer rendered outside its provider' },
    ])
  return context
}

export function useNesso<T>(selector: (state: NessoState) => T): T {
  const { store } = useCanvasContext()
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()))
}
