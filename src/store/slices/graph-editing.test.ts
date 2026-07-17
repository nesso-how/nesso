// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import type { Edge, EdgeChange, Node, NodeChange } from '@xyflow/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { setGraphClipboard } from '@/lib/graphClipboard'
import type { ConceptNodeData } from '@/types/graph'
import type { GraphState } from '../state'
import {
  _draggingNodeIds,
  bakeCurveFlipFromPositions,
  createGraphEditingSlice,
  MAX_UNDO,
} from './graph-editing'
import { createSettingsSlice } from './settings'
import { track } from '@/telemetry'

vi.mock('@/telemetry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/telemetry')>()
  return {
    ...actual,
    track: vi.fn(),
  }
})

// A headless store composed from the editing + settings slices — enough to
// exercise every graph mutation without the persist middleware, IndexedDB, or
// React Flow rendering.
function makeStore() {
  return createStore<GraphState>()(
    (...a) =>
      ({
        ...createGraphEditingSlice(...a),
        ...createSettingsSlice(...a),
      }) as GraphState,
  )
}

type Store = ReturnType<typeof makeStore>

beforeEach(() => {
  setGraphClipboard(null)
  _draggingNodeIds.clear()
  vi.clearAllMocks()
})

describe('addNode', () => {
  it('inserts a selected, editing concept and returns its id', () => {
    const s: Store = makeStore()
    const id = s.getState().addNode(10, 20)
    const state = s.getState()
    expect(state.nodes).toHaveLength(1)
    expect(state.nodes[0]).toMatchObject({ id, position: { x: 10, y: 20 }, selected: true })
    expect(state.nodes[0].data.text).toBe('New concept')
    expect(state.selected).toEqual({ kind: 'node', id })
    expect(state.selectedIds).toEqual([id])
    expect(state.editNodeId).toBe(id)
  })

  it('deselects a previously selected node', () => {
    const s = makeStore()
    const first = s.getState().addNode()
    s.getState().addNode()
    expect(s.getState().nodes.find((n) => n.id === first)?.selected).toBe(false)
  })
})

describe('addEdge', () => {
  it('creates a selected nesso edge between two nodes', () => {
    const s = makeStore()
    const a = s.getState().addNode()
    const b = s.getState().addNode()
    const id = s.getState().addEdge(a, b, 'causes')
    const edge = s.getState().edges.find((e) => e.id === id)
    expect(edge).toMatchObject({
      source: a,
      target: b,
      type: 'nesso',
      sourceHandle: 'out',
      targetHandle: 'in',
      selected: true,
    })
    expect(edge?.data).toMatchObject({ type: 'causes' })
    expect(s.getState().selected).toEqual({ kind: 'edge', id })
  })
})

describe('deleteNode', () => {
  it('removes the node, all incident edges, and clears its selection', () => {
    const s = makeStore()
    const a = s.getState().addNode()
    const b = s.getState().addNode()
    s.getState().addEdge(a, b, 'causes')
    s.getState().setSelected({ kind: 'node', id: a })
    s.getState().deleteNode(a)
    const state = s.getState()
    expect(state.nodes.map((n) => n.id)).toEqual([b])
    expect(state.edges).toHaveLength(0)
    expect(state.selected).toBeNull()
  })
})

describe('deleteEdge', () => {
  it('removes the edge and clears its selection', () => {
    const s = makeStore()
    const a = s.getState().addNode()
    const b = s.getState().addNode()
    const id = s.getState().addEdge(a, b, 'causes')
    s.getState().deleteEdge(id)
    expect(s.getState().edges).toHaveLength(0)
    expect(s.getState().selected).toBeNull()
  })
})

describe('updateNodeData', () => {
  it('merges the patch into the node data', () => {
    const s = makeStore()
    const id = s.getState().addNode()
    s.getState().updateNodeData(id, { text: 'Renamed', stability: 5 })
    const data = s.getState().nodes[0].data
    expect(data.text).toBe('Renamed')
    expect(data.stability).toBe(5)
  })
})

