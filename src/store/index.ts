import type { NessoState } from '@nesso/plugin'
import { parseGraph } from '@nesso/schema'
import { useSyncExternalStore } from 'react'
import sample from '../../data/sample-graph.json'
import { createNessoStore } from './create.ts'

export const { store: nessoStore, registerVocab, registerRenderer, getRenderer, listRenderers } =
  createNessoStore(parseGraph(sample))

export function useNessoStore<T>(selector: (state: NessoState) => T): T {
  return useSyncExternalStore(nessoStore.subscribe, () => selector(nessoStore.getState()))
}
