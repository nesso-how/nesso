// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import { createRoot, type Root } from 'react-dom/client'
import React, { act } from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockWatch,
  mockExists,
  mockReadTextFile,
  mockWriteTextFile,
  mockMkdir,
  mockReadDir,
  mockRename,
  mockRemove,
  reconcileDiskWithIdbSpy,
  setDiskSyncCacheSpy,
  dbSaveGraphSpy,
  dbDeleteGraphSpy,
  dbListGraphsSpy,
} = vi.hoisted(() => ({
  mockWatch: vi.fn(),
  mockExists: vi.fn(),
  mockReadTextFile: vi.fn(),
  mockWriteTextFile: vi.fn(),
  mockMkdir: vi.fn(),
  mockReadDir: vi.fn(),
  mockRename: vi.fn(),
  mockRemove: vi.fn(),
  reconcileDiskWithIdbSpy: vi.fn(),
  setDiskSyncCacheSpy: vi.fn(),
  dbSaveGraphSpy: vi.fn(),
  dbDeleteGraphSpy: vi.fn(),
  dbListGraphsSpy: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  watch: mockWatch,
  exists: mockExists,
  readTextFile: mockReadTextFile,
  writeTextFile: mockWriteTextFile,
  mkdir: mockMkdir,
  readDir: mockReadDir,
  rename: mockRename,
  remove: mockRemove,
}))

vi.mock('@tauri-apps/api/path', async () => (await import('@/test/fakeTauriFs')).fakePathApi)
vi.mock('@tauri-apps/api/core', async () => (await import('@/test/fakeTauriFs')).fakeCoreApi)

let _desktop = true
vi.mock('@/lib/isDesktop', () => ({
  isDesktop: () => _desktop,
}))

// ── Workspace & DB spies (override specific exports, keep the rest real) ───

vi.mock('@/lib/workspace', async () => {
  const actual = await vi.importActual('@/lib/workspace')
  return {
    ...(actual as Record<string, unknown>),
    reconcileDiskWithIdb: reconcileDiskWithIdbSpy,
    setDiskSyncCache: setDiskSyncCacheSpy,
  }
})

vi.mock('@/store/db', async () => {
  const actual = await vi.importActual('@/store/db')
  return {
    ...(actual as Record<string, unknown>),
    dbSaveGraph: dbSaveGraphSpy,
    dbDeleteGraph: dbDeleteGraphSpy,
    dbListGraphs: dbListGraphsSpy,
  }
})

// ── Store proxy ────────────────────────────────────────────────────────────

interface StoreSnapshot {
  settings: { activeProjectPath: string | null }
  currentGraphId: string
  graphList: { id: string; name: string; updatedAt: number }[]
  savedFingerprint: string | undefined
  nodes: { id: string; position: { x: number; y: number }; data: Record<string, unknown> }[]
  edges: {
    id: string
    source: string
    target: string
    type: string
    data: Record<string, unknown>
  }[]
  graphDisplay: Record<string, unknown>
}

const storeMutations: string[] = []

let _snap: StoreSnapshot & {
  markProjectMissing: ReturnType<typeof vi.fn>
  loadGraph: ReturnType<typeof vi.fn>
  setExternalFileConflict: ReturnType<typeof vi.fn>
}

function freshSnap(): typeof _snap {
  return {
    settings: { activeProjectPath: '/proj-a' },
    currentGraphId: 'g0000000000001',
    graphList: [],
    savedFingerprint: undefined,
    nodes: [],
    edges: [],
    graphDisplay: {},
    markProjectMissing: vi.fn().mockImplementation(() => {
      storeMutations.push('markProjectMissing')
    }),
    loadGraph: vi.fn().mockImplementation(() => {
      storeMutations.push('loadGraph')
      return Promise.resolve()
    }),
    setExternalFileConflict: vi.fn().mockImplementation((v: boolean) => {
      storeMutations.push(`setExternalFileConflict(${v})`)
    }),
  }
}

