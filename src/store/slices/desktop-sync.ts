// SPDX-License-Identifier: MIT
import type { StateCreator } from 'zustand'
import { isDesktop } from '@/lib/isDesktop'
import { graphPersistFingerprint } from '@/lib/graphPersist'
import { mergeGraphDisplay } from '@/types/graph'
import {
  reloadGraphFromDisk,
  resolveWorkspace,
  getDiskSyncCache,
  setDiskSyncCache,
} from '@/lib/workspace'
import { dbSaveGraph } from '../db'
import { _draggingNodeIds } from './graph-editing'
import type { GraphState } from '../state'

export interface DesktopSyncSlice {
  savedFingerprint: string
  externalFileConflict: boolean
  setExternalFileConflict: (v: boolean) => void
  clearExternalFileConflict: () => void
  keepLocalGraphChanges: () => Promise<void>
  reloadActiveGraphFromDisk: () => Promise<void>
}

export const createDesktopSyncSlice: StateCreator<GraphState, [], [], DesktopSyncSlice> = (
  set,
  get,
) => ({
  savedFingerprint: '',
  externalFileConflict: false,

  setExternalFileConflict: (v) => set({ externalFileConflict: v }),
  clearExternalFileConflict: () => set({ externalFileConflict: false }),

  keepLocalGraphChanges: async () => {
    set({ externalFileConflict: false })
    await get().saveCurrentGraph()
  },

  reloadActiveGraphFromDisk: async () => {
    if (!isDesktop()) return
    const { currentGraphId, settings } = get()
    const ws = await resolveWorkspace(settings)
    const { manifest: cached } = getDiskSyncCache()
    const { record, manifest } = await reloadGraphFromDisk(ws, currentGraphId, cached)
    if (!record) return
    setDiskSyncCache(ws.displayPath, manifest)
    await dbSaveGraph(record)
    const graphDisplay = mergeGraphDisplay(record.display, settings)
    const fp = graphPersistFingerprint(record.nodes, record.edges, graphDisplay)
    _draggingNodeIds.clear()
    set((s) => ({
      nodes: record.nodes,
      edges: record.edges,
      graphDisplay,
      selected: null,
      loadedToken: s.loadedToken + 1,
      savedFingerprint: fp,
      externalFileConflict: false,
      graphList: s.graphList.map((g) =>
        g.id === currentGraphId ? { ...g, name: record.name, updatedAt: record.updatedAt } : g,
      ),
      _history: [],
      _future: [],
    }))
  },
})
