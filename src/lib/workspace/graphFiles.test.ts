// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import { deserialize, GRAPH_FORMAT_VERSION } from '@nesso-how/schema'
import { VOCABULARY } from '@nesso-how/vocab-learning'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', async () => (await import('@/test/fakeTauriFs')).fakeFsPlugin)
vi.mock('@tauri-apps/api/path', async () => (await import('@/test/fakeTauriFs')).fakePathApi)
vi.mock('@tauri-apps/api/core', async () => (await import('@/test/fakeTauriFs')).fakeCoreApi)

import type { GraphRecord } from '@/store/db'
import { defaultConceptReviewFields } from '@/types/graph'
import {
  filenameBaseFromName,
  graphNameFromFilename,
  recordToGraphFile,
  uniqueGraphNameAmong,
} from './graphFiles'

describe('filenameBaseFromName', () => {
  it('keeps spaces but strips path-forbidden characters', () => {
    expect(filenameBaseFromName('My Graph')).toBe('My Graph')
    expect(filenameBaseFromName('a/b:c|d')).toBe('a-b-c-d')
    expect(filenameBaseFromName('  trimmed  ')).toBe('trimmed')
  })

  it('falls back to `graph` only when the result would be empty', () => {
    expect(filenameBaseFromName('')).toBe('graph')
    expect(filenameBaseFromName('   ')).toBe('graph')
    expect(filenameBaseFromName('???')).toBe('---')
  })
})

describe('graphNameFromFilename', () => {
  it('drops the .json extension case-insensitively', () => {
    expect(graphNameFromFilename('Foo.json')).toBe('Foo')
    expect(graphNameFromFilename('Foo.JSON')).toBe('Foo')
    expect(graphNameFromFilename('No extension')).toBe('No extension')
  })

  it('falls back to Untitled for an empty stem', () => {
    expect(graphNameFromFilename('.json')).toBe('Untitled')
  })

  it('trims surrounding whitespace from the stem', () => {
    expect(graphNameFromFilename(' Spaced .json')).toBe('Spaced')
  })
})

describe('uniqueGraphNameAmong', () => {
  it('returns the name unchanged when it is free', () => {
    expect(uniqueGraphNameAmong('Foo', [])).toBe('Foo')
    expect(uniqueGraphNameAmong('Foo', ['Bar'])).toBe('Foo')
  })

  it('suffixes with the first free -N, case-insensitively', () => {
    expect(uniqueGraphNameAmong('Foo', ['Foo'])).toBe('Foo-2')
    expect(uniqueGraphNameAmong('Foo', ['foo', 'Foo-2'])).toBe('Foo-3')
  })

  it('defaults a blank name to `graph`', () => {
    expect(uniqueGraphNameAmong('   ', [])).toBe('graph')
  })

  it('matches used names after trimming whitespace', () => {
    expect(uniqueGraphNameAmong('Foo', [' foo '])).toBe('Foo-2')
  })
})

describe('recordToGraphFile', () => {
  const record: GraphRecord = {
    recordVersion: 1,
    vocabulary: {
      id: '@nesso-how/vocab-learning',
      version: '0.1.0',
    },
    id: 'g0000000000001',
    name: 'Demo',
    createdAt: 1,
    updatedAt: 42,
    nodes: [
      {
        id: 'n1',
        position: { x: 0, y: 0 },
        selected: true,
        data: { text: 'A', ...defaultConceptReviewFields() },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'n1',
        target: 'n1',
        type: 'nesso',
        selected: true,
        data: { type: 'causes' },
      },
    ],
  }

  it('serializes to a Nesso graph document carrying id, name and updatedAt', () => {
    const parsed = deserialize(recordToGraphFile(record))
    expect(parsed).toMatchObject({
      version: GRAPH_FORMAT_VERSION,
      vocabulary: { id: VOCABULARY.id, version: VOCABULARY.version },
      id: 'g0000000000001',
      name: 'Demo',
      updatedAt: 42,
    })
    expect(parsed.concepts).toHaveLength(1)
    expect(parsed.relations).toHaveLength(1)
  })

  it('omits FSRS fields from serialized concept content', () => {
    const parsed = deserialize(recordToGraphFile(record))
    expect(parsed.concepts[0]).toMatchObject({ id: 'n1', label: 'A', x: 0, y: 0 })
    expect(parsed.concepts[0].data?.elaboration).toBeUndefined()
  })
})

