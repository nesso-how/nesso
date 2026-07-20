// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { tauriFsState, seedTrustedPath } from '@/test/fakeTauriFs'

vi.mock('@tauri-apps/plugin-fs', async () => (await import('@/test/fakeTauriFs')).fakeFsPlugin)
vi.mock('@tauri-apps/api/path', async () => (await import('@/test/fakeTauriFs')).fakePathApi)
vi.mock('@tauri-apps/api/core', async () => (await import('@/test/fakeTauriFs')).fakeCoreApi)

import { setDiskSyncCache } from '@/lib/workspace/manifest'
import { graphDocumentJson } from '@/test/graphDocument'
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
  seedTrustedPath(DEFAULT_WS)
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

describe('openOrCreateProject', () => {
  it('switches to the picked folder and seeds one empty graph on disk', async () => {
    const s = await boot()
    tauriFsState.dirs.add('/newproj')
    tauriFsState.setDialogResult('/newproj')

    await s.getState().openOrCreateProject()

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
      graphDocumentJson({ id: gid(1), name: 'Imported', updatedAt: 1000 }),
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
      graphDocumentJson({
        id,
        name: 'Doc',
        updatedAt: 9_999_999_999,
        concepts: [{ id: 'n1', label: 'external', x: 0, y: 0 }],
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

describe('switchProject branches', () => {
  it('returns early when switching to the already-active project', async () => {
    const s = await boot()
    const list = await s.getState().switchProject(DEFAULT_WS)
    expect(list).toEqual(s.getState().graphList)
    expect(s.getState().settings.activeProjectPath).toBe(DEFAULT_WS)
  })

  it('flags a vanished target folder missing instead of loading it', async () => {
    const s = await boot()
    s.getState().setSetting('knownProjects', ['/gone', DEFAULT_WS])

    await s.getState().switchProject('/gone')

    expect(s.getState().missingProjects).toContain('/gone')
    expect(s.getState().settings.activeProjectPath).toBe(DEFAULT_WS)
  })

  it('clears a stale missing flag once the folder is present again', async () => {
    const s = await boot()
    s.getState().setSetting('knownProjects', ['/back', DEFAULT_WS])
    await s.getState().switchProject('/back')
    expect(s.getState().missingProjects).toContain('/back')

    tauriFsState.dirs.add('/back')
    await s.getState().switchProject('/back')

    expect(s.getState().missingProjects).not.toContain('/back')
    expect(s.getState().settings.activeProjectPath).toBe('/back')
  })

  it('seeds one empty graph when switching into an empty folder', async () => {
    const s = await boot()
    tauriFsState.dirs.add('/empty')

    await s.getState().switchProject('/empty')

    expect(s.getState().settings.activeProjectPath).toBe('/empty')
    expect(s.getState().graphList).toHaveLength(1)
  })

  it('names the seeded empty-folder graph in Italian when language is it', async () => {
    const s = await boot()
    s.getState().setSetting('language', 'it')
    tauriFsState.dirs.add('/emptyit')

    await s.getState().switchProject('/emptyit')

    expect(s.getState().graphList[0].name).toBe('Senza titolo')
  })

  it('shows an Italian toast for a vanished folder when language is it', async () => {
    const s = await boot()
    s.getState().setSetting('language', 'it')
    s.getState().setSetting('knownProjects', ['/goneit', DEFAULT_WS])

    await s.getState().switchProject('/goneit')

    const toast = s.getState().toasts.find((t) => t.id === 'project-missing:/goneit')
    expect(toast?.message).toMatch(/non trovata/)
  })

  it('loads the most recently updated graph in the target folder', async () => {
    const s = await boot()
    tauriFsState.dirs.add('/two')
    tauriFsState.writeFile(
      '/two/Old.json',
      graphDocumentJson({ id: gid(1), name: 'Old', updatedAt: 1000 }),
    )
    tauriFsState.writeFile(
      '/two/New.json',
      graphDocumentJson({ id: gid(2), name: 'New', updatedAt: 5000 }),
    )

    await s.getState().switchProject('/two')

    expect(s.getState().currentGraphId).toBe(gid(2))
  })
})

describe('loadGraphList (desktop) missing projects at startup', () => {
  it('flags a known project whose folder is absent', async () => {
    const s = makeStore()
    s.getState().setSetting('knownProjects', ['/ghost', DEFAULT_WS])
    s.getState().setSetting('activeProjectPath', DEFAULT_WS)

    await s.getState().loadGraphList()

    expect(s.getState().missingProjects).toContain('/ghost')
    expect(s.getState().settings.knownProjects).toContain('/ghost')
  })

  it('moves off an active project whose folder vanished', async () => {
    const s = makeStore()
    s.getState().setSetting('knownProjects', ['/ghost', DEFAULT_WS])
    s.getState().setSetting('activeProjectPath', '/ghost')

    await s.getState().loadGraphList()

    expect(s.getState().missingProjects).toContain('/ghost')
    expect(s.getState().settings.activeProjectPath).toBe(DEFAULT_WS)
  })
})

describe('markProjectMissing', () => {
  it('flags a non-active project and keeps it in the list', async () => {
    const s = await boot()
    s.getState().setSetting('knownProjects', ['/p2', DEFAULT_WS])

    await s.getState().markProjectMissing('/p2')

    expect(s.getState().missingProjects).toContain('/p2')
    expect(s.getState().settings.knownProjects).toContain('/p2')
    expect(s.getState().settings.activeProjectPath).toBe(DEFAULT_WS)
  })

  it('switches away when the active project is flagged missing', async () => {
    const s = await boot()
    tauriFsState.dirs.add('/p2')
    tauriFsState.setDialogResult('/p2')
    await s.getState().openOrCreateProject()
    expect(s.getState().settings.activeProjectPath).toBe('/p2')

    await s.getState().markProjectMissing('/p2')

    expect(s.getState().missingProjects).toContain('/p2')
    expect(s.getState().settings.activeProjectPath).toBe(DEFAULT_WS)
  })

  it('never flags the bundled default workspace', async () => {
    const s = await boot()
    const before = s.getState().graphList
    expect(await s.getState().markProjectMissing(DEFAULT_WS)).toEqual(before)
    expect(s.getState().missingProjects).not.toContain(DEFAULT_WS)
  })
})

describe('removeProject', () => {
  it('removes a non-active project from the list', async () => {
    const s = await boot()
    tauriFsState.dirs.add('/p2')
    tauriFsState.setDialogResult('/p2')
    await s.getState().openOrCreateProject()
    await s.getState().switchProject(DEFAULT_WS)

    await s.getState().removeProject('/p2')

    expect(s.getState().settings.knownProjects).not.toContain('/p2')
  })

  it('switches away when removing the active project', async () => {
    const s = await boot()
    tauriFsState.dirs.add('/p2')
    tauriFsState.setDialogResult('/p2')
    await s.getState().openOrCreateProject()

    await s.getState().removeProject('/p2')

    expect(s.getState().settings.knownProjects).not.toContain('/p2')
    expect(s.getState().settings.activeProjectPath).toBe(DEFAULT_WS)
  })

  it('refuses to remove the last remaining project', async () => {
    const s = await boot()
    const before = s.getState().settings.knownProjects
    await s.getState().removeProject(DEFAULT_WS)
    expect(s.getState().settings.knownProjects).toEqual(before)
  })

  it('ignores a path that is not in the list', async () => {
    const s = await boot()
    const before = s.getState().settings.knownProjects
    await s.getState().removeProject('/unknown')
    expect(s.getState().settings.knownProjects).toEqual(before)
  })
})

describe('openOrCreateProject', () => {
  it('switches to the picked folder', async () => {
    const s = await boot()
    tauriFsState.dirs.add('/picked')
    tauriFsState.setDialogResult('/picked')

    await s.getState().openOrCreateProject()

    expect(s.getState().settings.activeProjectPath).toBe('/picked')
    expect(s.getState().settings.knownProjects).toContain('/picked')
  })

  it('is a no-op when cancelled', async () => {
    const s = await boot()
    tauriFsState.setDialogResult(null)
    const before = s.getState().settings.activeProjectPath

    await s.getState().openOrCreateProject()

    expect(s.getState().settings.activeProjectPath).toBe(before)
  })
})