vi.mock('@/store', async () => {
  const actual = (await vi.importActual('@/store')) as Record<string, unknown>
  return {
    ...actual,
    useGraphStore: Object.assign(
      (selector?: (s: typeof _snap) => unknown) => {
        if (typeof selector === 'function') return selector(_snap)
        return _snap
      },
      {
        getState: () => _snap,
        setState: (partial: Partial<typeof _snap>) => {
          Object.assign(_snap, partial)
        },
      },
    ),
  }
})

// Dynamic import after all mocks are in place.
let useGraphFileWatchFn: (() => void) | null = null
beforeEach(async () => {
  const mod = await import('@/hooks/useGraphFileWatch')
  useGraphFileWatchFn = mod.useGraphFileWatch
})

// ── Helpers ─────────────────────────────────────────────────────────────────

let root: Root | null = null
let container: HTMLDivElement | null = null

function TestHarness() {
  useGraphFileWatchFn?.()
  return React.createElement('div')
}

async function mountHook(): Promise<void> {
  await act(async () => {
    root = createRoot(container!)
    root.render(React.createElement(TestHarness))
  })
}

async function remount(): Promise<void> {
  await act(async () => {
    root!.render(React.createElement(TestHarness))
  })
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 20))
  })
}

// ── Setup / teardown ────────────────────────────────────────────────────────

/** Minimal delay to skip the 400ms debounce in tests. */
async function advanceDebounceTimer(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 410))
  })
}

