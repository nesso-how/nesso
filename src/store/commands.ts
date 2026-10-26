import { createWriteCommands, type NessoStore } from '@nesso-how/plugin'
import { newIri } from '@nesso-how/schema'
import { conceptPlacementOffset } from './operations.ts'

export const createCommands = (applyOperations: NessoStore['applyOperations']): Omit<NessoStore, 'getState' | 'subscribe' | 'getViewGraph'> => ({
  ...createWriteCommands(applyOperations, (id) => id),
  conceptPlacementOffset,
  applyOperations,
  setViewport: (rendererId, value) => applyOperations([{ kind: 'viewport.set', rendererId, value }]),
  setActiveRenderer: (id) => applyOperations([{ kind: 'preferences.renderer', id }]),
  resetGraph: () => applyOperations([{ kind: 'document.reset', id: newIri() }]),
})
