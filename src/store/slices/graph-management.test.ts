// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
import {
  dbClearGraphs,
  dbListGraphs,
  dbLoadGraph,
  dbSaveGraph,
  GRAPH_RECORD_VERSION,
} from '@/store/db'
import type { GraphRecord } from '@/store/db'
import type { GraphState } from '../state'
import { createDesktopSyncSlice } from './desktop-sync'
import { createGraphEditingSlice } from './graph-editing'
import { createGraphManagementSlice } from './graph-management'
import { createSettingsSlice } from './settings'
import { createUISlice } from './ui'

// Controlled override for dbLoadGraph — set per-test to intercept load timing.
// Use vi.hoisted so the references are available in the hoisted vi.mock factory.
const { dbLoadGraphOverrideRef, realDbLoadGraphRef, mockTrack } = vi.hoisted(() => ({
  dbLoadGraphOverrideRef: {
    current: null as ((id: string) => Promise<GraphRecord | undefined>) | null,
  },
  realDbLoadGraphRef: { current: null as typeof dbLoadGraph | null },
  mockTrack: vi.fn(),
}))

vi.mock('@/store/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/store/db')>()
  realDbLoadGraphRef.current = original.dbLoadGraph
  return {
    ...original,
    dbLoadGraph: vi.fn((id: string) => {
      const override = dbLoadGraphOverrideRef.current
      if (override) return override(id)
      return original.dbLoadGraph(id)
    }),
  }
})

vi.mock('@/telemetry', () => ({
  track: mockTrack,
}))

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

describe('store display initialization', () => {
  it('starts the active graph display with the app heatmap default', () => {
    const s = makeStore()

    expect(s.getState().settings.showHeatmap).toBe(false)
    expect(s.getState().graphDisplay.showHeatmap).toBe(false)
  })
})

async function freshStore(): Promise<Store> {
  const s = makeStore()
  // Mirror app startup: seeds the demo graph(s) when IDB is empty.
  await s.getState().loadGraphList()
  return s
}

beforeEach(async () => {
  await dbClearGraphs()
})

