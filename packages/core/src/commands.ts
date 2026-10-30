import type { NessoStore } from './types.ts'
import { newIri } from '../../schema/src/core.ts'

type WriteMethods = Omit<
  NessoStore,
  | 'getState'
  | 'subscribe'
  | 'getViewGraph'
  | 'conceptPlacementOffset'
  | 'applyOperations'
  | 'setViewport'
  | 'setActiveRenderer'
  | 'resetGraph'
>

export function createWriteCommands<Commit, Created>(
  applyOperations: (...args: Parameters<NessoStore['applyOperations']>) => Commit,
  created: (id: string, commit: Commit) => Created,
): {
  readonly [K in keyof WriteMethods]: (
    ...args: Parameters<WriteMethods[K]>
  ) => K extends 'addConcept' | 'createView' ? Created : Commit
} {
  return {
    undo: () => applyOperations([{ kind: 'history.undo' }]),
    redo: () => applyOperations([{ kind: 'history.redo' }]),
    setSelection: (value) => applyOperations([{ kind: 'selection.set', value }]),
    setView: (id) => applyOperations([{ kind: 'view.activate', id }]),
    setConceptPosition: (id, value, historyGroup) =>
      applyOperations(
        [{ kind: 'concept.position', id, value }],
        historyGroup ? { historyGroup } : undefined,
      ),
    setConceptPositions: (updates, historyGroup) =>
      applyOperations(
        [{ kind: 'concept.positions', updates }],
        historyGroup ? { historyGroup } : undefined,
      ),
    setConceptLabel: (id, value, historyGroup) =>
      applyOperations(
        [{ kind: 'concept.label', id, value }],
        historyGroup ? { historyGroup } : undefined,
      ),
    setConceptDescription: (id, value, historyGroup) =>
      applyOperations(
        [{ kind: 'concept.description', id, value }],
        historyGroup ? { historyGroup } : undefined,
      ),
    setConceptColor: (id, value, historyGroup) =>
      applyOperations(
        [{ kind: 'concept.color', id, value }],
        historyGroup ? { historyGroup } : undefined,
      ),
    setConceptBold: (id, value, historyGroup) =>
      applyOperations(
        [{ kind: 'concept.bold', id, value }],
        historyGroup ? { historyGroup } : undefined,
      ),
    setConceptItalic: (id, value, historyGroup) =>
      applyOperations(
        [{ kind: 'concept.italic', id, value }],
        historyGroup ? { historyGroup } : undefined,
      ),
    addConcept: (position, historyGroup) => {
      const id = newIri()
      return created(
        id,
        applyOperations(
          [{ kind: 'concept.add', id, position }],
          historyGroup ? { historyGroup } : undefined,
        ),
      )
    },
    connect: (source, target) => applyOperations([{ kind: 'relation.connect', source, target }]),
    reconnectRelation: (id, source, target) =>
      applyOperations([{ kind: 'relation.reconnect', id, source, target }]),
    setRelationType: (id, typeId) => applyOperations([{ kind: 'relation.type', id, typeId }]),
    createRelationType: (id, label) =>
      applyOperations([{ kind: 'relation.type.create', id, typeId: newIri(), label }]),
    removeConcept: (id) => applyOperations([{ kind: 'concept.remove', id }]),
    removeRelation: (id) => applyOperations([{ kind: 'relation.remove', id }]),
    setActiveVocab: (id) => applyOperations([{ kind: 'preferences.vocab', id }]),
    setActiveTheme: (id) => applyOperations([{ kind: 'preferences.theme', id }]),
    setLocale: (value) => applyOperations([{ kind: 'preferences.locale', value }]),
    setPanelSizes: (value) => applyOperations([{ kind: 'preferences.panels', value }]),
    setSectionOpen: (id, open) => applyOperations([{ kind: 'preferences.section', id, open }]),
    createView: (name, conceptIds) => {
      const id = newIri()
      return created(id, applyOperations([{ kind: 'view.create', id, name, conceptIds }]))
    },
    renameView: (id, name) => applyOperations([{ kind: 'view.rename', id, name }]),
    setViewPinned: (id, pinned) => applyOperations([{ kind: 'view.pin', id, pinned }]),
    setViewMembership: (viewId, conceptId, included) =>
      applyOperations([{ kind: 'view.membership', viewId, conceptId, included }]),
    deleteView: (id) => applyOperations([{ kind: 'view.remove', id }]),
  }
}