describe('deleteSelection', () => {
  it('drops the selected node together with edges touching it', () => {
    const s = makeStore()
    const a = s.getState().addNode()
    const b = s.getState().addNode()
    s.getState().addEdge(a, b, 'causes')
    s.getState().setSelected({ kind: 'node', id: a })
    s.getState().deleteSelection()
    expect(s.getState().nodes.map((n) => n.id)).toEqual([b])
    expect(s.getState().edges).toHaveLength(0)
    expect(s.getState().selected).toBeNull()
  })
})

describe('selectAll', () => {
  it('marks every node and edge selected and fills selectedIds', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const id = s.getState().addEdge(a, b, 'causes')
    s.getState().selectAll()
    const state = s.getState()
    expect(state.nodes.every((n) => n.selected)).toBe(true)
    expect(state.edges.find((e) => e.id === id)?.selected).toBe(true)
    expect(new Set(state.selectedIds)).toEqual(new Set([a, b]))
    expect(state.selected).toBeNull()
  })

  it('is a no-op on an empty graph', () => {
    const s = makeStore()
    const before = s.getState()
    s.getState().selectAll()
    expect(s.getState()).toBe(before)
  })

  it('selects everything so a follow-up copy captures the whole graph', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    s.getState().addEdge(a, b, 'causes')
    s.getState().setSelected(null)
    s.getState().selectAll()
    expect(s.getState().copySelection()).toBe(true)
    s.getState().pasteSelection()
    expect(s.getState().nodes).toHaveLength(4)
    expect(s.getState().edges).toHaveLength(2)
  })
})

describe('cutSelection', () => {
  it('copies the selection to the clipboard and removes it from the graph', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    s.getState().addEdge(a, b, 'causes')
    s.getState().setSelected({ kind: 'node', id: a })

    expect(s.getState().cutSelection()).toBe(true)
    expect(s.getState().pasteAvailable).toBe(true)
    expect(s.getState().nodes.map((n) => n.id)).toEqual([b])
    expect(s.getState().edges).toHaveLength(0)
    expect(s.getState().selected).toBeNull()

    const pasted = s.getState().pasteSelection()
    expect(pasted).toHaveLength(1)
    expect(s.getState().nodes).toHaveLength(2)
  })

  it('does nothing when there is no selection', () => {
    const s = makeStore()
    s.getState().addNode()
    s.getState().setSelected(null)
    expect(s.getState().cutSelection()).toBe(false)
    expect(s.getState().nodes).toHaveLength(1)
    expect(s.getState().pasteAvailable).toBe(false)
  })
})

describe('undo / redo', () => {
  it('reverts and reapplies the last mutation', () => {
    const s = makeStore()
    s.getState().addNode()
    expect(s.getState().nodes).toHaveLength(1)
    s.getState().undo()
    expect(s.getState().nodes).toHaveLength(0)
    s.getState().redo()
    expect(s.getState().nodes).toHaveLength(1)
  })
})

describe('copySelection / pasteSelection', () => {
  it('duplicates the selected subgraph with fresh ids and an offset', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    s.getState().addEdge(a, b, 'causes')
    s.getState().setSelected(null)
    s.getState().setSelectedIds([a, b])

    expect(s.getState().copySelection()).toBe(true)
    expect(s.getState().pasteAvailable).toBe(true)

    const pasted = s.getState().pasteSelection()
    expect(pasted).toHaveLength(2)
    expect(s.getState().nodes).toHaveLength(4)
    expect(s.getState().edges).toHaveLength(2)

    const original = new Set([a, b])
    for (const id of pasted ?? []) expect(original.has(id)).toBe(false)
  })

  it('anchors the pasted cluster centre on the given position', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    s.getState().setSelected(null)
    s.getState().setSelectedIds([a, b])
    s.getState().copySelection()

    const pasted = s.getState().pasteSelection({ x: 500, y: 500 })
    const positions = (pasted ?? []).map(
      (id) => s.getState().nodes.find((n) => n.id === id)!.position,
    )
    const xs = positions.map((p) => p.x)
    const ys = positions.map((p) => p.y)
    // Source cluster centre is (50, 0); pasting at (500, 500) recentres it there.
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBe(500)
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBe(500)
  })
})