describe('writeGraphRecordToWorkspace — workspace alias resolution', () => {
  beforeEach(async () => {
    const { tauriFsState } = await import('@/test/fakeTauriFs')
    tauriFsState.reset()
  })

  const record: GraphRecord = {
    recordVersion: 1,
    vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
    id: 'g0000000000001',
    name: 'Test',
    createdAt: 1,
    updatedAt: 2,
    nodes: [],
    edges: [],
  }

  const lastGrantPaths = (calls: Array<{ command: string; args?: Record<string, unknown> }>) =>
    calls.filter((c) => c.command === 'grant_fs_scope').map((c) => c.args?.path as string)

  it.each([
    {
      label: 'app-data root alias resolves to concrete /graphs path',
      activeProjectPath: '/appdata',
      expectedGrants: ['/appdata/graphs', '/appdata/graphs/.nesso'],
    },
    {
      label: 'null activeProjectPath resolves to default workspace',

      /*
  it('resolves app-data root alias to concrete /graphs path before granting scope', async () => {
    const { writeGraphRecordToWorkspace } = await import('./graphFiles')
    const { getGrantedPaths, seedTrustedPath } = await import('@/test/fakeTauriFs')

    // The resolved workspace (app-data/graphs) and its .nesso must be trusted.
    seedTrustedPath('/appdata/graphs')
    seedTrustedPath('/appdata/graphs/.nesso')

    const record: GraphRecord = {
      recordVersion: 1,
      vocabulary: {
        id: '@nesso-how/vocab-learning',
        version: '0.1.0',
      },
      id: 'g0000000000001',
      name: 'Test',
      createdAt: 1,
      updatedAt: 2,
      nodes: [],
      edges: [],
    }

    const settings = {
      activeProjectPath: '/appdata', // raw app-data root — must NOT be granted
    } as Parameters<typeof writeGraphRecordToWorkspace>[0]

    await writeGraphRecordToWorkspace(settings, record)

    const granted = getGrantedPaths()
    // The raw app-data root must never be granted.
    expect(granted.has('/appdata')).toBe(false)
    // The concrete default workspace and its .nesso must be granted.
    expect(granted.has('/appdata/graphs')).toBe(true)
    expect(granted.has('/appdata/graphs/.nesso')).toBe(true)
  })

  it('resolves default alias (no activeProjectPath) to concrete /graphs path', async () => {
    const { writeGraphRecordToWorkspace } = await import('./graphFiles')
    const { getGrantedPaths, seedTrustedPath } = await import('@/test/fakeTauriFs')

    seedTrustedPath('/appdata/graphs')
    seedTrustedPath('/appdata/graphs/.nesso')

    const record: GraphRecord = {
      recordVersion: 1,
      vocabulary: {
        id: '@nesso-how/vocab-learning',
        version: '0.1.0',
      },
      id: 'g0000000000001',
      name: 'Default',
      createdAt: 1,
      updatedAt: 2,
      nodes: [],
      edges: [],
    }

    const settings = {
  */
      activeProjectPath: null,
      expectedGrants: ['/appdata/graphs', '/appdata/graphs/.nesso'],
    },
    {
      label: 'external workspace path is preserved unchanged',
      activeProjectPath: '/home/user/projects/my-graph',
      expectedGrants: ['/home/user/projects/my-graph', '/home/user/projects/my-graph/.nesso'],
    },
  ])('$label', async ({ activeProjectPath, expectedGrants }) => {
    const { writeGraphRecordToWorkspace } = await import('./graphFiles')
    const { tauriFsState } = await import('@/test/fakeTauriFs')

    const settings = { activeProjectPath } as Parameters<typeof writeGraphRecordToWorkspace>[0]

    await writeGraphRecordToWorkspace(settings, record)

    expect(lastGrantPaths(tauriFsState.calls)).toEqual(expectedGrants)
  })

  it('never grants the raw app-data root', async () => {
    const { writeGraphRecordToWorkspace } = await import('./graphFiles')

    const { tauriFsState } = await import('@/test/fakeTauriFs')

    const settings = {
      activeProjectPath: '/appdata',
    } as Parameters<typeof writeGraphRecordToWorkspace>[0]

    await writeGraphRecordToWorkspace(settings, record)

    const grantedRoots = lastGrantPaths(tauriFsState.calls).filter((p) => p === '/appdata')
    expect(grantedRoots).toHaveLength(0)
  })
})

