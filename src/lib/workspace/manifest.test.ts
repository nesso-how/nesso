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

  it('persists and returns reserved paths so subsequent saves avoid unsupported files', () => {
    const m = manifest()
    const reserved = ['Foreign.json', 'Broken.json']
    setDiskSyncCache('/ws', m, reserved)
    const cache = getDiskSyncCache()
    expect(cache.workspace).toBe('/ws')
    expect(cache.reservedPaths).toEqual(reserved)
  })

  it('preserves existing reserved paths when setDiskSyncCache is called without the parameter on the same workspace', () => {
    const m = manifest()
    const reserved = ['Foreign.json']
    setDiskSyncCache('/ws', m, reserved)
    // Same-workspace update without reservedPaths — preserve existing.
    setDiskSyncCache('/ws', { version: 1, entries: {} })
    const cache = getDiskSyncCache()
    expect(cache.reservedPaths).toEqual(reserved)
  })

  it('clears reserved paths when workspace changes and reservedPaths is omitted', () => {
    // Populate cache for workspace A with reserved paths.
    setDiskSyncCache('/ws-a', manifest(), ['Foreign.json'])
    expect(getDiskSyncCache().reservedPaths).toEqual(['Foreign.json'])

    // Switch to workspace B WITHOUT supplying reservedPaths.
    // The stale reservations from workspace A must be cleared.
    setDiskSyncCache('/ws-b', { version: 1, entries: {} })
    const cache = getDiskSyncCache()
    expect(cache.workspace).toBe('/ws-b')
    expect(cache.reservedPaths).toEqual([])
  })

  it('carries over reserved paths when workspace changes and reservedPaths is supplied', () => {
    setDiskSyncCache('/ws-a', manifest(), ['Foreign.json'])

    // Switching to workspace B with explicit reservedPaths — use the new ones.
    setDiskSyncCache('/ws-b', { version: 1, entries: {} }, ['Other.json'])
    const cache = getDiskSyncCache()
    expect(cache.workspace).toBe('/ws-b')
    expect(cache.reservedPaths).toEqual(['Other.json'])
  })
})