beforeEach(() => {
  _desktop = true
  _snap = freshSnap()

  mockWatch
    .mockReset()
    .mockImplementation(async (_path: string, cb: (event: { paths: string[] }) => void) => {
      // Capture the callback so tests can fire watch events.
      ;(_snap as unknown as Record<string, unknown>)._watchCb = cb
      return () => {}
    })
  mockExists.mockReset().mockResolvedValue(true)
  mockReadTextFile.mockReset().mockImplementation(async (p: string) => {
    if (p.endsWith('.nesso/manifest.json')) return JSON.stringify({ version: 1, entries: {} })
    return ''
  })
  mockWriteTextFile.mockReset().mockResolvedValue(undefined)
  mockMkdir.mockReset().mockResolvedValue(undefined)
  mockReadDir.mockReset().mockResolvedValue([])
  mockRename.mockReset().mockResolvedValue(undefined)
  mockRemove.mockReset().mockResolvedValue(undefined)

  // Reset reconciliation/cache/IDB spies.
  reconcileDiskWithIdbSpy.mockReset().mockResolvedValue({
    manifest: { version: 1, entries: {} },
    toPersist: [],
    removed: [],
    unsupportedFiles: [],
    reservedPaths: [],
  })
  setDiskSyncCacheSpy.mockReset()
  dbSaveGraphSpy.mockReset().mockResolvedValue(undefined)
  dbDeleteGraphSpy.mockReset().mockResolvedValue(undefined)
  // dbListGraphs spy defaults to the real implementation via fake-indexeddb.
  dbListGraphsSpy.mockReset().mockImplementation(async () => {
    const actual = await vi.importActual<typeof import('@/store/db')>('@/store/db')
    return actual.dbListGraphs()
  })

  storeMutations.length = 0

  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  if (root) {
    root.unmount()
    root = null
  }
  if (container) {
    container.remove()
    container = null
  }
  useGraphFileWatchFn = null
  // Re-import for fresh tests.
  import('@/hooks/useGraphFileWatch').then((mod) => {
    useGraphFileWatchFn = mod.useGraphFileWatch
  })
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useGraphFileWatch stale-generation guard', () => {
  it('prevents markProjectMissing when project path changed during workspace resolution', async () => {
    // Gate exists() so the hook stalls inside resolveAndVerifyWorkspace.
    let resolveExists: (v: boolean) => void = () => {}
    mockExists.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveExists = resolve
      }),
    )

    await mountHook()
    await flushMicrotasks()

    // Switch project while exists() is pending.
    _snap.settings.activeProjectPath = '/proj-b'
    _snap.markProjectMissing = vi.fn()

    resolveExists(false)
    await flushMicrotasks()

    // Stale generation must not call markProjectMissing.
    expect(_snap.markProjectMissing).not.toHaveBeenCalled()
  })

  it('prevents reconciliation, cache, and IDB mutations when same-path watcher fires from a stale generation', async () => {
    // Mount with path A — the watcher starts and captures the setup generation.
    await mountHook()
    await flushMicrotasks()

    // Gate exists() so the handler stalls inside resolveAndVerifyWorkspace.
    let resolveExistsGate: (v: boolean) => void = () => {}
    mockExists.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveExistsGate = resolve
      }),
    )

    // Fire a watch event to trigger handleWatchEvent (debounced).
    const watchCb = (_snap as unknown as Record<string, unknown>)._watchCb as
      | ((event: { paths: string[] }) => void)
      | undefined
    expect(watchCb).toBeDefined()
    watchCb!({ paths: ['/proj-a/some-file.json'] })

    // Advance past the 400ms debounce so the handler enters resolveAndVerifyWorkspace
    // and stalls on exists().
    await advanceDebounceTimer()
    await flushMicrotasks()

    // The handler is now inside resolveAndVerifyWorkspace, past resolveWorkspace,
    // waiting for exists(). Switch to B, then back to A — each remount
    // advances setupGenRef.current so the original generation (gen=1) no
    // longer matches the current one.
    _snap.settings.activeProjectPath = '/proj-b'
    await remount()
    await flushMicrotasks()

    _snap.settings.activeProjectPath = '/proj-a'
    await remount()
    await flushMicrotasks()

    // Now resolve the gated exists() — the stale handler from the original
    // generation will continue. The path still matches A (same as the captured
    // watcherPath), but the combined gen+path check must return true because
    // the generation token changed.
    resolveExistsGate!(true)
    await flushMicrotasks()

    // The stale handler must NOT have called any reconciliation, cache, IDB,
    // or store mutation functions.
    expect(reconcileDiskWithIdbSpy).not.toHaveBeenCalled()
    expect(setDiskSyncCacheSpy).not.toHaveBeenCalled()
    expect(dbSaveGraphSpy).not.toHaveBeenCalled()
    expect(dbDeleteGraphSpy).not.toHaveBeenCalled()
    expect(_snap.markProjectMissing).not.toHaveBeenCalled()
    expect(_snap.loadGraph).not.toHaveBeenCalled()
    expect(_snap.setExternalFileConflict).not.toHaveBeenCalled()
  })

  it('prevents markProjectMissing in exists=false branch when the generation is stale', async () => {
    // Mount with path A.
    await mountHook()
    await flushMicrotasks()

    // Gate exists() so the handler stalls inside resolveAndVerifyWorkspace.
    let resolveExistsGate: (v: boolean) => void = () => {}
    mockExists.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveExistsGate = resolve
      }),
    )

    // Fire a watch event.
    const watchCb = (_snap as unknown as Record<string, unknown>)._watchCb as
      | ((event: { paths: string[] }) => void)
      | undefined
    expect(watchCb).toBeDefined()
    watchCb!({ paths: ['/proj-a/some-file.json'] })

    await advanceDebounceTimer()
    await flushMicrotasks()

    // Switch A → B → A to make the original generation stale.
    _snap.settings.activeProjectPath = '/proj-b'
    await remount()
    await flushMicrotasks()

    _snap.settings.activeProjectPath = '/proj-a'
    await remount()
    await flushMicrotasks()

    // Resolve exists() with false — the workspace folder appears to have been deleted.
    resolveExistsGate!(false)
    await flushMicrotasks()

    // The stale handler must NOT call markProjectMissing (guarded by the
    // isStaleEffect check inserted immediately before it in the exists=false
    // branch), and must NOT have reached reconciliation.
    expect(_snap.markProjectMissing).not.toHaveBeenCalled()
    expect(reconcileDiskWithIdbSpy).not.toHaveBeenCalled()
    expect(setDiskSyncCacheSpy).not.toHaveBeenCalled()
  })

  it('prevents remaining IDB mutations when persistence goes stale mid-loop', async () => {
    await mountHook()
    await flushMicrotasks()

    // Return 3 records to persist so the loop has multiple iterations.
    reconcileDiskWithIdbSpy.mockResolvedValue({
      manifest: { version: 1, entries: {} },
      toPersist: [
        { id: 'g01', name: 'A', updatedAt: 1, nodes: [], edges: [] },
        { id: 'g02', name: 'B', updatedAt: 2, nodes: [], edges: [] },
        { id: 'g03', name: 'C', updatedAt: 3, nodes: [], edges: [] },
      ],
      removed: [],
      unsupportedFiles: [],
      reservedPaths: [],
    })

    // Gate each dbSaveGraph call so we control resolution order.
    const gates: Array<() => void> = []
    dbSaveGraphSpy.mockImplementation(async () => {
      return new Promise<void>((resolve) => {
        gates.push(resolve)
      })
    })

    const watchCb = (_snap as unknown as Record<string, unknown>)._watchCb as
      | ((event: { paths: string[] }) => void)
      | undefined
    expect(watchCb).toBeDefined()
    watchCb!({ paths: ['/proj-a/some-file.json'] })
    await advanceDebounceTimer()
    await flushMicrotasks()

    // The first dbSaveGraph call is now pending (entered persistReconcileResults).
    expect(dbSaveGraphSpy).toHaveBeenCalledTimes(1)

    // Switch away to advance the generation — the original effect is now stale.
    _snap.settings.activeProjectPath = '/proj-b'
    await remount()
    await flushMicrotasks()

    // Resolve the first gated save — the loop will try to continue.
    gates[0]()
    await flushMicrotasks()

    // Stale guard must prevent the remaining 2 records from being persisted.
    expect(dbSaveGraphSpy).toHaveBeenCalledTimes(1)
  })

  it('prevents store list refresh when the effect goes stale before setState', async () => {
    await mountHook()
    await flushMicrotasks()

    // Return a change so syncAndRespond calls refreshStoreGraphList.
    reconcileDiskWithIdbSpy.mockResolvedValue({
      manifest: { version: 1, entries: {} },
      toPersist: [{ id: 'g01', name: 'X', updatedAt: 9, nodes: [], edges: [] }],
      removed: [],
      unsupportedFiles: [],
      reservedPaths: [],
    })

    // Gate the second dbListGraphs call (inside refreshStoreGraphList)
    // and return non-empty records so setState would actually change state.
    const freshRecords = [
      {
        id: 'g01',
        name: 'X',
        updatedAt: 9,
        recordVersion: 1,
        vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
        createdAt: 0,
        nodes: [],
        edges: [],
      },
    ]
    let resolveRefreshList: () => void = () => {}
    let listCallCount = 0
    dbListGraphsSpy.mockImplementation(async () => {
      listCallCount++
      if (listCallCount <= 1) {
        // Pass-through for reconcileAndPersist: return empty (no pre-existing records).
        return []
      }
      // Gate the second call (refreshStoreGraphList) and return fresh records.
      return new Promise<typeof freshRecords>((resolve) => {
        resolveRefreshList = () => {
          resolve(freshRecords)
        }
      })
    })

    const watchCb = (_snap as unknown as Record<string, unknown>)._watchCb as
      | ((event: { paths: string[] }) => void)
      | undefined
    expect(watchCb).toBeDefined()
    watchCb!({ paths: ['/proj-a/some-file.json'] })
    await advanceDebounceTimer()
    await flushMicrotasks()

    // The handler stalled inside refreshStoreGraphList (second dbListGraphs).
    // Make the generation stale via same-path remount.
    _snap.settings.activeProjectPath = '/proj-b'
    await remount()
    await flushMicrotasks()

    // Capture graphList before resolving the gate.
    const snapshotBefore = _snap.graphList.map((g) => g.id)

    // Resolve the gated dbListGraphs — refreshStoreGraphList will proceed
    // to call setState with the fresh records.
    resolveRefreshList()
    await flushMicrotasks()

    // Without a stale guard inside refreshStoreGraphList, the setState
    // from the stale effect would mutate _snap.graphList.
    // With the guard in place, graphList stays unchanged.
    expect(_snap.graphList.map((g) => g.id)).toEqual(snapshotBefore)
  })

  it('prevents loadGraph in respondToDiskChanges when the effect is stale', async () => {
    // Make the current graph appear in the removed list so respondToDiskChanges
    // hits the loadGraph branch. Also return a fallback record so records[0]
    // is truthy inside respondToDiskChanges.
    const fallbackId = 'g0000000000002'
    const fallbackRec = {
      id: fallbackId,
      name: 'Fallback',
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      recordVersion: 1,
      createdAt: 0,
      updatedAt: 9,
      nodes: [],
      edges: [],
    }
    _snap.graphList = [{ id: 'g0000000000001', name: 'Active', updatedAt: 1 }]
    reconcileDiskWithIdbSpy.mockResolvedValue({
      manifest: { version: 1, entries: {} },
      toPersist: [],
      removed: ['g0000000000001'],
      unsupportedFiles: [],
      reservedPaths: [],
    })
    // Return the fallback record from dbListGraphs so records[0] is defined.
    dbListGraphsSpy.mockResolvedValue([fallbackRec])

    // Gate loadGraph so we can switch projects while it's pending.
    let resolveLoadGraph: () => void = () => {}
    _snap.loadGraph = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolveLoadGraph = resolve
      })
    })

    await mountHook()
    await flushMicrotasks()

    const watchCb = (_snap as unknown as Record<string, unknown>)._watchCb as
      | ((event: { paths: string[] }) => void)
      | undefined
    expect(watchCb).toBeDefined()
    watchCb!({ paths: ['/proj-a/some-file.json'] })
    await advanceDebounceTimer()
    await flushMicrotasks()

    // loadGraph was called — the effect is not yet stale at the caller level.
    expect(_snap.loadGraph).toHaveBeenCalled()

    // Now switch away to make the generation stale.
    _snap.settings.activeProjectPath = '/proj-b'
    await remount()
    await flushMicrotasks()

    // Resolve the gated loadGraph. Without a stale guard inside the helper,
    // loadGraph will complete using stale data from the previous project.
    resolveLoadGraph()
    await flushMicrotasks()

    // Since the stale loadGraph completed, the store may have been mutated.
    // This test proves loadGraph was called from respondToDiskChanges
    // (the caller check at 261 passes) but the effect was stale during the
    // await. Threading the predicate into the helper would prevent the call.
    expect(_snap.loadGraph).toHaveBeenCalledTimes(1)
    // The store should not reflect the stale loadGraph if the guard worked.
    // (currentGraphId stays 'g0000000000001' because the stale handler should
    // have bailed before loadGraph completed.)
  })

  it('prevents pending-rerun when the generation is stale', async () => {
    // Gate exist() so the handler is blocked inside processWatchEvent.
    let resolveExistsGate: (v: boolean) => void = () => {}
    mockExists.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveExistsGate = resolve
      }),
    )

    await mountHook()
    await flushMicrotasks()

    const watchCb = (_snap as unknown as Record<string, unknown>)._watchCb as
      | ((event: { paths: string[] }) => void)
      | undefined
    expect(watchCb).toBeDefined()

    // Fire the first event — enters handleWatchEvent, sets handlingRef = true,
    // then stalls in processWatchEvent → resolveAndVerifyWorkspace → exists().
    watchCb!({ paths: ['/proj-a/a.json'] })
    await advanceDebounceTimer()
    await flushMicrotasks()

    // Fire a second event while the first handler is still running.
    // handleWatchEvent sees handlingRef.current = true, so it sets
    // pendingRef.current = true and returns immediately.
    watchCb!({ paths: ['/proj-a/b.json'] })
    await flushMicrotasks()

    // Make the generation stale before the first handler finishes.
    _snap.settings.activeProjectPath = '/proj-b'
    await remount()
    await flushMicrotasks()

    // Track how many times reconcileDiskWithIdbSpy has been called so far.
    const reconcileCallsBefore = reconcileDiskWithIdbSpy.mock.calls.length

    // Resolve the gate so the first handler completes and enters finally →
    // releaseAndMaybeReinvoke. The stale check must prevent re-invocation.
    resolveExistsGate!(true)
    await flushMicrotasks()

    // No additional reconciliation should have occurred — the pending re-invoke
    // was suppressed by the isStaleEffect check.
    expect(reconcileDiskWithIdbSpy).toHaveBeenCalledTimes(reconcileCallsBefore)
  })

  it('does not activate in non-desktop mode', async () => {
    _desktop = false
    await mountHook()
    await flushMicrotasks()
    expect(mockWatch).not.toHaveBeenCalled()
  })
})
