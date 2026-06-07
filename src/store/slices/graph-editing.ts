// SPDX-License-Identifier: MIT
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react'
import type { StateCreator } from 'zustand'
import {
  defaultConceptReviewFields,
  type ConceptNodeData,
  type EdgeTypeName,
  type NessoEdgeData,
} from '@/types/graph'
import { CONCEPT_HANDLE_IN, CONCEPT_HANDLE_OUT } from '@/data/conceptHandles'
import {
  advanceClipboardAfterPaste,
  getGraphClipboard,
  instantiateClipboard,
  setGraphClipboard,
  snapshotSelection,
} from '@/lib/graphClipboard'
import { defaultCurveFlip, nodeCenterX, nodeCenterY } from '@nesso-how/graph'
import type { GraphSnapshot } from '../types'
import type { GraphState } from '../state'

export const MAX_UNDO = 50
export const _draggingNodeIds = new Set<string>()

export function pushHistory(
  s: GraphSnapshot & { _history: GraphSnapshot[]; _future: GraphSnapshot[] },
) {
  return {
    _history: [...s._history, { nodes: s.nodes, edges: s.edges }].slice(-MAX_UNDO),
    _future: [] as GraphSnapshot[],
  }
}

export function bakeCurveFlipFromPositions(edges: Edge[], nodes: Node<ConceptNodeData>[]): Edge[] {
  return edges.map((e) => {
    if (e.data?.curveFlipPinned) return e
    const sourceNode = nodes.find((n) => n.id === e.source)
    const targetNode = nodes.find((n) => n.id === e.target)
    if (!sourceNode || !targetNode) return e
    const curveFlip = defaultCurveFlip(
      nodeCenterX(sourceNode),
      nodeCenterY(sourceNode),
      nodeCenterX(targetNode),
      nodeCenterY(targetNode),
    )
    if (Boolean(e.data?.curveFlip) === curveFlip) return e
    return { ...e, data: { ...e.data, curveFlip: curveFlip || undefined } }
  })
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
  deleteNode: (id: string) => void
  addNode: (x?: number, y?: number) => string
  addEdge: (source: string, target: string, type: EdgeTypeName) => string
  updateEdgeType: (id: string, type: EdgeTypeName) => void
  setEdgeCurveFlipMode: (id: string, mode: 'auto' | 'off' | 'on') => void
  deleteEdge: (id: string) => void
  setSelected: (sel: import('../types').Selection) => void
  syncFlowSelection: (nodeIds: string[], edgeIds: string[]) => void
  setSelectedIds: (ids: string[]) => void
  deleteSelection: () => void
  copySelection: () => boolean
  pasteSelection: () => string[] | null
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
      _draggingNodeIds.clear()
      return {
        _history: s._history.slice(0, -1),
        _future: [{ nodes: s.nodes, edges: s.edges }, ...s._future].slice(0, MAX_UNDO),
        nodes: prev.nodes,
        edges: prev.edges,
        selected: null,
      }
    }),

  redo: () =>
    set((s) => {
      if (!s._future.length) return s
      const next = s._future[0]
      _draggingNodeIds.clear()
      return {
        _future: s._future.slice(1),
        _history: [...s._history, { nodes: s.nodes, edges: s.edges }].slice(-MAX_UNDO),
        nodes: next.nodes,
        edges: next.edges,
        selected: null,
      }
    }),

  onNodesChange: (changes) => {
    for (const c of changes) {
      if (c.type === 'position' && c.dragging === false) {
        _draggingNodeIds.delete(c.id)
      }
    }
    const startsDrag = changes.filter(
      (c): c is Extract<NodeChange<Node<ConceptNodeData>>, { type: 'position' }> =>
        c.type === 'position' && c.dragging === true && !_draggingNodeIds.has(c.id),
    )
    const hasRemove = changes.some((c) => c.type === 'remove')
    if (startsDrag.length > 0) {
      for (const c of startsDrag) {
        _draggingNodeIds.add(c.id)
      }
      set((s) => ({
        ...pushHistory(s),
        nodes: applyNodeChanges(changes, s.nodes) as Node<ConceptNodeData>[],
      }))
    } else if (hasRemove) {
      set((s) => ({
        ...pushHistory(s),
        nodes: applyNodeChanges(changes, s.nodes) as Node<ConceptNodeData>[],
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

  deleteNode: (id) =>
    set((s) => ({
      ...pushHistory(s),
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selected: s.selected?.id === id ? null : s.selected,
    })),

  addNode: (x = 0, y = 0) => {
    const id = 'n' + Math.random().toString(36).slice(2, 7)
    set((s) => ({
      ...pushHistory(s),
      nodes: [
        ...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
        {
          id,
          type: 'concept',
          position: { x, y },
          selected: true,
          data: {
            text: 'New concept',
            ...defaultConceptReviewFields(),
          },
        },
      ],
      edges: s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
      selected: { kind: 'node', id },
      selectedIds: [id],
      editNodeId: id,
    }))
    return id
  },

  requestEditNode: (id) => set({ editNodeId: id }),
  clearEditNodeId: () => set({ editNodeId: null }),

  addEdge: (source, target, type) => {
    const id = 'e' + Math.random().toString(36).slice(2, 8)
    set((s) => {
      const sourceNode = s.nodes.find((n) => n.id === source)
      const targetNode = s.nodes.find((n) => n.id === target)
      const autoCurveFlip = s.graphDisplay.autoCurveFlip
      const curveFlip =
        !autoCurveFlip && sourceNode && targetNode
          ? defaultCurveFlip(
              nodeCenterX(sourceNode),
              nodeCenterY(sourceNode),
              nodeCenterX(targetNode),
              nodeCenterY(targetNode),
            )
          : false

      return {
        ...pushHistory(s),
        nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
        edges: [
          ...s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
          {
            id,
            source,
            target,
            sourceHandle: CONCEPT_HANDLE_OUT,
            targetHandle: CONCEPT_HANDLE_IN,
            type: 'nesso',
            selected: true,
            data: { type, ...(curveFlip ? { curveFlip: true } : {}) },
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

  setEdgeCurveFlipMode: (id, mode) =>
    set((s) => ({
      ...pushHistory(s),
      edges: s.edges.map((e) => {
        if (e.id !== id) return e
        const edge = e as Edge<NessoEdgeData, 'nesso'>
        const d = edge.data!
        if (mode === 'auto') {
          const data: NessoEdgeData = { type: d.type, siblingIdx: d.siblingIdx }
          return { ...edge, data }
        }
        const auto = s.graphDisplay.autoCurveFlip
        const data: NessoEdgeData = {
          type: d.type,
          siblingIdx: d.siblingIdx,
          curveFlip: mode === 'on',
        }
        if (auto) data.curveFlipPinned = true
        else delete data.curveFlipPinned
        return { ...edge, data }
      }),
    })),

  deleteEdge: (id) =>
    set((s) => ({
      ...pushHistory(s),
      edges: s.edges.filter((e) => e.id !== id),
      selected: s.selected?.id === id ? null : s.selected,
    })),

  setSelected: (sel) =>
    set((s) => {
      if (s.selected?.kind === sel?.kind && s.selected?.id === sel?.id) return s

      if (sel?.kind === 'node') {
        let nodesChanged = false
        const nodes = s.nodes.map((n) => {
          const want = n.id === sel.id
          if (Boolean(n.selected) !== want) {
            nodesChanged = true
            return { ...n, selected: want }
          }
          return n
        })
        let edgesChanged = false
        const edges = s.edges.map((e) => {
          if (e.selected) {
            edgesChanged = true
            return { ...e, selected: false }
          }
          return e
        })
        return {
          selected: sel,
          selectedIds: [sel.id],
          nodes: nodesChanged ? nodes : s.nodes,
          edges: edgesChanged ? edges : s.edges,
        }
      }

      if (sel?.kind === 'edge') {
        let nodesChanged = false
        const nodes = s.nodes.map((n) => {
          if (n.selected) {
            nodesChanged = true
            return { ...n, selected: false }
          }
          return n
        })
        let edgesChanged = false
        const edges = s.edges.map((e) => {
          const want = e.id === sel.id
          if (Boolean(e.selected) !== want) {
            edgesChanged = true
            return { ...e, selected: want }
          }
          return e
        })
        return {
          selected: sel,
          selectedIds: [],
          nodes: nodesChanged ? nodes : s.nodes,
          edges: edgesChanged ? edges : s.edges,
        }
      }

      let nodesChanged = false
      const nodes = s.nodes.map((n) => {
        if (n.selected) {
          nodesChanged = true
          return { ...n, selected: false }
        }
        return n
      })
      let edgesChanged = false
      const edges = s.edges.map((e) => {
        if (e.selected) {
          edgesChanged = true
          return { ...e, selected: false }
        }
        return e
      })
      return {
        selected: null,
        selectedIds: [],
        nodes: nodesChanged ? nodes : s.nodes,
        edges: edgesChanged ? edges : s.edges,
      }
    }),

  syncFlowSelection: (nodeIds, edgeIds) =>
    set((s) => {
      const nodeIdSet = new Set(nodeIds)
      const edgeIdSet = new Set(edgeIds)

      let selected: import('../types').Selection = null
      if (nodeIds.length === 1 && edgeIds.length === 0) {
        selected = { kind: 'node', id: nodeIds[0] }
      } else if (edgeIds.length === 1 && nodeIds.length === 0) {
        selected = { kind: 'edge', id: edgeIds[0] }
      }

      const selectedIdsMatch =
        nodeIds.length === s.selectedIds.length && nodeIds.every((id) => s.selectedIds.includes(id))
      const selectedMatch =
        (selected?.kind === s.selected?.kind && selected?.id === s.selected?.id) ||
        (selected === null && s.selected === null)

      let nodesChanged = false
      const nodes = s.nodes.map((n) => {
        const want = nodeIdSet.has(n.id)
        if (Boolean(n.selected) !== want) {
          nodesChanged = true
          return { ...n, selected: want }
        }
        return n
      })
      let edgesChanged = false
      const edges = s.edges.map((e) => {
        const want = edgeIdSet.has(e.id)
        if (Boolean(e.selected) !== want) {
          edgesChanged = true
          return { ...e, selected: want }
        }
        return e
      })

      if (!nodesChanged && !edgesChanged && selectedIdsMatch && selectedMatch) return s

      return {
        selected,
        selectedIds: nodeIds,
        nodes: nodesChanged ? nodes : s.nodes,
        edges: edgesChanged ? edges : s.edges,
      }
    }),

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  deleteSelection: () =>
    set((s) => {
      const nodeIds = new Set(s.selectedIds)
      if (s.selected?.kind === 'node') nodeIds.add(s.selected.id)

      const edgeIds = new Set<string>()
      if (s.selected?.kind === 'edge') edgeIds.add(s.selected.id)
      for (const e of s.edges) {
        if (e.selected) edgeIds.add(e.id)
      }

      if (nodeIds.size > 0) {
        return {
          ...pushHistory(s),
          nodes: s.nodes.filter((n) => !nodeIds.has(n.id)),
          edges: s.edges.filter((e) => !nodeIds.has(e.source) && !nodeIds.has(e.target)),
          selected: null,
          selectedIds: [],
        }
      }

      if (edgeIds.size > 0) {
        return {
          ...pushHistory(s),
          edges: s.edges.filter((e) => !edgeIds.has(e.id)),
          selected: null,
          selectedIds: [],
        }
      }

      return s
    }),

  copySelection: () => {
    const snap = snapshotSelection(get())
    if (!snap) return false
    setGraphClipboard(snap)
    set({ pasteAvailable: true })
    return true
  },

  pasteSelection: () => {
    const clip = getGraphClipboard()
    if (!clip?.nodes.length && !clip?.edges.length) return null
    const { nodes: pastedNodes, edges: pastedEdges } = instantiateClipboard(clip)
    const pastedNodeIds = pastedNodes.map((n) => n.id)

    set((s) => ({
      ...pushHistory(s),
      nodes: [...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), ...pastedNodes],
      edges: [...s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)), ...pastedEdges],
      selected:
        pastedNodeIds.length === 1
          ? { kind: 'node', id: pastedNodeIds[0] }
          : pastedEdges.length === 1 && pastedNodeIds.length === 0
            ? { kind: 'edge', id: pastedEdges[0].id }
            : null,
      selectedIds: pastedNodeIds,
    }))
    advanceClipboardAfterPaste()
    return pastedNodeIds
  },
})