describe('duplicateSelection', () => {
  it('clones the selected subgraph with fresh, offset ids without touching the clipboard', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    s.getState().addEdge(a, b, 'causes')
    s.getState().setSelected(null)
    s.getState().setSelectedIds([a, b])

    const dup = s.getState().duplicateSelection()
    expect(dup).toHaveLength(2)
    expect(s.getState().nodes).toHaveLength(4)
    expect(s.getState().edges).toHaveLength(2)
    // Duplicate must not populate the copy/paste clipboard.
    expect(s.getState().pasteAvailable).toBe(false)

    const original = new Set([a, b])
    for (const id of dup ?? []) expect(original.has(id)).toBe(false)
    const dupA = s.getState().nodes.find((n) => n.id === dup![0])!
    expect(dupA.position).not.toEqual({ x: 0, y: 0 })
  })

  it('selects the single duplicate and is undoable', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    s.getState().setSelected({ kind: 'node', id: a })
    const dup = s.getState().duplicateSelection()
    expect(dup).toHaveLength(1)
    expect(s.getState().selected).toEqual({ kind: 'node', id: dup![0] })
    s.getState().undo()
    expect(s.getState().nodes).toHaveLength(1)
  })

  it('returns null with nothing selected', () => {
    const s = makeStore()
    s.getState().addNode()
    s.getState().setSelected(null)
    s.getState().setSelectedIds([])
    expect(s.getState().duplicateSelection()).toBeNull()
  })
})

describe('reverseEdge', () => {
  it('swaps source and target while keeping handles and type', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const id = s.getState().addEdge(a, b, 'causes')
    s.getState().reverseEdge(id)
    const edge = s.getState().edges.find((e) => e.id === id)!
    expect(edge.source).toBe(b)
    expect(edge.target).toBe(a)
    expect(edge.sourceHandle).toBe('out')
    expect(edge.targetHandle).toBe('in')
    expect(edge.data?.type).toBe('causes')
  })

  it('is undoable', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const id = s.getState().addEdge(a, b, 'causes')
    s.getState().reverseEdge(id)
    s.getState().undo()
    const edge = s.getState().edges.find((e) => e.id === id)!
    expect(edge.source).toBe(a)
    expect(edge.target).toBe(b)
  })
})

describe('onNodesChange', () => {
  it('pushes history when a drag starts and applies the position', () => {
    const s = makeStore()
    const id = s.getState().addNode(0, 0)
    const histBefore = s.getState()._history.length
    s.getState().onNodesChange([{ type: 'position', id, position: { x: 5, y: 7 }, dragging: true }])
    expect(s.getState()._history.length).toBe(histBefore + 1)
    expect(s.getState().nodes[0].position).toEqual({ x: 5, y: 7 })
  })

  it('does not push history for a drag continuation already in progress', () => {
    const s = makeStore()
    const id = s.getState().addNode(0, 0)
    s.getState().onNodesChange([{ type: 'position', id, position: { x: 5, y: 0 }, dragging: true }])
    const histBefore = s.getState()._history.length
    s.getState().onNodesChange([{ type: 'position', id, position: { x: 9, y: 0 }, dragging: true }])
    expect(s.getState()._history.length).toBe(histBefore)
    expect(s.getState().nodes[0].position.x).toBe(9)
  })

  it('clears the dragging marker on drag end so the next drag pushes history again', () => {
    const s = makeStore()
    const id = s.getState().addNode(0, 0)
    s.getState().onNodesChange([{ type: 'position', id, position: { x: 1, y: 0 }, dragging: true }])
    s.getState().onNodesChange([
      { type: 'position', id, position: { x: 1, y: 0 }, dragging: false },
    ])
    const histBefore = s.getState()._history.length
    s.getState().onNodesChange([{ type: 'position', id, position: { x: 2, y: 0 }, dragging: true }])
    expect(s.getState()._history.length).toBe(histBefore + 1)
  })

  it('pushes history and removes the node on a remove change', () => {
    const s = makeStore()
    const id = s.getState().addNode(0, 0)
    const histBefore = s.getState()._history.length
    s.getState().onNodesChange([{ type: 'remove', id }])
    expect(s.getState().nodes).toHaveLength(0)
    expect(s.getState()._history.length).toBe(histBefore + 1)
  })

  it('does not push history for a plain select change', () => {
    const s = makeStore()
    const id = s.getState().addNode(0, 0)
    const histBefore = s.getState()._history.length
    s.getState().onNodesChange([
      { type: 'select', id, selected: true } as NodeChange<Node<ConceptNodeData>>,
    ])
    expect(s.getState()._history.length).toBe(histBefore)
  })
})

