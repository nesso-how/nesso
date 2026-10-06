import type { NessoOperation, NessoStore } from '@nesso/plugin'
import { newIri } from '@nesso/schema'
import { fail } from './settings.ts'

export const createCommands = (applyOperations: NessoStore['applyOperations']): Omit<NessoStore, 'getState' | 'subscribe' | 'getViewGraph'> => ({
  applyOperations,
  setSelection: (value) => applyOperations([{ kind: 'selection.set', value }]),
  setView: (id) => applyOperations([{ kind: 'view.activate', id }]),
  setViewport: (rendererId, value) => applyOperations([{ kind: 'viewport.set', rendererId, value }]),
  setConceptPosition: (id, value) => applyOperations([{ kind: 'concept.position', id, value }]),
  setConceptPositions: (updates) => applyOperations([{ kind: 'concept.positions', updates }]),
  setConceptLabel: (id, value) => applyOperations([{ kind: 'concept.label', id, value }]),
  addConcept: (position) => {
    const id = newIri()
    applyOperations([{ kind: 'concept.add', id, position }])
    return id
  },
  connect: (source, target) => applyOperations([{ kind: 'relation.connect', source, target }]),
  setRelationType: (id, typeId) => applyOperations([{ kind: 'relation.type', id, typeId }]),
  createRelationType: (id, label) => applyOperations([{ kind: 'relation.type.create', id, typeId: newIri(), label }]),
  removeConcept: (id) => applyOperations([{ kind: 'concept.remove', id }]),
  removeRelation: (id) => applyOperations([{ kind: 'relation.remove', id }]),
  setActiveVocab: (id) => applyOperations([{ kind: 'preferences.vocab', id }]),
  setActiveRenderer: (id) => applyOperations([{ kind: 'preferences.renderer', id }]),
  setActiveTheme: (id) => applyOperations([{ kind: 'preferences.theme', id }]),
  setPanelSizes: (value) => applyOperations([{ kind: 'preferences.panels', value }]),
  setSectionOpen: (id, open) => applyOperations([{ kind: 'preferences.section', id, open }]),
  resetGraph: () => applyOperations([{ kind: 'document.reset', id: newIri() }]),
  createView: (name, conceptIds) => {
    const id = newIri()
    applyOperations([{ kind: 'view.create', id, name, conceptIds }])
    return id
  },
  renameView: (id, name) => applyOperations([{ kind: 'view.rename', id, name }]),
  setViewPinned: (id, pinned) => applyOperations([{ kind: 'view.pin', id, pinned }]),
  setViewMembership: (viewId, conceptId, included) => applyOperations([{ kind: 'view.membership', viewId, conceptId, included }]),
  deleteView: (id) => applyOperations([{ kind: 'view.remove', id }]),
})

export const createPluginStore = (store: NessoStore, operations: readonly NessoOperation['kind'][]): NessoStore => {
  if (!Array.isArray(operations)) fail('plugin.operations', 'Expected an explicit list of allowed operations')
  const allowed = new Set(operations)
  return {
    getState: store.getState,
    subscribe: store.subscribe,
    getViewGraph: store.getViewGraph,
    ...createCommands((operations) => {
      const denied = operations.find((operation) => !allowed.has(operation.kind))
      if (denied) fail('plugin.operations', `Operation not declared: ${denied.kind}`)
      store.applyOperations(operations)
    }),
  }
}
