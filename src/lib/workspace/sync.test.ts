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
import { setDiskSyncCache, getDiskSyncCache } from '@/lib/workspace/manifest'
import {
  checkWorkspaceCompatibility,
  loadProjectFromDisk,
  persistWorkspaceSync,
} from '@/lib/workspace/sync'
import { graphDocumentJson } from '@/test/graphDocument'
import { dbClearGraphs, dbListGraphs, dbSaveGraph, type GraphRecord } from '@/store/db'

const SETTINGS = { activeProjectPath: '/proj' }

function gid(n: number): string {
  return `g${String(n).padStart(13, '0')}`
}

function record(id: string, name: string, updatedAt: number): GraphRecord {
  return {
    recordVersion: 1,
    vocabulary: {
      id: '@nesso-how/vocab-learning',
      version: '0.1.0',
    },
    id,
    name,
    createdAt: updatedAt,
    updatedAt,
    nodes: [],
    edges: [],
  }
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

    const { records: list } = await loadProjectFromDisk(await ws())

    expect(list.map((r) => r.name).sort()).toEqual(['Alpha', 'Beta'])
    const inDb = await dbListGraphs()
    expect(inDb.map((r) => r.id).sort()).toEqual([gid(1), gid(2)])
  })

  it('tracks unsupported files separately from valid records', async () => {
    // Write a file with a foreign vocabulary — should be unsupported but not crash.
    tauriFsState.writeFile(
      '/proj/Foreign.json',
      JSON.stringify({
        version: 1,
        vocabulary: { id: '@other/vocab', version: '1.0.0' },
        name: 'Foreign',
        concepts: [],
        relations: [],
      }),
    )
    writeDiskFile('Valid.json', { id: gid(1), name: 'Valid', updatedAt: 1000 })

    const result = await loadProjectFromDisk(await ws())

    expect(result.records).toHaveLength(1)
    expect(result.records[0].name).toBe('Valid')
    expect(result.unsupportedFiles).toHaveLength(1)
    expect(result.unsupportedFiles[0]).toBe('Foreign.json')
  })
})