describe('onEdgesChange', () => {
  it('pushes history, removes the edge, and clears its selection on remove', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const id = s.getState().addEdge(a, b, 'causes')
    const histBefore = s.getState()._history.length
    s.getState().onEdgesChange([{ type: 'remove', id }])
    expect(s.getState().edges).toHaveLength(0)
    expect(s.getState().selected).toBeNull()
    expect(s.getState()._history.length).toBe(histBefore + 1)
  })

  it('keeps an unrelated selection when a different edge is removed', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const c = s.getState().addNode(200, 0)
    const e1 = s.getState().addEdge(a, b, 'causes')
    const e2 = s.getState().addEdge(b, c, 'causes')
    s.getState().onEdgesChange([{ type: 'remove', id: e1 }])
    expect(s.getState().selected).toEqual({ kind: 'edge', id: e2 })
  })

  it('does not push history for a non-remove change', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const id = s.getState().addEdge(a, b, 'causes')
    const histBefore = s.getState()._history.length
    s.getState().onEdgesChange([{ type: 'select', id, selected: false } as EdgeChange])
    expect(s.getState()._history.length).toBe(histBefore)
  })
})

describe('updateEdgeType', () => {
  it('changes the relation type and is undoable', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const id = s.getState().addEdge(a, b, 'causes')
    s.getState().updateEdgeType(id, 'enables')
    expect(s.getState().edges.find((e) => e.id === id)?.data?.type).toBe('enables')
    s.getState().undo()
    expect(s.getState().edges.find((e) => e.id === id)?.data?.type).toBe('causes')
  })

  it('leaves other edges untouched', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const c = s.getState().addNode(200, 0)
    const e1 = s.getState().addEdge(a, b, 'causes')
    const e2 = s.getState().addEdge(b, c, 'requires')
    s.getState().updateEdgeType(e1, 'enables')
    expect(s.getState().edges.find((e) => e.id === e2)?.data?.type).toBe('requires')
  })
})

describe('setEdgeCurveFlipMode', () => {
  function edgeStore() {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const id = s.getState().addEdge(a, b, 'causes')
    return { s, id }
  }

  it("mode 'on' sets curveFlip true and pins it while autoCurveFlip is on", () => {
    const { s, id } = edgeStore()
    s.getState().setEdgeCurveFlipMode(id, 'on')
    const d = s.getState().edges.find((e) => e.id === id)!.data!
    expect(d.curveFlip).toBe(true)
    expect(d.curveFlipPinned).toBe(true)
  })

  it("mode 'off' sets curveFlip false", () => {
    const { s, id } = edgeStore()
    s.getState().setEdgeCurveFlipMode(id, 'off')
    expect(s.getState().edges.find((e) => e.id === id)!.data!.curveFlip).toBe(false)
  })

  it("mode 'auto' clears curveFlip and the pin", () => {
    const { s, id } = edgeStore()
    s.getState().setEdgeCurveFlipMode(id, 'on')
    s.getState().setEdgeCurveFlipMode(id, 'auto')
    const d = s.getState().edges.find((e) => e.id === id)!.data!
    expect(d.curveFlip).toBeUndefined()
    expect('curveFlipPinned' in d).toBe(false)
  })

  it('does not pin when autoCurveFlip is off', () => {
    const { s, id } = edgeStore()
    s.getState().setGraphDisplay('autoCurveFlip', false)
    s.getState().setEdgeCurveFlipMode(id, 'on')
    const d = s.getState().edges.find((e) => e.id === id)!.data!
    expect(d.curveFlip).toBe(true)
    expect('curveFlipPinned' in d).toBe(false)
  })
})

