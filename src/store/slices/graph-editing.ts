// SPDX-License-Identifier: MIT
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react'
import type { StateCreator } from 'zustand'
import {
  defaultConceptReviewFields,
  type ConceptNodeData,
  type NotesDocument,
  type RelationTypeName,
} from '@/types/graph'
import { CONCEPT_HANDLE_IN, CONCEPT_HANDLE_OUT } from '@/data/conceptHandles'
import {
  advanceClipboardAfterPaste,
  getGraphClipboard,
  instantiateClipboard,
  setGraphClipboard,
  snapshotSelection,
  type GraphClipboard,
} from '@/lib/graphClipboard'
import { locales } from '@/i18n/registry'
import { newElementId } from '@nesso-how/vocab-learning'
import { track } from '@/telemetry'
import type { GraphSnapshot } from '../types'
import type { GraphState } from '../state'

import {
  addDraggingNodeId,
  clearDraggingNodeIds,
  deleteDraggingNodeId,
  hasDraggingNodeId,
} from './graphSession'

export const MAX_UNDO = 50

export function pushHistory(
  s: GraphSnapshot & { _history: GraphSnapshot[]; _future: GraphSnapshot[] },
) {
  return {
    _history: [...s._history, { nodes: s.nodes, edges: s.edges }].slice(-MAX_UNDO),
    _future: [] as GraphSnapshot[],
  }
}

/**
 * Writing Mode overlay target after a history restore: snapshots carry only
 * nodes/edges, so `undo`/`redo` are otherwise transparent to the overlay. Keep
 * it only when the restored nodes still contain its target — a missing field
 * (stores composed without the UI slice) counts as absent.
 */
function writingModeAfterRestore(
  writingModeNodeId: string | null | undefined,
  nodes: Node<ConceptNodeData>[],
): string | null {
  if (!writingModeNodeId) return null
  return nodes.some((n) => n.id === writingModeNodeId) ? writingModeNodeId : null
}

/** Writing Mode target after a selection delete: the overlay closes only when
 *  the concept being written is among the deleted nodes. */
function writingModeAfterNodeDeletion(
  writingModeNodeId: string | null,
  deletedNodeIds: ReadonlySet<string>,
): string | null {
  return writingModeNodeId !== null && deletedNodeIds.has(writingModeNodeId)
    ? null
    : writingModeNodeId
}

/** The single-anchor selection implied by a React Flow selection, or null. */
function flowAnchorSelection(
  nodeIds: readonly string[],
  edgeIds: readonly string[],
): import('../types').Selection {
  if (nodeIds.length === 1 && edgeIds.length === 0) return { kind: 'node', id: nodeIds[0] }
  if (edgeIds.length === 1 && nodeIds.length === 0) return { kind: 'edge', id: edgeIds[0] }
  return null
}

/** True when two selections anchor the same node/edge (both null counts). */
function sameAnchorSelection(
  a: import('../types').Selection,
  b: import('../types').Selection,
): boolean {
  return (a?.kind === b?.kind && a?.id === b?.id) || (a === null && b === null)
}

/** True when the flow's selected ids match the store's exactly. */
function sameMembers(ids: readonly string[], current: readonly string[]): boolean {
  return ids.length === current.length && ids.every((id) => current.includes(id))
}

/** Ids a delete should remove: the multi-selection ids, the single-anchor
 *  selection, and any edge whose React Flow `selected` flag is set. */
function collectDeleteIds(s: {
  selectedIds: string[]
  selected: import('../types').Selection
  edges: Edge[]
}): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set(s.selectedIds)
  if (s.selected?.kind === 'node') nodeIds.add(s.selected.id)
  const edgeIds = new Set<string>()
  if (s.selected?.kind === 'edge') edgeIds.add(s.selected.id)
  for (const e of s.edges) {
    if (e.selected) edgeIds.add(e.id)
  }
  return { nodeIds, edgeIds }
}