describe('loadGraphList', () => {
  it('seeds the demo graph(s) when IndexedDB is empty', async () => {
    const s = makeStore()
    const list = await s.getState().loadGraphList()
    expect(list.length).toBeGreaterThan(0)
    // Unlike the old empty Tutorial, the seeded demo carries content.
    const stored = await dbLoadGraph(list[0].id)
    expect(stored?.nodes.length).toBeGreaterThan(0)
  })

  it('is idempotent under a concurrent double bootstrap (StrictMode init effect)', async () => {
    const s = makeStore()
    // React StrictMode runs the init effect twice; both passes can enter the
    // empty-DB branch before either write commits. Stable seed ids must collapse
    // the two writes into one record per seed (no duplicates).
    await Promise.all([s.getState().loadGraphList(), s.getState().loadGraphList()])
    const records = await dbListGraphs()
    expect(records.length).toBeGreaterThan(0)
    const ids = records.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
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
    expect(state.graphDisplay.showHeatmap).toBe(false)
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

  it('normalizes existing IDB records when building the peer name list', async () => {
    const s = makeStore()
    // Seed a valid graph.
    await s.getState().createGraph('Valid')
    // Seed a corrupt record directly into IDB.
    const corruptId = 'corrupt-import-peers'
    const corrupt = {
      recordVersion: GRAPH_RECORD_VERSION,
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      id: corruptId,
      name: 'Corrupt',
      createdAt: 1,
      updatedAt: 1,
      nodes: [
        {
          id: 'n1',
          type: 'concept',
          position: { x: 0, y: 0 },
          data: {
            text: 'Bad',
            elaboration: { definition: 'ok', examples: ['alpha'] },
          },
        },
      ],
      edges: [],
    }
    await dbSaveGraph(corrupt as unknown as GraphRecord)

    // importGraph should throw because normalization rejects the corrupt peer record.
    await expect(() => s.getState().importGraph('Import', [], [])).rejects.toThrow()
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

  it('normalizes the IDB record before renaming and preserves the corrupt raw data', async () => {
    const s = makeStore()
    // Seed a graph through the store so it's in the list.
    const id = await s.getState().createGraph('Pre-rename')
    // Directly corrupt the IDB record: add a malformed node with removed alpha fields.
    const corrupt = {
      recordVersion: GRAPH_RECORD_VERSION,
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      id,
      name: 'Pre-rename',
      createdAt: 1,
      updatedAt: 1,
      nodes: [
        {
          id: 'n1',
          type: 'concept',
          position: { x: 0, y: 0 },
          data: {
            text: 'Bad',
            elaboration: { definition: 'ok', notes: 'alpha cruft' },
          },
        },
      ],
      edges: [],
    }
    await dbSaveGraph(corrupt as unknown as GraphRecord)

    // renameGraph should throw because normalization rejects the corrupt node.
    await expect(() => s.getState().renameGraph(id, 'NewName')).rejects.toThrow()

    // The raw corrupt record is still preserved in IDB.
    const preserved = await dbLoadGraph(id)
    expect(preserved).toBeDefined()
    expect(preserved!.name).toBe('Pre-rename')
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

describe('saveCurrentGraph (review state)', () => {
  it('persists a review-only change and rehydrates it after a reload', async () => {
    const s = await freshStore()
    const a = await s.getState().createGraph('A')
    const nodeId = s.getState().addNode()
    await s.getState().saveCurrentGraph()

    // Review-only change: only FSRS fields, no content edit.
    s.getState().updateNodeData(nodeId, { stability: 42, reps: 3, due: 9999 })
    await s.getState().saveCurrentGraph()

    // Round-trip through another graph so nodes are rebuilt from storage.
    await s.getState().createGraph('B')
    await s.getState().loadGraph(a)

    const node = s.getState().nodes.find((n) => n.id === nodeId)
    expect(node?.data.stability).toBe(42)
    expect(node?.data.reps).toBe(3)
    expect(node?.data.due).toBe(9999)
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

  it('uses the current app heatmap default when a stored graph has no display', async () => {
    const s = makeStore()
    const id = 'g-no-display'

    s.getState().setSetting('showHeatmap', true)
    await dbSaveGraph({
      recordVersion: GRAPH_RECORD_VERSION,
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      id,
      name: 'No display',
      createdAt: 1,
      updatedAt: 1,
      nodes: [],
      edges: [],
    })

    await s.getState().loadGraph(id)

    expect(s.getState().graphDisplay.showHeatmap).toBe(true)
  })

  it('resets the heatmap to the current app default when the graph is missing', async () => {
    const s = makeStore()

    s.getState().setSetting('showHeatmap', true)
    s.getState().setGraphDisplay('showHeatmap', false)

    await s.getState().loadGraph('does-not-exist')

    expect(s.getState().graphDisplay.showHeatmap).toBe(true)
  })

  it('does not overwrite the active graph when a missing-graph load resolves after a successful one', async () => {
    const s = makeStore()
    await s.getState().loadGraphList()

    const validId = await s.getState().createGraph('Valid')
    s.getState().addNode(50, 50)
    // Persist the graph with showHeatmap differing from the app default.
    s.getState().setGraphDisplay('showHeatmap', false)
    await s.getState().saveCurrentGraph()

    // Switch the app default to the opposite value so the missing-graph path
    // would clobber the loaded graph's display if it races.
    s.getState().setSetting('showHeatmap', true)

    // Create a deferred promise so we control when the "missing" call resolves.
    let resolveMissing!: (value: GraphRecord | undefined) => void
    const missingPromise = new Promise<GraphRecord | undefined>((resolve) => {
      resolveMissing = resolve
    })

    // Intercept dbLoadGraph: delay the missing-graph call, pass through for valid ids.
    dbLoadGraphOverrideRef.current = async (id: string) => {
      if (id === 'fake-missing') return missingPromise
      return realDbLoadGraphRef.current!(id)
    }

    // Start the missing load (NOT awaited — it's blocked on the deferred promise).
    const missingLoad = s.getState().loadGraph('fake-missing')

    // Start and await the valid load. It should complete first.
    await s.getState().loadGraph(validId)

    // The state must reflect the successfully loaded valid graph.
    expect(s.getState().currentGraphId).toBe(validId)
    expect(s.getState().nodes).toHaveLength(1)
    expect(s.getState().graphDisplay.showHeatmap).toBe(false)

    // Now let the missing-graph call resolve. Without the token guard, this
    // would reset showHeatmap to the app default (true), clobbering the loaded
    // graph's stored display.
    resolveMissing(undefined)
    await missingLoad

    // State must still reflect the valid graph — the stale missing-graph
    // response must be discarded.
    expect(s.getState().currentGraphId).toBe(validId)
    expect(s.getState().nodes).toHaveLength(1)
    expect(s.getState().graphDisplay.showHeatmap).toBe(false)

    dbLoadGraphOverrideRef.current = null
  })

  it('emits graph_opened after a successful load', async () => {
    const s = await freshStore()
    const a = await s.getState().createGraph('A')
    mockTrack.mockClear()

    await s.getState().loadGraph(a)

    expect(mockTrack).toHaveBeenCalledWith({ name: 'graph_opened' })
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

describe('graph record versioning', () => {
  it('persists bundled seeds as current versioned graph records', async () => {
    const s = makeStore()
    await s.getState().loadGraphList()

    const records = await dbListGraphs()
    expect(records.length).toBeGreaterThan(0)
    expect(records.every((record) => record.recordVersion === 1)).toBe(true)
    expect(
      records.every(
        (record) =>
          record.vocabulary.id === '@nesso-how/vocab-learning' &&
          record.vocabulary.version === '0.1.0',
      ),
    ).toBe(true)
  })

  it('normalizes a versioned IDB record before loading it', async () => {
    const s = makeStore()
    await s.getState().loadGraphList()
    const [record] = await dbListGraphs()
    expect(record).toBeDefined()
    await s.getState().loadGraph(record!.id)
    expect(s.getState().currentGraphId).toBe(record!.id)
    expect(s.getState().nodes).toEqual(record!.nodes)
  })

  it('rejects a newer graph record from IDB', async () => {
    const s = makeStore()
    // Seed a record with recordVersion: 2 (newer than current app)
    await dbSaveGraph({
      recordVersion: 2,
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      id: 'newer-graph',
      name: 'Newer',
      createdAt: 1,
      updatedAt: 1,
      nodes: [],
      edges: [],
    } as unknown as GraphRecord)
    await expect(s.getState().loadGraph('newer-graph')).rejects.toThrow(
      'Graph record is from a newer app version',
    )
  })
})

describe('desktop project actions in web mode', () => {
  it('are no-ops that just return the current graph list', async () => {
    const s = await freshStore()
    const before = s.getState().graphList
    expect(await s.getState().openOrCreateProject()).toEqual(before)
    expect(await s.getState().switchProject('/whatever')).toEqual(before)
  })
})

describe('loadGraphList corrupt IDB recovery', () => {
  it('preserves a corrupt IDB record without deleting — does not quarantine destructively', async () => {
    const s = makeStore()

    // Seed a valid record so the list is not empty.
    const validId = 'g0000000000001'
    await dbSaveGraph({
      recordVersion: GRAPH_RECORD_VERSION,
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      id: validId,
      name: 'Valid',
      createdAt: 1,
      updatedAt: 1,
      nodes: [],
      edges: [],
    })

    // Seed a corrupt record — missing recordVersion (unversioned alpha shape).
    const corruptId = 'corrupt-graph'
    const corruptRecord = {
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      id: corruptId,
      name: 'Corrupt',
      createdAt: 1,
      updatedAt: 1,
      nodes: [],
      edges: [],
    } as unknown as GraphRecord
    await dbSaveGraph(corruptRecord)

    const list = await s.getState().loadGraphList()

    // The valid record must be in the list.
    expect(list.some((g) => g.id === validId)).toBe(true)

    // The corrupt record must NOT be deleted from IDB — data is preserved.
    const remaining = await dbListGraphs()
    expect(remaining.some((r) => r.id === corruptId)).toBe(true)

    // The raw corrupt record's fields are still intact (e.g. id is preserved).
    const preserved = remaining.find((r) => r.id === corruptId)
    expect(preserved?.id).toBe(corruptId)
    expect(preserved?.name).toBe('Corrupt')
  })

  it('falls back to the first valid graph when persisted currentGraphId points to a skipped corrupt record', async () => {
    const s = makeStore()

    // Seed a valid record.
    const validId = 'g0000000000001'
    await dbSaveGraph({
      recordVersion: GRAPH_RECORD_VERSION,
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      id: validId,
      name: 'Valid',
      createdAt: 1,
      updatedAt: 1,
      nodes: [],
      edges: [],
    })

    // Seed a corrupt record and set it as currentGraphId (simulating
    // a persisted Zustand merge where currentGraphId points to a record
    // that the branch's normalization will skip).
    const corruptId = 'corrupt-graph'
    await dbSaveGraph({
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      id: corruptId,
      name: 'Corrupt',
      createdAt: 1,
      updatedAt: 1,
      nodes: [],
      edges: [],
    } as unknown as GraphRecord)
    s.setState({ currentGraphId: corruptId })

    // loadGraphList must detect that currentGraphId is not in the normalized
    // list and fall back to the first valid graph.
    const list = await s.getState().loadGraphList()

    expect(list.some((g) => g.id === validId)).toBe(true)
    // currentGraphId must now point to the valid graph, not the stale corrupt one.
    expect(s.getState().currentGraphId).not.toBe(corruptId)
    expect(s.getState().currentGraphId).toBe(validId)
  })
})
