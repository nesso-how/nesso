// SPDX-License-Identifier: MIT
import type { Node, Edge } from '@xyflow/react'
import type { StateCreator } from 'zustand'
import type { ConceptNodeData, GraphDisplaySettings } from '@/types/graph'
import { defaultGraphDisplay, mergeGraphDisplay } from '@/types/graph'
import { SEEDS, getSeedsForLanguage, type Seed } from '@/data/seedGraph'
import { isGraphId, newGraphId } from '@/lib/graphId'
import { isDesktop } from '@/lib/isDesktop'
import {
  graphPersistEquals,
  graphPersistFingerprint,
  graphPersistPayload,
} from '@/lib/graphPersist'
import {
  persistWorkspaceSync,
  removeGraphFromWorkspace,
  switchGraphWorkspaceFolder,
  uniqueGraphNameAmong,
  writeGraphRecordToWorkspace,
} from '@/lib/workspace'
import type { GraphRecord } from '../db'
import { dbSaveGraph, dbLoadGraph, dbListGraphs, dbDeleteGraph } from '../db'
import { _draggingNodeIds } from './graph-editing'
import type { GraphMeta } from '../types'
import type { GraphState } from '../state'
import type { Language } from '@/types/graph'

function detectBrowserLanguage(): Language {
  const lang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en'
  return lang === 'it' ? 'it' : 'en'
}

function makeSeedRecord(seed: Seed): GraphRecord {
  const now = Date.now()
  return {
    id: seed.id,
    name: seed.name,
    createdAt: now,
    updatedAt: now,
    nodes: seed.nodes,
    edges: seed.edges,
    display: seed.display,
  }
}

export interface GraphManagementSlice {
  currentGraphId: string
  graphList: GraphMeta[]
  loadedToken: number
  loadGraphList: () => Promise<GraphMeta[]>
  switchGraphWorkspace: (graphWorkspacePath: string | null) => Promise<GraphMeta[]>
  loadGraph: (id: string) => Promise<void>
  saveCurrentGraph: () => Promise<void>
  createGraph: (name: string) => Promise<string>
  importGraph: (
    name: string,
    nodes: Node<ConceptNodeData>[],
    edges: Edge[],
    display?: Partial<GraphDisplaySettings>,
    id?: string,
  ) => Promise<string>
  renameGraph: (id: string, name: string) => Promise<void>
  deleteGraph: (id: string) => Promise<void>
}