describe('graph file normalization', () => {
  const wsPath = '/proj'

  beforeEach(async () => {
    const { tauriFsState } = await import('@/test/fakeTauriFs')
    tauriFsState.reset()
  })

  it('loads the released baseline document as a versioned GraphRecord', async () => {
    const { tauriFsState } = await import('@/test/fakeTauriFs')
    const { loadRecordFromDiskFile } = await import('./graphFiles')
    const { resolveWorkspace } = await import('@/lib/workspace/paths')

    tauriFsState.writeFile(
      `${wsPath}/Baseline.json`,
      JSON.stringify({
        version: 1,
        vocabulary: {
          id: '@nesso-how/vocab-learning',
          version: '0.1.0',
        },
        id: 'g0000000000001',
        name: 'Baseline',
        updatedAt: 1,
        concepts: [
          {
            id: 'n1',
            label: 'Definition only',
            x: 0,
            y: 0,
            data: {
              elaboration: {
                definition: 'The first protected vocabulary shape.',
              },
            },
          },
        ],
        relations: [],
      }),
    )

    const ws = await resolveWorkspace({ activeProjectPath: wsPath })
    const manifest = { version: 1, entries: {} } as Parameters<typeof loadRecordFromDiskFile>[2]
    const fileToId = new Map<string, string>()

    const record = await loadRecordFromDiskFile(ws, 'Baseline.json', manifest, fileToId)

    expect(record).not.toBeNull()
    expect(record!.recordVersion).toBe(1)
    expect(record!.vocabulary).toEqual({
      id: '@nesso-how/vocab-learning',
      version: '0.1.0',
    })
    expect(record!.id).toBe('g0000000000001')
    expect(record!.name).toBe('Baseline')
    expect(record!.nodes[0]?.data.elaboration).toEqual({
      definition: 'The first protected vocabulary shape.',
    })
  })

  it('does not load a newer envelope as a supported graph', async () => {
    const { tauriFsState } = await import('@/test/fakeTauriFs')
    const { loadRecordFromDiskFile, UnsupportedGraphFileError } = await import('./graphFiles')
    const { resolveWorkspace } = await import('@/lib/workspace/paths')

    tauriFsState.writeFile(
      `${wsPath}/Future.json`,
      JSON.stringify({
        version: 2,
        vocabulary: {
          id: '@nesso-how/vocab-learning',
          version: '0.1.0',
        },
        name: 'Future graph',
        concepts: [],
        relations: [],
      }),
    )

    const ws = await resolveWorkspace({ activeProjectPath: wsPath })
    const manifest = { version: 1, entries: {} } as Parameters<typeof loadRecordFromDiskFile>[2]
    const fileToId = new Map<string, string>()

    await expect(loadRecordFromDiskFile(ws, 'Future.json', manifest, fileToId)).rejects.toThrow(
      UnsupportedGraphFileError,
    )
  })

  it.each([
    'examples',
    'notes',
    'imageUrl',
    'imageTitle',
    'imageDescriptionUrl',
  ])('does not load a definition-plus-%s document', async (field) => {
    const { tauriFsState } = await import('@/test/fakeTauriFs')
    const { loadRecordFromDiskFile, UnsupportedGraphFileError } = await import('./graphFiles')
    const { resolveWorkspace } = await import('@/lib/workspace/paths')

    tauriFsState.writeFile(
      `${wsPath}/Alpha.json`,
      JSON.stringify({
        version: 1,
        vocabulary: {
          id: '@nesso-how/vocab-learning',
          version: '0.1.0',
        },
        name: 'Alpha graph',
        concepts: [
          {
            id: 'n1',
            label: 'Concept',
            x: 0,
            y: 0,
            data: {
              elaboration: {
                definition: 'Definition',
                [field]: 'unsupported',
              },
            },
          },
        ],
        relations: [],
      }),
    )

    const ws = await resolveWorkspace({ activeProjectPath: wsPath })
    const manifest = { version: 1, entries: {} } as Parameters<typeof loadRecordFromDiskFile>[2]
    const fileToId = new Map<string, string>()

    await expect(loadRecordFromDiskFile(ws, 'Alpha.json', manifest, fileToId)).rejects.toThrow(
      UnsupportedGraphFileError,
    )
  })
})

