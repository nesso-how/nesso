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
import { graphDocumentJson } from '@/test/graphDocument'
import { dbClearGraphs, dbListGraphs, dbSaveGraph, type GraphRecord } from '@/store/db'

const SETTINGS = { activeProjectPath: '/proj' }

function gid(n: number): string {
  return `g${String(n).padStart(13, '0')}`
}

function record(id: string, name: string, updatedAt: number): GraphRecord {
  return { id, name, createdAt: updatedAt, updatedAt, nodes: [], edges: [] }
}

function writeDiskFile(filename: string, file: Parameters<typeof graphDocumentJson>[0]) {
  tauriFsState.writeFile(`/proj/${filename}`, graphDocumentJson(file))
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

  it('picks up a disk file with newer content', async () => {
    await dbSaveGraph(record(gid(1), 'Doc', 1000))
    tauriFsState.writeFile(
      '/proj/Doc.json',
      graphDocumentJson({
        id: gid(1),
        name: 'Doc',
        updatedAt: 5000,
        concepts: [{ id: 'n1', label: 'fresh edit', x: 0, y: 0 }],
      }),
    )

    await persistWorkspaceSync(SETTINGS, await dbListGraphs())

    const [stored] = await dbListGraphs()
    expect(stored.updatedAt).toBe(5000)
    expect(stored.nodes).toHaveLength(1)
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

  it('picks up a disk edit with an equal timestamp but different content', async () => {
    await dbSaveGraph(record(gid(1), 'Doc', 1000))
    tauriFsState.writeFile(
      '/proj/Doc.json',
      graphDocumentJson({
        id: gid(1),
        name: 'Doc',
        updatedAt: 1000,
        concepts: [{ id: 'n1', label: 'hi', x: 0, y: 0 }],
      }),
    )

    await persistWorkspaceSync(SETTINGS, await dbListGraphs())

    const [stored] = await dbListGraphs()
    expect(stored.nodes).toHaveLength(1)
  })

  it('ignores a disk file whose content is unchanged despite a newer timestamp', async () => {
    await dbSaveGraph(record(gid(1), 'Doc', 1000))
    // Same empty content, just a bumped timestamp
    writeDiskFile('Doc.json', { id: gid(1), name: 'Doc', updatedAt: 5000 })

    await persistWorkspaceSync(SETTINGS, await dbListGraphs())

    const [stored] = await dbListGraphs()
    // Content is unchanged — the record should NOT have been pushed to toPersist,
    // so IDB keeps the original updatedAt (1000).
    expect(stored.updatedAt).toBe(1000)
  })
})

describe('disk id and name resolution', () => {
  it('gives a duplicated file embedding an already-claimed id a fresh id', async () => {
    writeDiskFile('Orig.json', { id: gid(1), name: 'Orig', updatedAt: 1000 })
    writeDiskFile('Copy.json', { id: gid(1), name: 'Copy', updatedAt: 1000 })

    const list = await loadProjectFromDisk(await ws())

    expect(list).toHaveLength(2)
    const ids = new Set(list.map((r) => r.id))
    expect(ids.size).toBe(2)
    expect(ids.has(gid(1))).toBe(true)
  })

  it('lets the filename win over a stale JSON name and rewrites the file', async () => {
    writeDiskFile('Real.json', { id: gid(1), name: 'StaleName', updatedAt: 1000 })

    const list = await loadProjectFromDisk(await ws())

    expect(list.map((r) => r.name)).toEqual(['Real'])
    expect(JSON.parse(tauriFsState.files.get('/proj/Real.json')!).name).toBe('Real')
  })

  it('assigns a fresh id to a file whose embedded id is invalid', async () => {
    writeDiskFile('X.json', { id: 'not-a-valid-id', name: 'X', updatedAt: 1000 })

    const [rec] = await loadProjectFromDisk(await ws())

    expect(rec.id).not.toBe('not-a-valid-id')
    expect(rec.name).toBe('X')
  })

  it('binds the file to the manifest id over the JSON id', async () => {
    writeDiskFile('Bound.json', { id: gid(9), name: 'Bound', updatedAt: 1000 })
    writeDiskManifest({ [gid(1)]: { ...record(gid(1), 'Bound', 1000), file: 'Bound.json' } })

    const [rec] = await loadProjectFromDisk(await ws())

    expect(rec.id).toBe(gid(1))
  })

  it('picks up a disk rename (same id and timestamp) over the IDB name', async () => {
    await dbSaveGraph(record(gid(1), 'Old', 1000))
    writeDiskFile('New.json', { id: gid(1), name: 'New', updatedAt: 1000 })

    await persistWorkspaceSync(SETTINGS, await dbListGraphs())

    const [stored] = await dbListGraphs()
    expect(stored.name).toBe('New')
  })

  it('writes the manifest binding for a freshly loaded disk file', async () => {
    writeDiskFile('A.json', { id: gid(1), name: 'A', updatedAt: 1000 })

    await loadProjectFromDisk(await ws())

    const manifest = JSON.parse(tauriFsState.files.get('/proj/.nesso/manifest.json')!)
    expect(manifest.entries[gid(1)]).toMatchObject({ file: 'A.json', name: 'A' })
  })
})