describe('addEdge curve flip', () => {
  it('bakes curveFlip into a new edge when autoCurveFlip is off and geometry flips', () => {
    const s = makeStore()
    s.getState().setGraphDisplay('autoCurveFlip', false)
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, -100)
    const id = s.getState().addEdge(a, b, 'causes')
    expect(s.getState().edges.find((e) => e.id === id)?.data?.curveFlip).toBe(true)
  })

  it('omits curveFlip while autoCurveFlip is on', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, -100)
    const id = s.getState().addEdge(a, b, 'causes')
    expect(s.getState().edges.find((e) => e.id === id)?.data?.curveFlip).toBeUndefined()
  })
})

describe('setSelected', () => {
  it('marks the node selected, deselects others, and fills selectedIds', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    s.getState().setSelected({ kind: 'node', id: a })
    expect(s.getState().nodes.find((n) => n.id === a)?.selected).toBe(true)
    expect(s.getState().nodes.find((n) => n.id === b)?.selected).toBe(false)
    expect(s.getState().selectedIds).toEqual([a])
    expect(s.getState().selected).toEqual({ kind: 'node', id: a })
  })

  it('selecting an edge leaves selectedIds empty and flags the edge', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const id = s.getState().addEdge(a, b, 'causes')
    s.getState().setSelected({ kind: 'edge', id })
    expect(s.getState().selectedIds).toEqual([])
    expect(s.getState().edges.find((e) => e.id === id)?.selected).toBe(true)
  })

  it('is a no-op (same state reference) when the selection is unchanged', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    s.getState().setSelected({ kind: 'node', id: a })
    const before = s.getState()
    s.getState().setSelected({ kind: 'node', id: a })
    expect(s.getState()).toBe(before)
  })
})

describe('syncFlowSelection', () => {
  it('a single node id becomes the node selection', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    s.getState().addNode(100, 0)
    s.getState().syncFlowSelection([a], [])
    expect(s.getState().selected).toEqual({ kind: 'node', id: a })
    expect(s.getState().selectedIds).toEqual([a])
    expect(s.getState().nodes.find((n) => n.id === a)?.selected).toBe(true)
  })

  it('a single edge id becomes the edge selection', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const id = s.getState().addEdge(a, b, 'causes')
    s.getState().syncFlowSelection([], [id])
    expect(s.getState().selected).toEqual({ kind: 'edge', id })
  })

  it('multiple nodes select all of them with no single selection', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    s.getState().syncFlowSelection([a, b], [])
    expect(s.getState().selected).toBeNull()
    expect(new Set(s.getState().selectedIds)).toEqual(new Set([a, b]))
  })

  it('is a no-op (same reference) when nothing changed', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    s.getState().addNode(100, 0)
    s.getState().syncFlowSelection([a], [])
    const before = s.getState()
    s.getState().syncFlowSelection([a], [])
    expect(s.getState()).toBe(before)
  })
})

describe('setSelectedIds', () => {
  it('replaces the multi-selection ids', () => {
    const s = makeStore()
    const a = s.getState().addNode()
    const b = s.getState().addNode()
    s.getState().setSelectedIds([a, b])
    expect(s.getState().selectedIds).toEqual([a, b])
  })
})

describe('deleteSelection (mixed and empty)', () => {
  it('removes nodes in selectedIds plus a separately selected edge and incident edges', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const c = s.getState().addNode(200, 0)
    s.getState().addEdge(a, b, 'causes')
    s.getState().addEdge(b, c, 'causes')
    s.getState().setSelectedIds([a])
    s.getState().deleteSelection()
    const st = s.getState()
    expect(st.nodes.map((n) => n.id).sort()).toEqual([b, c].sort())
    expect(st.edges).toHaveLength(0)
  })

  it('is a no-op when nothing is selected', () => {
    const s = makeStore()
    s.getState().addNode()
    s.getState().setSelected(null)
    s.getState().setSelectedIds([])
    const before = s.getState()
    s.getState().deleteSelection()
    expect(s.getState()).toBe(before)
  })
})

describe('addNode selection side effects', () => {
  it('deselects a previously selected edge', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const eid = s.getState().addEdge(a, b, 'causes')
    s.getState().addNode(200, 0)
    expect(s.getState().edges.find((e) => e.id === eid)?.selected).toBe(false)
  })
})

