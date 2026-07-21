// SPDX-License-Identifier: MIT
import { deserialize, GRAPH_FORMAT_VERSION } from '@nesso-how/schema'
import { VOCABULARY } from '@nesso-how/vocab-learning'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { GraphRecord } from '@/store/db'
import { defaultConceptReviewFields } from '@/types/graph'
import {
  filenameBaseFromName,
  graphNameFromFilename,
  recordToGraphFile,
  uniqueGraphNameAmong,
} from './graphFiles'

vi.mock('@tauri-apps/api/path', async () => (await import('@/test/fakeTauriFs')).fakePathApi)
vi.mock('@tauri-apps/api/core', async () => (await import('@/test/fakeTauriFs')).fakeCoreApi)
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => {}),
  readTextFile: async () =>
    '{"version":"0.1.0","vocabulary":{"id":"nesso-vocab","version":"0.1.0"},"concepts":[],"relations":[]}',
  exists: vi.fn(async () => true),
  readDir: vi.fn(async () => []),
  mkdir: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
  rename: vi.fn(async () => {}),
}))

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
