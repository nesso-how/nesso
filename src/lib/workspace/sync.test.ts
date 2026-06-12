// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tauriFsState } from '@/test/fakeTauriFs'

// Workspace logic (sync, graphFiles, manifest) runs for real against an
// in-memory filesystem; only the Tauri boundary is mocked. These are true
// integration tests of the disk<->IndexedDB merge.
vi.mock('@tauri-apps/plugin-fs', async () => (await import('@/test/fakeTauriFs')).fakeFsPlugin)
vi.mock('@tauri-apps/api/path', async () => (await import('@/test/fakeTauriFs')).fakePathApi)
vi.mock('@tauri-apps/api/core', async () => (await import('@/test/fakeTauriFs')).fakeCoreApi)

import { resolveWorkspace } from '@/lib/workspace/paths'
import { setDiskSyncCache } from '@/lib/workspace/manifest'
import { loadProjectFromDisk, persistWorkspaceSync } from '@/lib/workspace/sync'
import { dbClearGraphs, dbListGraphs, dbSaveGraph, type GraphRecord } from '@/store/db'

const SETTINGS = { activeProjectPath: '/proj' }

function gid(n: number): string {
  return `g${String(n).padStart(13, '0')}`
}

function record(id: string, name: string, updatedAt: number): GraphRecord {
  return { id, name, createdAt: updatedAt, updatedAt, nodes: [], edges: [] }
}

function writeDiskFile(filename: string, file: { id?: string; name: string; updatedAt?: number }) {
  tauriFsState.writeFile(`/proj/${filename}`, JSON.stringify({ ...file, nodes: [], edges: [] }))
}

function writeDiskManifest(entries: Record<string, GraphRecord & { file: string }>) {
  const manifestEntries: Record<string, unknown> = {}
  for (const [id, e] of Object.entries(entries)) {
    manifestEntries[id] = { id, file: e.file, name: e.name, updatedAt: e.updatedAt }
  }
  tauriFsState.writeFile(
    '/proj/.nesso/manifest.json',
    JSON.stringify({ version: 1, entries: manifestEntries }),
  )
}

async function ws() {
  return resolveWorkspace(SETTINGS)
}

beforeEach(async () => {
  tauriFsState.reset()
  await dbClearGraphs()
  setDiskSyncCache('', { version: 1, entries: {} })
})

describe('loadProjectFromDisk', () => {
  it('imports every on-disk graph file into IndexedDB', async () => {
    writeDiskFile('Alpha.json', { id: gid(1), name: 'Alpha', updatedAt: 1000 })
    writeDiskFile('Beta.json', { id: gid(2), name: 'Beta', updatedAt: 2000 })

    const list = await loadProjectFromDisk(await ws())

    expect(list.map((r) => r.name).sort()).toEqual(['Alpha', 'Beta'])
    const inDb = await dbListGraphs()
    expect(inDb.map((r) => r.id).sort()).toEqual([gid(1), gid(2)])
  })
})

describe('persistWorkspaceSync', () => {
  it('writes an IDB-only record out to disk and tracks it in the manifest', async () => {
    await dbSaveGraph(record(gid(1), 'Solo', 1000))

    await persistWorkspaceSync(SETTINGS, await dbListGraphs())

    expect(tauriFsState.files.has('/proj/Solo.json')).toBe(true)
    const manifest = JSON.parse(tauriFsState.files.get('/proj/.nesso/manifest.json')!)
    expect(manifest.entries[gid(1)]).toMatchObject({ file: 'Solo.json', name: 'Solo' })
  })

  it('picks up a disk file that is newer than its IndexedDB copy', async () => {
    await dbSaveGraph(record(gid(1), 'Doc', 1000))
    writeDiskFile('Doc.json', { id: gid(1), name: 'Doc', updatedAt: 5000 })

    await persistWorkspaceSync(SETTINGS, await dbListGraphs())

    const [stored] = await dbListGraphs()
    expect(stored.updatedAt).toBe(5000)
  })

  it('drops a tracked graph whose file was deleted outside the app', async () => {
    await dbSaveGraph(record(gid(1), 'Gone', 1000))
    writeDiskManifest({ [gid(1)]: { ...record(gid(1), 'Gone', 1000), file: 'Gone.json' } })

    const list = await persistWorkspaceSync(SETTINGS, await dbListGraphs())

    expect(list).toHaveLength(0)
    expect(await dbListGraphs()).toHaveLength(0)
  })

  it('de-duplicates a disk graph whose name collides with an IDB peer', async () => {
    await dbSaveGraph(record(gid(1), 'Foo', 1000))
    writeDiskFile('Foo.json', { id: gid(2), name: 'Foo', updatedAt: 1000 })

    const list = await persistWorkspaceSync(SETTINGS, await dbListGraphs())

    expect(list.map((r) => r.name).sort()).toEqual(['Foo', 'Foo-2'])
    // The renamed graph's file follows its de-duplicated name.
    expect(tauriFsState.files.has('/proj/Foo-2.json')).toBe(true)
  })
})
