// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import {
  buildFileToIdMap,
  getDiskSyncCache,
  isManifestOnlyWatchPaths,
  setDiskSyncCache,
  upsertManifestEntry,
  type WorkspaceManifest,
} from './manifest'

function manifest(): WorkspaceManifest {
  return {
    version: 1,
    entries: {
      g1: { id: 'g1', file: 'a.json', name: 'A', updatedAt: 1 },
      g2: { id: 'g2', file: 'b.json', name: 'B', updatedAt: 2 },
    },
  }
}

describe('isManifestOnlyWatchPaths', () => {
  it('is true only when every path is the workspace manifest file', () => {
    expect(isManifestOnlyWatchPaths(['/ws/.nesso/manifest.json'])).toBe(true)
    expect(isManifestOnlyWatchPaths(['C:\\ws\\.nesso\\manifest.json'])).toBe(true)
  })

  it('is false for empty input or any non-manifest path', () => {
    expect(isManifestOnlyWatchPaths([])).toBe(false)
    expect(isManifestOnlyWatchPaths(['/ws/.nesso/manifest.json', '/ws/graphs/a.json'])).toBe(false)
    expect(isManifestOnlyWatchPaths(['/ws/graphs/a.json'])).toBe(false)
  })
})

describe('buildFileToIdMap', () => {
  it('maps each entry file to its graph id', () => {
    const map = buildFileToIdMap(manifest())
    expect(map.get('a.json')).toBe('g1')
    expect(map.get('b.json')).toBe('g2')
    expect(map.size).toBe(2)
  })
})

describe('upsertManifestEntry', () => {
  it('inserts a new entry and reports a change', () => {
    const m = manifest()
    expect(upsertManifestEntry(m, 'g3', 'c.json', 'C', 3)).toBe(true)
    expect(m.entries.g3).toEqual({ id: 'g3', file: 'c.json', name: 'C', updatedAt: 3 })
  })

  it('updates an existing entry when a field differs', () => {
    const m = manifest()
    expect(upsertManifestEntry(m, 'g1', 'a.json', 'A renamed', 1)).toBe(true)
    expect(m.entries.g1.name).toBe('A renamed')
  })

  it('returns false and leaves the manifest untouched when nothing changed', () => {
    const m = manifest()
    expect(upsertManifestEntry(m, 'g1', 'a.json', 'A', 1)).toBe(false)
  })
})

describe('disk-sync cache', () => {
  it('round-trips the active workspace and manifest', () => {
    const m = manifest()
    setDiskSyncCache('/ws', m)
    const cache = getDiskSyncCache()
    expect(cache.workspace).toBe('/ws')
    expect(cache.manifest).toBe(m)
  })
})
