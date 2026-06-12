// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { tauriFsState } from '@/test/fakeTauriFs'

vi.mock('@tauri-apps/plugin-fs', async () => (await import('@/test/fakeTauriFs')).fakeFsPlugin)
vi.mock('@tauri-apps/api/path', async () => (await import('@/test/fakeTauriFs')).fakePathApi)
vi.mock('@tauri-apps/api/core', async () => (await import('@/test/fakeTauriFs')).fakeCoreApi)
vi.mock('@tauri-apps/plugin-dialog', async () => (await import('@/test/fakeTauriFs')).fakeDialogApi)

import { setDiskSyncCache } from '@/lib/workspace/manifest'
import { dbClearGraphs, dbListGraphs, dbLoadGraph } from '@/store/db'
import type { GraphState } from '../state'
import { createDesktopSyncSlice } from './desktop-sync'
import { createGraphEditingSlice } from './graph-editing'
import { createGraphManagementSlice } from './graph-management'
import { createSettingsSlice } from './settings'
import { createUISlice } from './ui'

// Desktop mode: `__TAURI_INTERNALS__` on window flips `isDesktop()` true, so the
// store drives the real workspace layer (disk is the source of truth) against the
// in-memory fake fs + fake-indexeddb.
const DEFAULT_WS = '/appdata/graphs'

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

function gid(n: number): string {
  return `g${String(n).padStart(13, '0')}`
}

/** Mirror app startup: seed the default project, then load the active graph. */
async function boot(): Promise<Store> {
  const s = makeStore()
  await s.getState().loadGraphList()
  await s.getState().loadGraph(s.getState().currentGraphId)
  return s
}

beforeEach(async () => {
  tauriFsState.reset()
  await dbClearGraphs()
  setDiskSyncCache('', { version: 1, entries: {} })
  ;(window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
})

describe('loadGraphList (desktop)', () => {
  it('resolves the default project and writes the seeded graphs to disk', async () => {
    const s = makeStore()
    const list = await s.getState().loadGraphList()

    expect(list.length).toBeGreaterThan(0)
    expect(s.getState().settings.activeProjectPath).toBe(DEFAULT_WS)
    const wroteSeed = [...tauriFsState.files.keys()].some(
      (p) => p.startsWith(`${DEFAULT_WS}/`) && p.endsWith('.json'),
    )
    expect(wroteSeed).toBe(true)
  })
})

describe('createProject', () => {
  it('creates the folder, switches to it, and seeds one empty graph on disk', async () => {
    const s = await boot()
    tauriFsState.setDialogResult('/newproj')

    await s.getState().createProject()

    expect(s.getState().settings.activeProjectPath).toBe('/newproj')
    expect(s.getState().settings.knownProjects).toContain('/newproj')
    const list = s.getState().graphList
    expect(list).toHaveLength(1)
    expect(tauriFsState.files.has(`/newproj/${list[0].name}.json`)).toBe(true)
  })
})

describe('switchProject', () => {
  it('loads the graphs already present in the target folder', async () => {
    const s = await boot()
    tauriFsState.dirs.add('/other')
    tauriFsState.writeFile(
      '/other/Imported.json',
      JSON.stringify({ id: gid(1), name: 'Imported', updatedAt: 1000, nodes: [], edges: [] }),
    )

    await s.getState().switchProject('/other')

    expect(s.getState().settings.activeProjectPath).toBe('/other')
    expect(s.getState().graphList.map((g) => g.name)).toEqual(['Imported'])
    expect((await dbLoadGraph(gid(1)))?.name).toBe('Imported')
  })
})

describe('deleteGraph (desktop)', () => {
  it('removes the graph file from disk', async () => {
    const s = await boot()
    const id = await s.getState().createGraph('ToDelete')
    expect(tauriFsState.files.has(`${DEFAULT_WS}/ToDelete.json`)).toBe(true)

    await s.getState().deleteGraph(id)

    expect(tauriFsState.files.has(`${DEFAULT_WS}/ToDelete.json`)).toBe(false)
    expect(await dbLoadGraph(id)).toBeUndefined()
  })
})

describe('renameGraph (desktop)', () => {
  it('relocates the file on disk to follow the new name', async () => {
    const s = await boot()
    const id = await s.getState().createGraph('OldName')

    await s.getState().renameGraph(id, 'NewName')

    expect(tauriFsState.files.has(`${DEFAULT_WS}/NewName.json`)).toBe(true)
    expect(tauriFsState.files.has(`${DEFAULT_WS}/OldName.json`)).toBe(false)
    expect((await dbLoadGraph(id))?.name).toBe('NewName')
  })
})

describe('reloadActiveGraphFromDisk', () => {
  it('replaces in-memory state with an externally edited file', async () => {
    const s = await boot()
    const id = await s.getState().createGraph('Doc')
    expect(s.getState().nodes).toHaveLength(0)

    tauriFsState.writeFile(
      `${DEFAULT_WS}/Doc.json`,
      JSON.stringify({
        id,
        name: 'Doc',
        updatedAt: 9_999_999_999,
        nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { text: 'external' } }],
        edges: [],
      }),
    )

    await s.getState().reloadActiveGraphFromDisk()

    expect(s.getState().nodes).toHaveLength(1)
    expect(s.getState().nodes[0].data.text).toBe('external')
  })
})

describe('keepLocalGraphChanges', () => {
  it('clears the conflict flag and persists current state', async () => {
    const s = await boot()
    await s.getState().createGraph('Local')
    s.getState().setExternalFileConflict(true)
    s.getState().addNode()

    await s.getState().keepLocalGraphChanges()

    expect(s.getState().externalFileConflict).toBe(false)
    const list = await dbListGraphs()
    const stored = list.find((r) => r.id === s.getState().currentGraphId)
    expect(stored?.nodes).toHaveLength(1)
  })
})