describe('persistWorkspaceSync corrupt isolation', () => {
  it('returns valid records and skips a corrupt IDB row instead of aborting the sync', async () => {
    // Seed a valid record in IDB.
    await dbSaveGraph(record(gid(1), 'Valid', 1000))
    // Seed a corrupt record (missing recordVersion) that will fail normalization.
    const corruptId = 'corrupt-sync'
    await dbSaveGraph({
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      id: corruptId,
      name: 'Corrupt',
      createdAt: 1,
      updatedAt: 1,
      nodes: [],
      edges: [],
    } as unknown as GraphRecord)

    // persistWorkspaceSync must not throw when one IDB record is corrupt.
    // It should return the valid record and skip the corrupt one.
    const list = await persistWorkspaceSync(SETTINGS, await dbListGraphs())

    // Valid record is in the result.
    expect(list.some((r) => r.id === gid(1))).toBe(true)
    // Corrupt record is skipped — not present in the normalized list.
    expect(list.some((r) => r.id === corruptId)).toBe(false)

    // The corrupt record is preserved in IDB (not deleted).
    const remaining = await dbListGraphs()
    expect(remaining.some((r) => r.id === corruptId)).toBe(true)
    expect(remaining.some((r) => r.id === gid(1))).toBe(true)
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

    const { records: list } = await loadProjectFromDisk(await ws())

    expect(list).toHaveLength(2)
    const ids = new Set(list.map((r) => r.id))
    expect(ids.size).toBe(2)
    expect(ids.has(gid(1))).toBe(true)
  })

  it('lets the filename win over a stale JSON name and rewrites the file', async () => {
    writeDiskFile('Real.json', { id: gid(1), name: 'StaleName', updatedAt: 1000 })

    const { records: list } = await loadProjectFromDisk(await ws())

    expect(list.map((r) => r.name)).toEqual(['Real'])
    expect(JSON.parse(tauriFsState.files.get('/proj/Real.json')!).name).toBe('Real')
  })

  it('assigns a fresh id to a file whose embedded id is invalid', async () => {
    writeDiskFile('X.json', { id: 'not-a-valid-id', name: 'X', updatedAt: 1000 })

    const { records } = await loadProjectFromDisk(await ws())
    const rec = records[0]

    expect(rec.id).not.toBe('not-a-valid-id')
    expect(rec.name).toBe('X')
  })

  it('binds the file to the manifest id over the JSON id', async () => {
    writeDiskFile('Bound.json', { id: gid(9), name: 'Bound', updatedAt: 1000 })
    writeDiskManifest({ [gid(1)]: { ...record(gid(1), 'Bound', 1000), file: 'Bound.json' } })

    const { records } = await loadProjectFromDisk(await ws())
    const rec = records[0]

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

describe('unsupported path reservation', () => {
  it('collects unsupported filenames in the reconcile result', async () => {
    // Write an unsupported file (foreign vocabulary)
    tauriFsState.writeFile(
      '/proj/Foreign.json',
      JSON.stringify({
        version: 1,
        vocabulary: { id: '@other/vocab', version: '1.0.0' },
        name: 'Foreign',
        concepts: [],
        relations: [],
      }),
    )
    writeDiskFile('Valid.json', { id: gid(1), name: 'Valid', updatedAt: 1000 })

    const result = await loadProjectFromDisk(await ws())

    expect(result.records).toHaveLength(1)
    expect(result.unsupportedFiles).toEqual(['Foreign.json'])
    // reconcileDiskWithIdb returns reservedPaths — loadProjectFromDisk
    // (and persistWorkspaceSync) persist them in the disk-sync cache so
    // subsequent save operations avoid overwriting unsupported files.
    const cache = getDiskSyncCache()
    expect(cache.reservedPaths).toEqual(['Foreign.json'])
  })

  it('does not overwrite a reserved unsupported file when flushing IDB records to disk', async () => {
    // IDB has a record that would get written to disk with the same filename
    // as an unsupported file. The unsupported file must be preserved.
    await dbSaveGraph(record(gid(1), 'Foreign', 1000))

    // Write an unsupported file with the SAME name — it exists on disk but
    // cannot be loaded. The IDB sync must NOT overwrite it.
    tauriFsState.writeFile(
      '/proj/Foreign.json',
      JSON.stringify({
        version: 1,
        vocabulary: { id: '@other/vocab', version: '1.0.0' },
        name: 'Foreign',
        concepts: [],
        relations: [],
      }),
    )

    // persistWorkspaceSync must not overwrite the unsupported file.
    await persistWorkspaceSync(SETTINGS, await dbListGraphs())

    // The unsupported file's content is still intact.
    const raw = tauriFsState.files.get('/proj/Foreign.json')!
    const parsed = JSON.parse(raw)
    expect(parsed.vocabulary.id).toBe('@other/vocab')

    // The IDB record got persisted (not lost).
    const idbRecords = await dbListGraphs()
    expect(idbRecords).toHaveLength(1)
    // The unsupported file was NOT overwritten — the IDB record was named differently.
    expect(raw).not.toContain('"@nesso-how/vocab-learning"')
  })

  it('does not rename a manifest-bound reserved unsupported file when an IDB record is newer', async () => {
    // Scenario: a manifest entry points to an unsupported file on disk.
    // The IDB has a newer version of that graph (updatedAt > manifest entry).
    // The sync's else-if branch fires and calls saveGraphToDisk WITHOUT
    // reservedPaths. The unsupported file must be preserved at its path.

    // Write an unsupported file that the manifest will bind to.
    tauriFsState.writeFile(
      '/proj/Collision.json',
      JSON.stringify({
        version: 1,
        vocabulary: { id: '@other/vocab', version: '1.0.0' },
        name: 'Collision',
        concepts: [],
        relations: [],
      }),
    )

    // Manifest entry pointing to the unsupported file.
    writeDiskManifest({
      [gid(1)]: {
        ...record(gid(1), 'SomeOldName', 1000),
        file: 'Collision.json',
      },
    })

    // IDB record with a newer updatedAt — the else-if branch needs this.
    await dbSaveGraph(record(gid(1), 'SomeNewerName', 5000))

    await persistWorkspaceSync(SETTINGS, await dbListGraphs())

    // The unsupported file must NOT be renamed/overwritten.
    const raw = tauriFsState.files.get('/proj/Collision.json')!
    expect(JSON.parse(raw).vocabulary.id).toBe('@other/vocab')

    // The IDB record must have been persisted (not lost during sync).
    const idbRecords = await dbListGraphs()
    expect(idbRecords.some((r) => r.id === gid(1))).toBe(true)

    // The manifest entry must NOT still point to the reserved file (it was
    // rebound to a fresh filename).
    const manifest = JSON.parse(tauriFsState.files.get('/proj/.nesso/manifest.json')!)
    expect(manifest.entries[gid(1)].file).not.toBe('Collision.json')
  })
})

describe('checkWorkspaceCompatibility', () => {
  it('returns empty when there are no graph files', async () => {
    const result = await checkWorkspaceCompatibility(await ws())
    expect(result.status).toBe('empty')
    expect(result.unsupportedCount).toBe(0)
  })

  it('returns compatible when there are valid files', async () => {
    writeDiskFile('Valid.json', { id: gid(1), name: 'Valid', updatedAt: 1000 })
    const result = await checkWorkspaceCompatibility(await ws())
    expect(result.status).toBe('compatible')
    expect(result.unsupportedCount).toBe(0)
  })

  it('returns unsupported-only when all files have a foreign vocabulary', async () => {
    tauriFsState.writeFile(
      '/proj/Foreign.json',
      JSON.stringify({
        version: 1,
        vocabulary: { id: '@other/vocab', version: '1.0.0' },
        name: 'Foreign',
        concepts: [],
        relations: [],
      }),
    )
    const result = await checkWorkspaceCompatibility(await ws())
    expect(result.status).toBe('unsupported-only')
    expect(result.unsupportedCount).toBe(1)
  })

  it('detects a malformed-content file that passes the envelope check as unsupported', async () => {
    // A file with valid vocabulary header but corrupted content (removed
    // alpha elaboration field). The envelope check passes but full
    // normalization fails — the preflight must classify it as unsupported.
    tauriFsState.writeFile(
      '/proj/Broken.json',
      JSON.stringify({
        version: 1,
        vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
        name: 'Broken',
        concepts: [
          {
            id: 'n1',
            label: 'C',
            x: 0,
            y: 0,
            data: {
              elaboration: {
                definition: 'ok',
                examples: ['unsupported alpha field'],
              },
            },
          },
        ],
        relations: [],
      }),
    )
    const result = await checkWorkspaceCompatibility(await ws())
    expect(result.status).toBe('unsupported-only')
    expect(result.unsupportedCount).toBe(1)
  })

  it('returns compatible when some files are malformed but at least one is valid', async () => {
    writeDiskFile('Valid.json', { id: gid(1), name: 'Valid', updatedAt: 1000 })
    // Malformed-content file alongside a valid one.
    tauriFsState.writeFile(
      '/proj/Broken.json',
      JSON.stringify({
        version: 1,
        vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
        name: 'Broken',
        concepts: [
          {
            id: 'n1',
            label: 'C',
            x: 0,
            y: 0,
            data: {
              elaboration: {
                definition: 'ok',
                notes: 'unsupported alpha field',
              },
            },
          },
        ],
        relations: [],
      }),
    )
    const result = await checkWorkspaceCompatibility(await ws())
    expect(result.status).toBe('compatible')
    expect(result.unsupportedCount).toBe(1)
  })
})