/**
 * Recompute `selected` flags so exactly the given ids are marked, preserving
 * array/object identity when nothing changes (avoids needless re-renders).
 */
function applySelectionFlags(
  nodes: Node<ConceptNodeData>[],
  edges: Edge[],
  nodeIds: ReadonlySet<string>,
  edgeIds: ReadonlySet<string>,
): { nodes: Node<ConceptNodeData>[]; edges: Edge[]; changed: boolean } {
  let nodesChanged = false
  const nextNodes = nodes.map((n) => {
    const want = nodeIds.has(n.id)
    if (Boolean(n.selected) !== want) {
      nodesChanged = true
      return { ...n, selected: want }
    }
    return n
  })
  let edgesChanged = false
  const nextEdges = edges.map((e) => {
    const want = edgeIds.has(e.id)
    if (Boolean(e.selected) !== want) {
      edgesChanged = true
      return { ...e, selected: want }
    }
    return e
  })
  return {
    nodes: nodesChanged ? nextNodes : nodes,
    edges: edgesChanged ? nextEdges : edges,
    changed: nodesChanged || edgesChanged,
  }
}

/**
 * Deselect every node/edge, preserving element identity for untouched entries
 * (same mapping shape as the inline deselect maps it replaces).
 */
function clearFlowSelection(
  nodes: Node<ConceptNodeData>[],
  edges: Edge[],
): { nodes: Node<ConceptNodeData>[]; edges: Edge[] } {
  const cleared = applySelectionFlags(nodes, edges, new Set<string>(), new Set<string>())
  return { nodes: cleared.nodes, edges: cleared.edges }
}

/**
 * Deep-clone a node/edge snapshot with fresh ids (via `newElementId`, nodes
 * first then edges) and offset positions — shared by paste (with an optional
 * cursor anchor) and duplicate (cascading offset). Selection of the inserted
 * elements stays at the call sites: paste also anchors a lone edge, duplicate
 * only anchors a lone node.
 */
function insertCloned(
  snapshot: GraphClipboard,
  nodes: Node<ConceptNodeData>[],
  edges: Edge[],
  at?: { x: number; y: number },
): { nodes: Node<ConceptNodeData>[]; edges: Edge[] } {
  return instantiateClipboard(
    snapshot,
    new Set(nodes.map((n) => n.id)),
    new Set(edges.map((e) => e.id)),
    at,
  )
}

