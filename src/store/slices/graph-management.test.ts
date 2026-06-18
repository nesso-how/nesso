// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { dbClearGraphs, dbLoadGraph } from '@/store/db'
import type { GraphState } from '../state'
import { createDesktopSyncSlice } from './desktop-sync'
import { createGraphEditingSlice } from './graph-editing'
import { createGraphManagementSlice } from './graph-management'
import { createSettingsSlice } from './settings'
import { createUISlice } from './ui'

// Web mode: `isDesktop()` is false under jsdom, so graph management persists
// through IndexedDB only — no disk/Tauri involved. Graphs live in a real
// fake-indexeddb instance.
function makeStore() {
  return createStore<GraphState>()(
    (...a) =>
      ({
        ...createGraphEditingSlice(...a),
        ...createSettingsSlice(...a),
        ...createUISlice(...a),
        ...createGraphManagementSlice(...a),
        ...createDesktopSyncSlice(...a),
      }) as GraphState,
  )
}

type Store = ReturnType<typeof makeStore>

async function freshStore(): Promise<Store> {
  const s = makeStore()
  // Seed IndexedDB from the bundled seeds so every graphList meta has a backing
  // record (the app does this on startup).
  await s.getState().loadGraphList()
  return s
}

beforeEach(async () => {
  await dbClearGraphs()
})

describe('loadGraphList', () => {
  it('seeds IndexedDB from the bundled graphs when empty', async () => {
    const s = makeStore()
    const list = await s.getState().loadGraphList()
    expect(list.length).toBeGreaterThan(0)
    const seeded = await dbLoadGraph(list[0].id)
    expect(seeded?.id).toBe(list[0].id)
  })

  it('adopts the browser language when seeding an empty database', async () => {
    const original = navigator.language
    Object.defineProperty(navigator, 'language', { value: 'it-IT', configurable: true })
    try {
      const s = makeStore()
      await s.getState().loadGraphList()
      expect(s.getState().settings.language).toBe('it')
    } finally {
      Object.defineProperty(navigator, 'language', { value: original, configurable: true })
    }
  })
})

describe('createGraph', () => {
  it('creates an empty graph, selects it, and persists it to IndexedDB', async () => {
    const s = await freshStore()
    const id = await s.getState().createGraph('Fresh')
    const state = s.getState()
    expect(state.currentGraphId).toBe(id)
    expect(state.graphList.some((g) => g.id === id && g.name === 'Fresh')).toBe(true)
    expect(state.nodes).toHaveLength(0)
    const stored = await dbLoadGraph(id)
    expect(stored).toMatchObject({ id, name: 'Fresh' })
  })
})

describe('importGraph', () => {
  it('de-duplicates a name that collides with an existing graph', async () => {
    const s = await freshStore()
    await s.getState().createGraph('Foo')
    const id = await s.getState().importGraph('Foo', [], [])
    expect(s.getState().graphList.find((g) => g.id === id)?.name).toBe('Foo-2')
  })
})

describe('renameGraph', () => {
  it('updates the name in the list and in IndexedDB', async () => {
    const s = await freshStore()
    const id = await s.getState().createGraph('Before')
    await s.getState().renameGraph(id, 'After')
    expect(s.getState().graphList.find((g) => g.id === id)?.name).toBe('After')
    expect((await dbLoadGraph(id))?.name).toBe('After')
  })

  it('is a no-op for an unknown id', async () => {
    const s = await freshStore()
    const before = s.getState().graphList
    await s.getState().renameGraph('does-not-exist', 'X')
    expect(s.getState().graphList).toEqual(before)
  })
})

describe('importGraph (existing id)', () => {
  it('updates the matching graph in place instead of appending', async () => {
    const s = await freshStore()
    const id = await s.getState().createGraph('Orig')
    const before = s.getState().graphList.length
    const ret = await s.getState().importGraph('Updated', [], [], undefined, id)
    expect(ret).toBe(id)
    expect(s.getState().graphList).toHaveLength(before)
    expect(s.getState().graphList.find((g) => g.id === id)?.name).toBe('Updated')
  })
})

describe('saveCurrentGraph', () => {
  it('persists in-memory edits of the active graph to IndexedDB', async () => {
    const s = await freshStore()
    const id = await s.getState().createGraph('Editable')
    s.getState().addNode(10, 20)
    await s.getState().saveCurrentGraph()
    const stored = await dbLoadGraph(id)
    expect(stored?.nodes).toHaveLength(1)
  })
})

describe('loadGraph', () => {
  it('switches the active graph to the persisted snapshot', async () => {
    const s = await freshStore()
    const a = await s.getState().createGraph('A')
    s.getState().addNode()
    await s.getState().saveCurrentGraph()
    await s.getState().createGraph('B')

    await s.getState().loadGraph(a)
    expect(s.getState().currentGraphId).toBe(a)
    expect(s.getState().nodes).toHaveLength(1)
  })

  it('flushes unsaved edits of the outgoing graph before switching', async () => {
    const s = await freshStore()
    const a = await s.getState().createGraph('A')
    const b = await s.getState().createGraph('B')
    await s.getState().loadGraph(a)
    s.getState().addNode()
    await s.getState().loadGraph(b)
    const storedA = await dbLoadGraph(a)
    expect(storedA?.nodes).toHaveLength(1)
  })

  it('ignores an unknown id', async () => {
    const s = await freshStore()
    const before = s.getState().currentGraphId
    await s.getState().loadGraph('does-not-exist')
    expect(s.getState().currentGraphId).toBe(before)
    expect(s.getState().nodes).toHaveLength(0)
  })
})

describe('deleteGraph', () => {
  it('removes the graph from the list and IndexedDB and loads a sibling', async () => {
    const s = await freshStore()
    const a = await s.getState().createGraph('A')
    const b = await s.getState().createGraph('B')
    await s.getState().deleteGraph(b)
    const state = s.getState()
    expect(state.graphList.some((g) => g.id === b)).toBe(false)
    expect(await dbLoadGraph(b)).toBeUndefined()
    expect(state.currentGraphId).not.toBe(b)
    expect(state.graphList.some((g) => g.id === a)).toBe(true)
  })

  it('drops the saved viewport of the deleted graph', async () => {
    const s = await freshStore()
    const a = await s.getState().createGraph('A')
    await s.getState().createGraph('B')
    s.getState().saveViewport(a, { x: 1, y: 2, zoom: 1 })
    expect(s.getState().viewports[a]).toBeDefined()
    await s.getState().deleteGraph(a)
    expect(s.getState().viewports[a]).toBeUndefined()
  })
})

describe('desktop project actions in web mode', () => {
  it('are no-ops that just return the current graph list', async () => {
    const s = await freshStore()
    const before = s.getState().graphList
    expect(await s.getState().createProject()).toEqual(before)
    expect(await s.getState().openProject()).toEqual(before)
    expect(await s.getState().switchProject('/whatever')).toEqual(before)
  })
})