describe('requestEditNode / clearEditNodeId', () => {
  it('sets and clears editNodeId', () => {
    const s = makeStore()
    s.getState().requestEditNode('x')
    expect(s.getState().editNodeId).toBe('x')
    s.getState().clearEditNodeId()
    expect(s.getState().editNodeId).toBeNull()
  })
})

describe('undo / redo edges', () => {
  it('undo is a no-op (same reference) with empty history', () => {
    const s = makeStore()
    const before = s.getState()
    s.getState().undo()
    expect(s.getState()).toBe(before)
  })

  it('redo is a no-op (same reference) with empty future', () => {
    const s = makeStore()
    s.getState().addNode()
    const before = s.getState()
    s.getState().redo()
    expect(s.getState()).toBe(before)
  })

  it('undo clears the current selection', () => {
    const s = makeStore()
    const a = s.getState().addNode()
    s.getState().setSelected({ kind: 'node', id: a })
    s.getState().updateNodeData(a, { text: 'x' })
    s.getState().undo()
    expect(s.getState().selected).toBeNull()
    expect(s.getState().selectedIds).toEqual([])
  })

  it('keeps at most MAX_UNDO history entries', () => {
    const s = makeStore()
    for (let i = 0; i < MAX_UNDO + 10; i++) s.getState().addNode()
    expect(s.getState()._history.length).toBe(MAX_UNDO)
  })
})

describe('bakeCurveFlipFromPositions', () => {
  const node = (id: string, x: number, y: number) =>
    ({ id, position: { x, y }, data: {} }) as unknown as Node<ConceptNodeData>
  const edge = (extra: Record<string, unknown>) =>
    ({ id: 'e', source: 'a', target: 'b', data: { type: 'causes', ...extra } }) as unknown as Edge

  it('pins a computed curveFlip onto an unpinned edge when geometry flips', () => {
    const baked = bakeCurveFlipFromPositions([edge({})], [node('a', 0, 0), node('b', 100, -100)])
    expect(baked[0].data?.curveFlip).toBe(true)
  })

  it('leaves a pinned edge untouched (same reference)', () => {
    const edges = [edge({ curveFlipPinned: true })]
    const baked = bakeCurveFlipFromPositions(edges, [node('a', 0, 0), node('b', 100, -100)])
    expect(baked[0]).toBe(edges[0])
  })

  it('leaves an edge with a missing endpoint untouched (same reference)', () => {
    const edges = [edge({})]
    const baked = bakeCurveFlipFromPositions(edges, [node('a', 0, 0)])
    expect(baked[0]).toBe(edges[0])
  })

  it('drops curveFlip back to undefined when geometry says no flip', () => {
    const baked = bakeCurveFlipFromPositions(
      [edge({ curveFlip: true })],
      [node('a', 0, 0), node('b', 100, 0)],
    )
    expect(baked[0].data?.curveFlip).toBeUndefined()
  })
})

describe('initial slice state', () => {
  it('starts empty', () => {
    const st = makeStore().getState()
    expect(st.nodes).toEqual([])
    expect(st.edges).toEqual([])
    expect(st.selected).toBeNull()
    expect(st.selectedIds).toEqual([])
    expect(st.pasteAvailable).toBe(false)
    expect(st.editNodeId).toBeNull()
    expect(st._history).toEqual([])
    expect(st._future).toEqual([])
  })
})

describe('deleteNode / deleteEdge targeting', () => {
  it('deleteNode removes edges where the node is the target and keeps an unrelated selection', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const c = s.getState().addNode(200, 0)
    s.getState().addEdge(a, b, 'causes')
    s.getState().setSelected({ kind: 'node', id: c })
    s.getState().deleteNode(b)
    expect(s.getState().edges).toHaveLength(0)
    expect(s.getState().selected).toEqual({ kind: 'node', id: c })
  })

  it('deleteEdge removes only the target edge and keeps an unrelated selection', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const c = s.getState().addNode(200, 0)
    const e1 = s.getState().addEdge(a, b, 'causes')
    const e2 = s.getState().addEdge(b, c, 'causes')
    s.getState().deleteEdge(e1)
    expect(s.getState().edges.map((e) => e.id)).toEqual([e2])
    expect(s.getState().selected).toEqual({ kind: 'edge', id: e2 })
  })
})

