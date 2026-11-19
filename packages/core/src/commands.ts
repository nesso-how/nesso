import type { NessoStore } from './types.ts'
import { newIri } from '@nesso-how/schema'

type WriteMethods = Omit<
  NessoStore,
  | 'getState'
  | 'subscribe'
  | 'getMapGraph'
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
  ) => K extends 'addConcept' | 'createMap' ? Created : Commit
} {
  return {
    undo: () => applyOperations([{ kind: 'history.undo' }]),
    redo: () => applyOperations([{ kind: 'history.redo' }]),
    setSelection: (value) => applyOperations([{ kind: 'selection.set', value }]),
    setMap: (id) => applyOperations([{ kind: 'map.activate', id }]),
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
    setConceptNotes: (id, value, historyGroup) =>
      applyOperations(
        [{ kind: 'concept.notes', id, value }],
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
    setConceptStrikethrough: (id, value, historyGroup) =>
      applyOperations(
        [{ kind: 'concept.strikethrough', id, value }],
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
    setRelationBend: (id, value, historyGroup) =>
      applyOperations(
        [{ kind: 'relation.bend', id, value }],
        historyGroup ? { historyGroup } : undefined,
      ),
    setActiveVocab: (id) => applyOperations([{ kind: 'preferences.vocab', id }]),
    setActiveTheme: (id) => applyOperations([{ kind: 'preferences.theme', id }]),
    setLocale: (value) => applyOperations([{ kind: 'preferences.locale', value }]),
    setPanelSizes: (value) => applyOperations([{ kind: 'preferences.panels', value }]),
    setSectionOpen: (id, open) => applyOperations([{ kind: 'preferences.section', id, open }]),
    createMap: (name, conceptIds) => {
      const id = newIri()
      return created(id, applyOperations([{ kind: 'map.create', id, name, conceptIds }]))
    },
    renameMap: (id, name) => applyOperations([{ kind: 'map.rename', id, name }]),
    setMapPinned: (id, pinned) => applyOperations([{ kind: 'map.pin', id, pinned }]),
    setMapMembership: (mapId, conceptId, included) =>
      applyOperations([{ kind: 'map.membership', mapId, conceptId, included }]),
    deleteMap: (id) => applyOperations([{ kind: 'map.remove', id }]),
  }
}