export const createGraphManagementSlice: StateCreator<GraphState, [], [], GraphManagementSlice> = (
  set,
  get,
) => ({
  currentGraphId: SEEDS[0].id,
  graphList: SEEDS.map((s) => ({ id: s.id, name: s.name, updatedAt: Date.now() })),
  loadedToken: 0,

  loadGraphList: async () => {
    let records = await dbListGraphs()

    if (records.length === 0) {
      const lang = detectBrowserLanguage()
      set((s) => ({ settings: { ...s.settings, language: lang } }))
      const seeds = getSeedsForLanguage(lang)
      const seeded: GraphRecord[] = []
      for (let i = seeds.length - 1; i >= 0; i--) {
        const rec = makeSeedRecord(seeds[i])
        await dbSaveGraph(rec)
        seeded.unshift(rec)
      }
      records = seeded
      set({ currentGraphId: seeds[0].id })
    }

    if (isDesktop()) {
      try {
        records = await persistWorkspaceSync(get().settings, records)
      } catch (err) {
        console.error('[nesso] workspace sync failed:', err)
      }
    }

    const list = records.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt }))
    set({ graphList: list })
    return list
  },

  switchGraphWorkspace: async (graphWorkspacePath) => {
    const prev = get().settings
    const nextSettings = { ...prev, graphWorkspacePath }
    if (!isDesktop()) {
      set((s) => ({ settings: { ...s.settings, graphWorkspacePath } }))
      return get().loadGraphList()
    }
    try {
      const records = await switchGraphWorkspaceFolder(prev, nextSettings)
      set((s) => ({ settings: { ...s.settings, graphWorkspacePath } }))
      const list = records.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt }))
      set({ graphList: list })
      return list
    } catch (err) {
      console.error('[nesso] workspace folder switch failed:', err)
      throw err
    }
  },

  loadGraph: async (id) => {
    const record = await dbLoadGraph(id)
    if (!record) return
    _draggingNodeIds.clear()
    const graphDisplay = mergeGraphDisplay(record!.display, get().settings)
    const fp = graphPersistFingerprint(record!.nodes, record!.edges, graphDisplay)
    set((s) => ({
      currentGraphId: record!.id,
      nodes: record!.nodes,
      edges: record!.edges,
      graphDisplay,
      selected: null,
      loadedToken: s.loadedToken + 1,
      savedFingerprint: fp,
      externalFileConflict: false,
      _history: [],
      _future: [],
    }))
  },

  saveCurrentGraph: async () => {
    if (get().externalFileConflict) return
    const { currentGraphId, nodes, edges, graphList, graphDisplay, settings } = get()
    const meta = graphList.find((g) => g.id === currentGraphId)
    const existing = await dbLoadGraph(currentGraphId)
    if (
      existing &&
      graphPersistEquals(
        { nodes, edges, display: graphDisplay },
        {
          nodes: existing.nodes,
          edges: existing.edges,
          display: mergeGraphDisplay(existing.display, settings),
        },
      )
    ) {
      return
    }
    const {
      nodes: persistNodes,
      edges: persistEdges,
      display,
    } = graphPersistPayload(nodes, edges, graphDisplay)
    const now = Date.now()
    const record: GraphRecord = {
      id: currentGraphId,
      name: meta?.name ?? 'Untitled',
      createdAt: existing?.createdAt ?? meta?.updatedAt ?? now,
      updatedAt: now,
      nodes: persistNodes,
      edges: persistEdges,
      display,
    }
    await dbSaveGraph(record)
    const fp = graphPersistFingerprint(persistNodes, persistEdges, display)
    if (isDesktop()) {
      await writeGraphRecordToWorkspace(get().settings, record)
    }
    set((s) => ({
      graphList: s.graphList.map((g) => (g.id === currentGraphId ? { ...g, updatedAt: now } : g)),
      savedFingerprint: fp,
      externalFileConflict: false,
    }))
  },

  createGraph: async (name) => {
    const id = newGraphId()
    const now = Date.now()
    const display = defaultGraphDisplay(get().settings)
    const record: GraphRecord = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      nodes: [],
      edges: [],
      display,
    }
    await dbSaveGraph(record)
    if (isDesktop()) {
      await writeGraphRecordToWorkspace(get().settings, record)
    }
    _draggingNodeIds.clear()
    set((s) => ({
      graphList: [...s.graphList, { id, name, updatedAt: now }],
      currentGraphId: id,
      nodes: [],
      edges: [],
      graphDisplay: display,
      selected: null,
      _history: [],
      _future: [],
    }))
    return id
  },

  importGraph: async (name, nodes, edges, display, id) => {
    const trimmed = id?.trim()
    const graphId = trimmed && isGraphId(trimmed) ? trimmed : newGraphId()
    const now = Date.now()
    const graphDisplay = mergeGraphDisplay(display, get().settings)
    const existing = await dbListGraphs()
    const peerNames = existing.filter((r) => r.id !== graphId).map((r) => r.name)
    const graphName = uniqueGraphNameAmong(name.trim() || 'Untitled', peerNames)
    const record: GraphRecord = {
      id: graphId,
      name: graphName,
      createdAt: now,
      updatedAt: now,
      nodes,
      edges,
      display: graphDisplay,
    }
    await dbSaveGraph(record)
    if (isDesktop()) {
      await writeGraphRecordToWorkspace(get().settings, record)
    }
    _draggingNodeIds.clear()
    set((s) => {
      const meta = { id: graphId, name: graphName, updatedAt: now }
      const graphList = s.graphList.some((g) => g.id === graphId)
        ? s.graphList.map((g) => (g.id === graphId ? meta : g))
        : [...s.graphList, meta]
      return {
        graphList,
        currentGraphId: graphId,
        nodes,
        edges,
        graphDisplay,
        selected: null,
        _history: [],
        _future: [],
      }
    })
    return graphId
  },

  renameGraph: async (id, name) => {
    const record = await dbLoadGraph(id)
    if (!record) return
    const updated = { ...record, name }
    await dbSaveGraph(updated)
    if (isDesktop()) {
      await writeGraphRecordToWorkspace(get().settings, updated)
    }
    set((s) => ({
      graphList: s.graphList.map((g) => (g.id === id ? { ...g, name } : g)),
    }))
  },

  deleteGraph: async (id) => {
    await dbDeleteGraph(id)
    if (isDesktop()) {
      await removeGraphFromWorkspace(get().settings, id)
    }
    const { graphList, currentGraphId, loadGraph } = get()
    const next = graphList.find((g) => g.id !== id)
    set((s) => ({ graphList: s.graphList.filter((g) => g.id !== id) }))
    if (currentGraphId === id && next) await loadGraph(next.id)
  },
})