describe('undo / redo internals', () => {
  it('moves snapshots between history and future', () => {
    const s = makeStore()
    s.getState().addNode()
    s.getState().addNode()
    s.getState().addNode()
    const hist = s.getState()._history.length
    s.getState().undo()
    expect(s.getState()._history.length).toBe(hist - 1)
    expect(s.getState()._future.length).toBe(1)
    s.getState().undo()
    expect(s.getState()._future.length).toBe(2)
    s.getState().redo()
    expect(s.getState()._history.length).toBe(hist - 1)
    expect(s.getState()._future.length).toBe(1)
  })
})

describe('paste / duplicate selection side effects', () => {
  it('pasting a single node selects the paste and deselects the originals', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    s.getState().setSelected({ kind: 'node', id: a })
    s.getState().copySelection()
    const pasted = s.getState().pasteSelection()
    expect(pasted).toHaveLength(1)
    expect(s.getState().selected).toEqual({ kind: 'node', id: pasted![0] })
    expect(s.getState().nodes.find((n) => n.id === a)?.selected).toBe(false)
    expect(s.getState().nodes.find((n) => n.id === b)?.selected).toBe(false)
  })

  it('duplicate deselects the originals', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    s.getState().setSelected({ kind: 'node', id: a })
    s.getState().duplicateSelection()
    expect(s.getState().nodes.find((n) => n.id === a)?.selected).toBe(false)
  })
})

describe('selectAll edges', () => {
  it('works on a graph with nodes but no edges', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    s.getState().setSelected(null)
    s.getState().selectAll()
    expect(new Set(s.getState().selectedIds)).toEqual(new Set([a, b]))
    expect(s.getState().nodes.every((n) => n.selected)).toBe(true)
  })

  it('is a no-op (same reference) the second time', () => {
    const s = makeStore()
    s.getState().addNode(0, 0)
    s.getState().addNode(100, 0)
    s.getState().setSelected(null)
    s.getState().selectAll()
    const before = s.getState()
    s.getState().selectAll()
    expect(s.getState()).toBe(before)
  })
})

