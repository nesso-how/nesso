// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { beforeEach, describe, expect, it } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { setGraphClipboard } from '@/lib/graphClipboard'
import type { GraphState } from '../state'
import { createGraphEditingSlice } from './graph-editing'
import { createSettingsSlice } from './settings'

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

beforeEach(() => setGraphClipboard(null))

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
})