export interface GraphEditingSlice {
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
  selected: import('../types').Selection
  selectedIds: string[]
  pasteAvailable: boolean
  editNodeId: string | null
  _history: GraphSnapshot[]
  _future: GraphSnapshot[]
  undo: () => void
  redo: () => void
  onNodesChange: (changes: NodeChange<Node<ConceptNodeData>>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  updateNodeData: (id: string, patch: Partial<ConceptNodeData>) => void
  updateNodeNotes: (id: string, notes: NotesDocument | undefined) => void
  deleteNode: (id: string) => void
  addNode: (x?: number, y?: number) => string
  addEdge: (source: string, target: string, type: RelationTypeName) => string
  updateEdgeType: (id: string, type: RelationTypeName) => void
  deleteEdge: (id: string) => void
  setSelected: (sel: import('../types').Selection) => void
  syncFlowSelection: (nodeIds: string[], edgeIds: string[]) => void
  setSelectedIds: (ids: string[]) => void
  selectAll: () => void
  deleteSelection: () => void
  copySelection: () => boolean
  cutSelection: () => boolean
  pasteSelection: (at?: { x: number; y: number }) => string[] | null
  duplicateSelection: () => string[] | null
  reverseEdge: (id: string) => void
  requestEditNode: (id: string) => void
  clearEditNodeId: () => void
}

export const createGraphEditingSlice: StateCreator<GraphState, [], [], GraphEditingSlice> = (
  set,
  get,
) => ({
  nodes: [],
  edges: [],
  selected: null,
  selectedIds: [],
  pasteAvailable: false,
  editNodeId: null,
  _history: [],
  _future: [],

  undo: () =>
    set((s) => {
      if (!s._history.length) return s
      const prev = s._history[s._history.length - 1]
      clearDraggingNodeIds()
      return {
        _history: s._history.slice(0, -1),
        _future: [{ nodes: s.nodes, edges: s.edges }, ...s._future].slice(0, MAX_UNDO),
        nodes: prev.nodes,
        edges: prev.edges,
        selected: null,
        selectedIds: [],
        writingModeNodeId: writingModeAfterRestore(s.writingModeNodeId, prev.nodes),
      }
    }),

  redo: () =>
    set((s) => {
      if (!s._future.length) return s
      const next = s._future[0]
      clearDraggingNodeIds()
      return {
        _future: s._future.slice(1),
        _history: [...s._history, { nodes: s.nodes, edges: s.edges }].slice(-MAX_UNDO),
        nodes: next.nodes,
        edges: next.edges,
        selected: null,
        selectedIds: [],
        writingModeNodeId: writingModeAfterRestore(s.writingModeNodeId, next.nodes),
      }
    }),

  onNodesChange: (changes) => {
    for (const c of changes) {
      if (c.type === 'position' && c.dragging === false) {
        deleteDraggingNodeId(c.id)
      }
    }
    const startsDrag = changes.filter(
      (c): c is Extract<NodeChange<Node<ConceptNodeData>>, { type: 'position' }> =>
        c.type === 'position' && c.dragging === true && !hasDraggingNodeId(c.id),
    )
    const hasRemove = changes.some((c) => c.type === 'remove')
    if (startsDrag.length > 0) {
      for (const c of startsDrag) {
        addDraggingNodeId(c.id)
      }
      set((s) => ({
        ...pushHistory(s),
        nodes: applyNodeChanges(changes, s.nodes) as Node<ConceptNodeData>[],
      }))
    } else if (hasRemove) {
      const state = get()
      const removeIds = new Set(
        changes
          .filter((c): c is { type: 'remove'; id: string } => c.type === 'remove')
          .map((c) => c.id),
      )
      for (const id of removeIds) {
        if (state.nodes.some((n) => n.id === id)) track({ name: 'node_deleted' })
      }
      set((s) => ({
        ...pushHistory(s),
        nodes: applyNodeChanges(changes, s.nodes) as Node<ConceptNodeData>[],
        writingModeNodeId: removeIds.has(s.writingModeNodeId ?? '') ? null : s.writingModeNodeId,
      }))
    } else {
      set((s) => ({
        nodes: applyNodeChanges(changes, s.nodes) as Node<ConceptNodeData>[],
      }))
    }
  },

  onEdgesChange: (changes) => {
    const hasRemove = changes.some((c) => c.type === 'remove')
    if (hasRemove) {
      const removedIds = new Set(
        changes
          .filter((c): c is { type: 'remove'; id: string } => c.type === 'remove')
          .map((c) => c.id),
      )
      const state = get()
      for (const id of removedIds) {
        if (state.edges.some((e) => e.id === id)) track({ name: 'edge_deleted' })
      }
      set((s) => ({
        ...pushHistory(s),
        edges: applyEdgeChanges(changes, s.edges),
        selected: s.selected?.kind === 'edge' && removedIds.has(s.selected.id) ? null : s.selected,
      }))
    } else {
      set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }))
    }
  },

  updateNodeData: (id, patch) =>
    set((s) => ({
      ...pushHistory(s),
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    })),

  updateNodeNotes: (id, notes) =>
    set((s) => {
      const node = s.nodes.find((n) => n.id === id)
      if (!node) return s

      const elaboration = node.data.elaboration
      let nextElaboration = elaboration
      if (notes === undefined) {
        if (!elaboration || !Object.keys(elaboration).includes('notes')) return s
        const { notes: _notes, ...withoutNotes } = elaboration
        nextElaboration = withoutNotes
      } else {
        nextElaboration = {
          ...(elaboration ?? { definition: '' }),
          notes,
        }
      }

      return {
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, elaboration: nextElaboration } } : n,
        ),
      }
    }),

  deleteNode: (id) => {
    if (get().nodes.some((n) => n.id === id)) track({ name: 'node_deleted' })
    set((s) => ({
      ...pushHistory(s),
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selected: s.selected?.id === id ? null : s.selected,
      writingModeNodeId: s.writingModeNodeId === id ? null : s.writingModeNodeId,
    }))
  },

  addNode: (x = 0, y = 0) => {
    const id = newElementId('n', new Set(get().nodes.map((n) => n.id)))
    set((s) => {
      const cleared = clearFlowSelection(s.nodes, s.edges)
      return {
        ...pushHistory(s),
        nodes: [
          ...cleared.nodes,
          {
            id,
            type: 'concept',
            position: { x, y },
            selected: true,
            data: {
              text: locales[get().settings.language].canvas.newConcept,
              ...defaultConceptReviewFields(),
            },
          },
        ],
        edges: cleared.edges,
        selected: { kind: 'node', id },
        selectedIds: [id],
        editNodeId: id,
      }
    })
    return id
  },

  requestEditNode: (id) => set({ editNodeId: id }),
  clearEditNodeId: () => set({ editNodeId: null }),

  addEdge: (source, target, type) => {
    const id = newElementId('e', new Set(get().edges.map((e) => e.id)))
    set((s) => {
      const cleared = clearFlowSelection(s.nodes, s.edges)

      return {
        ...pushHistory(s),
        nodes: cleared.nodes,
        edges: [
          ...cleared.edges,
          {
            id,
            source,
            target,
            sourceHandle: CONCEPT_HANDLE_OUT,
            targetHandle: CONCEPT_HANDLE_IN,
            type: 'nesso',
            selected: true,
            data: { type },
          },
        ],
        selected: { kind: 'edge', id },
        selectedIds: [],
      }
    })
    return id
  },

  updateEdgeType: (id, type) =>
    set((s) => ({
      ...pushHistory(s),
      edges: s.edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, type } } : e)),
    })),

  deleteEdge: (id) => {
    if (get().edges.some((e) => e.id === id)) track({ name: 'edge_deleted' })
    set((s) => ({
      ...pushHistory(s),
      edges: s.edges.filter((e) => e.id !== id),
      selected: s.selected?.id === id ? null : s.selected,
    }))
  },

  setSelected: (sel) =>
    set((s) => {
      if (s.selected?.kind === sel?.kind && s.selected?.id === sel?.id) return s

      const nodeIds = new Set(sel?.kind === 'node' ? [sel.id] : [])
      const edgeIds = new Set(sel?.kind === 'edge' ? [sel.id] : [])
      const { nodes, edges } = applySelectionFlags(s.nodes, s.edges, nodeIds, edgeIds)
      return {
        selected: sel,
        selectedIds: sel?.kind === 'node' ? [sel.id] : [],
        nodes,
        edges,
      }
    }),

  syncFlowSelection: (nodeIds, edgeIds) =>
    set((s) => {
      const selected = flowAnchorSelection(nodeIds, edgeIds)

      const { nodes, edges, changed } = applySelectionFlags(
        s.nodes,
        s.edges,
        new Set(nodeIds),
        new Set(edgeIds),
      )

      if (
        !changed &&
        sameMembers(nodeIds, s.selectedIds) &&
        sameAnchorSelection(selected, s.selected)
      )
        return s

      return { selected, selectedIds: nodeIds, nodes, edges }
    }),

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  selectAll: () =>
    set((s) => {
      if (s.nodes.length === 0 && s.edges.length === 0) return s
      const { nodes, edges, changed } = applySelectionFlags(
        s.nodes,
        s.edges,
        new Set(s.nodes.map((n) => n.id)),
        new Set(s.edges.map((e) => e.id)),
      )
      if (!changed && s.selected === null && s.selectedIds.length === s.nodes.length) return s
      return { nodes, edges, selected: null, selectedIds: s.nodes.map((n) => n.id) }
    }),

  deleteSelection: () => {
    let removedNode = false
    let removedEdge = false
    set((s) => {
      const { nodeIds, edgeIds } = collectDeleteIds(s)

      if (nodeIds.size === 0 && edgeIds.size === 0) return s

      removedNode = nodeIds.size > 0
      removedEdge = edgeIds.size > 0

      // Single pass: drop selected nodes, edges incident to them, AND any
      // explicitly selected edges — a mixed selection removes both.
      return {
        ...pushHistory(s),
        nodes: nodeIds.size > 0 ? s.nodes.filter((n) => !nodeIds.has(n.id)) : s.nodes,
        edges: s.edges.filter(
          (e) => !edgeIds.has(e.id) && !nodeIds.has(e.source) && !nodeIds.has(e.target),
        ),
        selected: null,
        selectedIds: [],
        writingModeNodeId: writingModeAfterNodeDeletion(s.writingModeNodeId, nodeIds),
      }
    })
    if (removedNode) {
      track({ name: 'node_deleted' })
      get().noteOnboardingNodeDeleted?.()
    }
    if (removedEdge) track({ name: 'edge_deleted' })
  },

  copySelection: () => {
    const snap = snapshotSelection(get())
    if (!snap) return false
    setGraphClipboard(snap)
    set({ pasteAvailable: true })
    return true
  },

  cutSelection: () => {
    const copied = get().copySelection()
    if (copied) get().deleteSelection()
    return copied
  },

  pasteSelection: (at) => {
    const clip = getGraphClipboard()
    if (!clip?.nodes.length && !clip?.edges.length) return null
    const s = get()
    const { nodes: pastedNodes, edges: pastedEdges } = insertCloned(clip, s.nodes, s.edges, at)
    const pastedNodeIds = pastedNodes.map((n) => n.id)

    set((s) => {
      const cleared = clearFlowSelection(s.nodes, s.edges)
      return {
        ...pushHistory(s),
        nodes: [...cleared.nodes, ...pastedNodes],
        edges: [...cleared.edges, ...pastedEdges],
        selected:
          pastedNodeIds.length === 1
            ? { kind: 'node', id: pastedNodeIds[0] }
            : pastedEdges.length === 1 && pastedNodeIds.length === 0
              ? { kind: 'edge', id: pastedEdges[0].id }
              : null,
        selectedIds: pastedNodeIds,
      }
    })
    advanceClipboardAfterPaste()
    return pastedNodeIds
  },

  duplicateSelection: () => {
    const snap = snapshotSelection(get())
    if (!snap) return null
    const s = get()
    const { nodes: dupNodes, edges: dupEdges } = insertCloned(snap, s.nodes, s.edges)
    const dupNodeIds = dupNodes.map((n) => n.id)
    set((cur) => {
      const cleared = clearFlowSelection(cur.nodes, cur.edges)
      return {
        ...pushHistory(cur),
        nodes: [...cleared.nodes, ...dupNodes],
        edges: [...cleared.edges, ...dupEdges],
        selected: dupNodeIds.length === 1 ? { kind: 'node', id: dupNodeIds[0] } : null,
        selectedIds: dupNodeIds,
      }
    })
    return dupNodeIds
  },

  reverseEdge: (id) =>
    set((s) => ({
      ...pushHistory(s),
      edges: s.edges.map((e) =>
        e.id === id
          ? {
              ...e,
              source: e.target,
              target: e.source,
              sourceHandle: CONCEPT_HANDLE_OUT,
              targetHandle: CONCEPT_HANDLE_IN,
            }
          : e,
      ),
    })),
})