describe('deletion telemetry', () => {
  describe('deleteNode', () => {
    it('emits node_deleted when a node is actually removed', () => {
      const s = makeStore()
      const id = s.getState().addNode()
      s.getState().deleteNode(id)
      expect(track).toHaveBeenCalledWith({ name: 'node_deleted' })
    })

    it('does not emit node_deleted when the node ID does not exist', () => {
      const s = makeStore()
      s.getState().deleteNode('nonexistent')
      expect(track).not.toHaveBeenCalledWith({ name: 'node_deleted' })
    })
  })

  describe('deleteEdge', () => {
    it('emits edge_deleted when an edge is actually removed', () => {
      const s = makeStore()
      const a = s.getState().addNode()
      const b = s.getState().addNode()
      const id = s.getState().addEdge(a, b, 'causes')
      s.getState().deleteEdge(id)
      expect(track).toHaveBeenCalledWith({ name: 'edge_deleted' })
    })

    it('does not emit edge_deleted when the edge ID does not exist', () => {
      const s = makeStore()
      s.getState().deleteEdge('nonexistent')
      expect(track).not.toHaveBeenCalledWith({ name: 'edge_deleted' })
    })
  })

  describe('onNodesChange remove', () => {
    it('emits node_deleted when a remove change targets an existing node', () => {
      const s = makeStore()
      const id = s.getState().addNode()
      s.getState().onNodesChange([{ type: 'remove', id }])
      expect(track).toHaveBeenCalledWith({ name: 'node_deleted' })
    })

    it('does not emit node_deleted when a remove change targets a nonexistent node', () => {
      const s = makeStore()
      s.getState().onNodesChange([{ type: 'remove', id: 'nonexistent' }])
      expect(track).not.toHaveBeenCalledWith({ name: 'node_deleted' })
    })
  })

  describe('onEdgesChange remove', () => {
    it('emits edge_deleted when a remove change targets an existing edge', () => {
      const s = makeStore()
      const a = s.getState().addNode()
      const b = s.getState().addNode()
      const id = s.getState().addEdge(a, b, 'causes')
      s.getState().onEdgesChange([{ type: 'remove', id }])
      expect(track).toHaveBeenCalledWith({ name: 'edge_deleted' })
    })

    it('does not emit edge_deleted when a remove change targets a nonexistent edge', () => {
      const s = makeStore()
      s.getState().onEdgesChange([{ type: 'remove', id: 'nonexistent' }])
      expect(track).not.toHaveBeenCalledWith({ name: 'edge_deleted' })
    })
  })

  describe('deleteSelection', () => {
    it('emits node_deleted when a node is removed via selection delete', () => {
      const s = makeStore()
      const a = s.getState().addNode()
      s.getState().setSelected({ kind: 'node', id: a })
      s.getState().deleteSelection()
      expect(track).toHaveBeenCalledWith({ name: 'node_deleted' })
    })

    it('emits edge_deleted when only an edge is removed via selection delete', () => {
      const s = makeStore()
      const a = s.getState().addNode()
      const b = s.getState().addNode()
      const id = s.getState().addEdge(a, b, 'causes')
      s.getState().setSelected({ kind: 'edge', id })
      s.getState().deleteSelection()
      expect(track).toHaveBeenCalledWith({ name: 'edge_deleted' })
    })

    it('emits both events when a mixed selection is deleted (nodes + edges)', () => {
      const s = makeStore()
      const a = s.getState().addNode(0, 0)
      const b = s.getState().addNode(100, 0)
      s.getState().addNode(200, 0)
      const eid = s.getState().addEdge(a, b, 'causes')
      s.getState().setSelectedIds([a])
      // Also select the edge so both nodes and edges are in the selection
      s.getState().onEdgesChange([{ type: 'select', id: eid, selected: true } as EdgeChange])
      s.getState().deleteSelection()
      expect(track).toHaveBeenCalledWith({ name: 'node_deleted' })
      expect(track).toHaveBeenCalledWith({ name: 'edge_deleted' })
    })

    it('does not emit when deleteSelection has nothing to delete', () => {
      const s = makeStore()
      s.getState().deleteSelection()
      expect(track).not.toHaveBeenCalled()
    })
  })

  describe('payload safety', () => {
    it('never includes node IDs, edge IDs, or graph content in node_deleted track calls', () => {
      const s = makeStore()
      const nodeId = s.getState().addNode(10, 20)
      s.getState().deleteNode(nodeId)
      expect(track).toHaveBeenCalledTimes(1)
      const args = vi.mocked(track).mock.calls[0][0]
      expect(args).toEqual({ name: 'node_deleted' })
      // Only name should be present — no extra props
      expect(Object.keys(args)).toEqual(['name'])
    })

    it('never includes node IDs, edge IDs, or graph content in edge_deleted track calls', () => {
      const s = makeStore()
      const a = s.getState().addNode()
      const b = s.getState().addNode()
      const id = s.getState().addEdge(a, b, 'causes')
      s.getState().deleteEdge(id)
      expect(track).toHaveBeenCalledTimes(1)
      const args = vi.mocked(track).mock.calls[0][0]
      expect(args).toEqual({ name: 'edge_deleted' })
      expect(Object.keys(args)).toEqual(['name'])
    })
  })
})

describe('syncFlowSelection branches', () => {
  it('updates a multi-selection even while the single selection stays null', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const c = s.getState().addNode(200, 0)
    s.getState().syncFlowSelection([a, b], [])
    s.getState().syncFlowSelection([a, c], [])
    expect(new Set(s.getState().selectedIds)).toEqual(new Set([a, c]))
    expect(s.getState().nodes.find((n) => n.id === b)?.selected).toBe(false)
    expect(s.getState().nodes.find((n) => n.id === c)?.selected).toBe(true)
  })

  it('selects neither when both a node and an edge are passed', () => {
    const s = makeStore()
    const a = s.getState().addNode(0, 0)
    const b = s.getState().addNode(100, 0)
    const e = s.getState().addEdge(a, b, 'causes')
    s.getState().syncFlowSelection([a], [e])
    expect(s.getState().selected).toBeNull()
  })
})