describe('writeGraphRecordToWorkspace reserved paths', () => {
  const wsPath = '/proj'

  beforeEach(async () => {
    const { tauriFsState } = await import('@/test/fakeTauriFs')
    tauriFsState.reset()
  })

  it('does not overwrite a reserved unsupported file with the same stem', async () => {
    const { tauriFsState } = await import('@/test/fakeTauriFs')
    const { writeGraphRecordToWorkspace } = await import('./graphFiles')
    const { setDiskSyncCache } = await import('@/lib/workspace/manifest')

    // Place an unsupported file on disk and mark it as reserved.
    tauriFsState.writeFile(
      `${wsPath}/Foreign.json`,
      JSON.stringify({
        version: 1,
        vocabulary: { id: '@other/vocab', version: '1.0.0' },
        name: 'Foreign',
        concepts: [],
        relations: [],
      }),
    )
    setDiskSyncCache(wsPath, { version: 1, entries: {} }, ['Foreign.json'])

    const record: GraphRecord = {
      recordVersion: 1,
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      id: 'g0000000000001',
      name: 'Foreign',
      createdAt: 1,
      updatedAt: 2,
      nodes: [],
      edges: [],
    }

    const settings = {
      activeProjectPath: wsPath,
    } as Parameters<typeof writeGraphRecordToWorkspace>[0]
    const persisted = await writeGraphRecordToWorkspace(settings, record)

    // The unsupported file's content must still be intact.
    const foreignRaw = tauriFsState.files.get(`${wsPath}/Foreign.json`)!
    expect(JSON.parse(foreignRaw).vocabulary.id).toBe('@other/vocab')

    // The persisted record must have been renamed to avoid the collision.
    expect(persisted.name).not.toBe('Foreign')
    // The renamed record must use a different file name.
    expect(tauriFsState.files.has(`${wsPath}/${persisted.name}.json`)).toBe(true)
  })

  it('does not use cached reservedPaths from a different workspace', async () => {
    const { tauriFsState } = await import('@/test/fakeTauriFs')
    const { writeGraphRecordToWorkspace } = await import('./graphFiles')
    const { setDiskSyncCache } = await import('@/lib/workspace/manifest')

    const wsA = '/proj-a'
    const wsB = '/proj-b'

    // Populate cache for workspace A with reserved paths that include
    // a filename the target (wsB) should be free to use.
    setDiskSyncCache(wsA, { version: 1, entries: {} }, ['Target.json'])

    // Write to workspace B using the name "Target" — the stale reservations
    // from workspace A must not prevent using this filename in workspace B.
    const record: GraphRecord = {
      recordVersion: 1,
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      id: 'g0000000000001',
      name: 'Target',
      createdAt: 1,
      updatedAt: 2,
      nodes: [],
      edges: [],
    }

    const settings = {
      activeProjectPath: wsB,
    } as Parameters<typeof writeGraphRecordToWorkspace>[0]
    const persisted = await writeGraphRecordToWorkspace(settings, record)

    // The record must use the name "Target" (not deduplicated due to stale
    // reservedPaths from a different workspace).
    expect(persisted.name).toBe('Target')
    expect(tauriFsState.files.has(`${wsB}/Target.json`)).toBe(true)
  })

  it('updates manifest entry name and record name to match the rebound filename after reserved-path rebind', async () => {
    const { tauriFsState } = await import('@/test/fakeTauriFs')
    const { saveGraphToDisk, graphNameFromFilename } = await import('./graphFiles')
    const { setDiskSyncCache, buildFileToIdMap } = await import('@/lib/workspace/manifest')
    const { resolveWorkspace } = await import('@/lib/workspace/paths')

    // Place an unsupported file on disk and mark it as reserved.
    tauriFsState.writeFile(
      `${wsPath}/Collide.json`,
      JSON.stringify({
        version: 1,
        vocabulary: { id: '@other/vocab', version: '1.0.0' },
        name: 'Collide',
        concepts: [],
        relations: [],
      }),
    )
    setDiskSyncCache(wsPath, { version: 1, entries: {} }, ['Collide.json'])

    const ws = await resolveWorkspace({ activeProjectPath: wsPath })
    const manifest = {
      version: 1,
      entries: {
        g0000000000001: {
          id: 'g0000000000001',
          file: 'Collide.json', // reserved path
          name: 'OldName',
          updatedAt: 1,
        },
      },
    }
    const fileToId = buildFileToIdMap(manifest)

    const record: GraphRecord = {
      recordVersion: 1,
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      id: 'g0000000000001',
      name: 'Collide',
      createdAt: 1,
      updatedAt: 2,
      nodes: [],
      edges: [],
    }

    const result = await saveGraphToDisk(ws, record, manifest, fileToId, new Set(['Collide.json']))

    // The reserved file must not be overwritten.
    const reservedRaw = tauriFsState.files.get(`${wsPath}/Collide.json`)!
    expect(JSON.parse(reservedRaw).vocabulary.id).toBe('@other/vocab')

    // The manifest entry must point to a different file.
    expect(result.manifest.entries['g0000000000001'].file).not.toBe('Collide.json')

    // The new file must exist on disk.
    const newFile = result.manifest.entries['g0000000000001'].file
    expect(tauriFsState.files.has(`${wsPath}/${newFile}`)).toBe(true)

    // The record name must match the new filename (no name drift).
    const filenameDerivedName = graphNameFromFilename(newFile)
    expect(result.record.name).toBe(filenameDerivedName)

    // The manifest entry name must also match (no later self-healing rewrite).
    expect(result.manifest.entries['g0000000000001'].name).toBe(filenameDerivedName)

    // The JSON content on disk must carry the same name.
    const diskJson = JSON.parse(tauriFsState.files.get(`${wsPath}/${newFile}`)!)
    expect(diskJson.name).toBe(filenameDerivedName)
  })
})
