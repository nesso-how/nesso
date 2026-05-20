// SPDX-License-Identifier: MIT
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react'
import type { ConceptNodeData, NessoSettings, EdgeTypeName, Language } from '@/types/graph'
import { CONCEPT_HANDLE_IN, CONCEPT_HANDLE_OUT } from '@/data/conceptHandles'
import { SEEDS, ALL_SEEDS, getSeedsForLanguage, type Seed } from '@/data/seedGraph'
import { ZUSTAND_PERSIST_KEY } from '@/data/storageKeys'
import {
  advanceClipboardAfterPaste,
  getGraphClipboard,
  instantiateClipboard,
  setGraphClipboard,
  snapshotSelection,
} from '@/lib/graphClipboard'
import type { GraphRecord } from './db'
import { dbSaveGraph, dbLoadGraph, dbListGraphs, dbDeleteGraph } from './db'

function detectBrowserLanguage(): Language {
  const lang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en'
  return lang === 'it' ? 'it' : 'en'
}

type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | null

type Viewport = { x: number; y: number; zoom: number }

type GraphSnapshot = { nodes: Node<ConceptNodeData>[]; edges: Edge[] }

const MAX_UNDO = 50
const _draggingNodeIds = new Set<string>()

function pushHistory(s: GraphSnapshot & { _history: GraphSnapshot[]; _future: GraphSnapshot[] }) {
  return {
    _history: [...s._history, { nodes: s.nodes, edges: s.edges }].slice(-MAX_UNDO),
    _future: [] as GraphSnapshot[],
  }
}

export interface GraphMeta {
  id: string
  name: string
  updatedAt: number
}

interface GraphState {
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
  selected: Selection
  settings: NessoSettings
  mentorPanelExpanded: boolean

  // Per-graph viewports (persisted in localStorage for instant restore)
  viewports: Record<string, Viewport>

  // Multi-graph
  currentGraphId: string
  graphList: GraphMeta[]

  // Bumped on every loadGraph so useAutoSave can skip the save that would
  // otherwise fire when nodes/edges are replaced by a load (vs. a real edit).
  loadedToken: number

  _history: GraphSnapshot[]
  _future: GraphSnapshot[]
  undo: () => void
  redo: () => void

  // Graph mutations
  onNodesChange: (changes: NodeChange<Node<ConceptNodeData>>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  updateNodeData: (id: string, patch: Partial<ConceptNodeData>) => void
  deleteNode: (id: string) => void
  addNode: (x?: number, y?: number) => string
  addEdge: (source: string, target: string, type: EdgeTypeName) => string
  updateEdgeType: (id: string, type: EdgeTypeName) => void
  deleteEdge: (id: string) => void

  // Selection
  setSelected: (sel: Selection) => void
  /** Sync React Flow marquee / multi-select without clearing node.selected flags. */
  syncFlowSelection: (nodeIds: string[], edgeIds: string[]) => void
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
  deleteSelection: () => void
  /** True after a successful copy; drives paste button enablement. */
  pasteAvailable: boolean
  copySelection: () => boolean
  /** Returns pasted concept ids, or null if clipboard was empty. */
  pasteSelection: () => string[] | null

  /** One-shot: concept node id that should open in edit mode after creation (not persisted). */
  editNodeId: string | null
  requestEditNode: (id: string) => void
  clearEditNodeId: () => void

  // Settings
  setSetting: <K extends keyof NessoSettings>(key: K, value: NessoSettings[K]) => void

  // UI chrome (persisted)
  setMentorPanelExpanded: (expanded: boolean) => void
  sidebarCollapsed: boolean
  sidebarDisplayOpen: boolean
  setSidebarCollapsed: (v: boolean) => void
  setSidebarDisplayOpen: (v: boolean) => void

  // Viewport
  saveViewport: (id: string, vp: Viewport) => void

  // Multi-graph actions
  loadGraphList: () => Promise<GraphMeta[]>
  loadGraph: (id: string) => Promise<void>
  saveCurrentGraph: (viewport?: Viewport) => Promise<void>
  createGraph: (name: string) => Promise<string>
  importGraph: (name: string, nodes: Node<ConceptNodeData>[], edges: Edge[]) => Promise<string>
  renameGraph: (id: string, name: string) => Promise<void>
  deleteGraph: (id: string) => Promise<void>
}


function makeSeedRecord(seed: Seed): GraphRecord {
  const now = Date.now()
  return { id: seed.id, name: seed.name, createdAt: now, updatedAt: now, nodes: seed.nodes, edges: seed.edges }
}

export const useGraphStore = create<GraphState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selected: null,
      selectedIds: [],
      pasteAvailable: false,
      editNodeId: null,
      mentorPanelExpanded: false,
      sidebarCollapsed: false,
      sidebarDisplayOpen: true,
      viewports: {},
      currentGraphId: SEEDS[0].id,
      graphList: SEEDS.map(s => ({ id: s.id, name: s.name, updatedAt: Date.now() })),
      loadedToken: 0,
      _history: [],
      _future: [],
      settings: {
        dark: false,
        accent: '#b14a2e',
        language: 'en' as const,
        edgeEncoding: 'full',
        showLabels: false,
        showConfidence: true,
        showHeatmap: true,
        curveStyle: 'arc',
        categoryPalette: 'default',
        aiMode: 'local',
        aiBaseUrl: 'http://localhost:11434/v1',
        aiModel: 'gemma3:4b',
        aiApiKey: '',
        fsrsRetention: 0.9,
        maximumInterval: 365,
        inspectorExamplesOpen: true,
        inspectorRelationsOpen: true,
      },

      undo: () =>
        set(s => {
          if (!s._history.length) return s
          const prev = s._history[s._history.length - 1]
          _draggingNodeIds.clear()
          return {
            _history: s._history.slice(0, -1),
            _future: [{ nodes: s.nodes, edges: s.edges }, ...s._future].slice(0, MAX_UNDO),
            nodes: prev.nodes,
            edges: prev.edges,
            selected: null,
          }
        }),

      redo: () =>
        set(s => {
          if (!s._future.length) return s
          const next = s._future[0]
          _draggingNodeIds.clear()
          return {
            _future: s._future.slice(1),
            _history: [...s._history, { nodes: s.nodes, edges: s.edges }].slice(-MAX_UNDO),
            nodes: next.nodes,
            edges: next.edges,
            selected: null,
          }
        }),

      onNodesChange: (changes) => {
        for (const c of changes) {
          if (c.type === 'position' && c.dragging === false) {
            _draggingNodeIds.delete(c.id)
          }
        }
        const startsDrag = changes.filter(
          (c): c is Extract<NodeChange<Node<ConceptNodeData>>, { type: 'position' }> =>
            c.type === 'position'
            && c.dragging === true
            && !_draggingNodeIds.has(c.id)
        )
        const hasRemove = changes.some(c => c.type === 'remove')
        if (startsDrag.length > 0) {
          for (const c of startsDrag) {
            _draggingNodeIds.add(c.id)
          }
          set(s => ({
            ...pushHistory(s),
            nodes: applyNodeChanges(changes, s.nodes as any) as Node<ConceptNodeData>[],
          }))
        } else if (hasRemove) {
          set(s => ({
            ...pushHistory(s),
            nodes: applyNodeChanges(changes, s.nodes as any) as Node<ConceptNodeData>[],
          }))
        } else {
          set(s => ({
            nodes: applyNodeChanges(changes, s.nodes as any) as Node<ConceptNodeData>[],
          }))
        }
      },

      onEdgesChange: (changes) => {
        const hasRemove = changes.some(c => c.type === 'remove')
        if (hasRemove) {
          const removedIds = new Set(
            changes.filter((c): c is { type: 'remove'; id: string } => c.type === 'remove').map(c => c.id),
          )
          set(s => ({
            ...pushHistory(s),
            edges: applyEdgeChanges(changes, s.edges),
            selected:
              s.selected?.kind === 'edge' && removedIds.has(s.selected.id) ? null : s.selected,
          }))
        } else {
          set(s => ({ edges: applyEdgeChanges(changes, s.edges) }))
        }
      },

      updateNodeData: (id, patch) =>
        set(s => ({
          ...pushHistory(s),
          nodes: s.nodes.map(n =>
            n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
          ),
        })),

      deleteNode: (id) =>
        set(s => ({
          ...pushHistory(s),
          nodes: s.nodes.filter(n => n.id !== id),
          edges: s.edges.filter(e => e.source !== id && e.target !== id),
          selected: s.selected?.id === id ? null : s.selected,
        })),

      addNode: (x = 0, y = 0) => {
        const id = 'n' + Math.random().toString(36).slice(2, 7)
        set(s => ({
          ...pushHistory(s),
          nodes: [
            ...s.nodes.map(n => (n.selected ? { ...n, selected: false } : n)),
            {
              id,
              type: 'concept',
              position: { x, y },
              selected: true,
              data: {
                text: 'New concept',
                stability: 0,
                difficulty: 0,
                reps: 0,
                lapses: 0,
                fsrsState: 0,
                due: 0,
                lastReview: 0,
                lastRating: 0,
              },
            },
          ],
          edges: s.edges.map(e => (e.selected ? { ...e, selected: false } : e)),
          selected: { kind: 'node', id },
          selectedIds: [id],
          editNodeId: id,
        }))
        return id
      },

      requestEditNode: (id) => set({ editNodeId: id }),
      clearEditNodeId: () => set({ editNodeId: null }),

      addEdge: (source, target, type) => {
        const id = 'e' + Math.random().toString(36).slice(2, 8)
        set(s => ({
          ...pushHistory(s),
          nodes: s.nodes.map(n => (n.selected ? { ...n, selected: false } : n)),
          edges: [
            ...s.edges.map(e => (e.selected ? { ...e, selected: false } : e)),
            {
              id,
              source,
              target,
              sourceHandle: CONCEPT_HANDLE_OUT,
              targetHandle: CONCEPT_HANDLE_IN,
              type: 'nesso',
              selected: true,
              data: { type },
            },
          ],
          selected: { kind: 'edge', id },
          selectedIds: [],
        }))
        return id
      },

      updateEdgeType: (id, type) =>
        set(s => ({
          ...pushHistory(s),
          edges: s.edges.map(e =>
            e.id === id ? { ...e, data: { ...e.data, type } } : e
          ),
        })),

      deleteEdge: (id) =>
        set(s => ({
          ...pushHistory(s),
          edges: s.edges.filter(e => e.id !== id),
          selected: s.selected?.id === id ? null : s.selected,
        })),

      setSelected: (sel) => set(s => {
        // Guard against re-entrant calls (e.g. onSelectionChange reacting to
        // a programmatic node.selected update firing back into this action).
        if (s.selected?.kind === sel?.kind && s.selected?.id === sel?.id) return s

        if (sel?.kind === 'node') {
          let nodesChanged = false
          const nodes = s.nodes.map(n => {
            const want = n.id === sel.id
            if (Boolean(n.selected) !== want) { nodesChanged = true; return { ...n, selected: want } }
            return n
          })
          let edgesChanged = false
          const edges = s.edges.map(e => {
            if (e.selected) { edgesChanged = true; return { ...e, selected: false } }
            return e
          })
          return {
            selected: sel,
            selectedIds: [sel.id],
            nodes: nodesChanged ? nodes : s.nodes,
            edges: edgesChanged ? edges : s.edges,
          }
        }

        if (sel?.kind === 'edge') {
          let nodesChanged = false
          const nodes = s.nodes.map(n => {
            if (n.selected) { nodesChanged = true; return { ...n, selected: false } }
            return n
          })
          let edgesChanged = false
          const edges = s.edges.map(e => {
            const want = e.id === sel.id
            if (Boolean(e.selected) !== want) { edgesChanged = true; return { ...e, selected: want } }
            return e
          })
          return {
            selected: sel,
            selectedIds: [],
            nodes: nodesChanged ? nodes : s.nodes,
            edges: edgesChanged ? edges : s.edges,
          }
        }

        let nodesChanged = false
        const nodes = s.nodes.map(n => {
          if (n.selected) { nodesChanged = true; return { ...n, selected: false } }
          return n
        })
        let edgesChanged = false
        const edges = s.edges.map(e => {
          if (e.selected) { edgesChanged = true; return { ...e, selected: false } }
          return e
        })
        return {
          selected: null,
          selectedIds: [],
          nodes: nodesChanged ? nodes : s.nodes,
          edges: edgesChanged ? edges : s.edges,
        }
      }),

      syncFlowSelection: (nodeIds, edgeIds) =>
        set(s => {
          const nodeIdSet = new Set(nodeIds)
          const edgeIdSet = new Set(edgeIds)

          let selected: Selection = null
          if (nodeIds.length === 1 && edgeIds.length === 0) {
            selected = { kind: 'node', id: nodeIds[0] }
          } else if (edgeIds.length === 1 && nodeIds.length === 0) {
            selected = { kind: 'edge', id: edgeIds[0] }
          }

          const selectedIdsMatch =
            nodeIds.length === s.selectedIds.length
            && nodeIds.every(id => s.selectedIds.includes(id))
          const selectedMatch =
            selected?.kind === s.selected?.kind && selected?.id === s.selected?.id
            || (selected === null && s.selected === null)

          let nodesChanged = false
          const nodes = s.nodes.map(n => {
            const want = nodeIdSet.has(n.id)
            if (Boolean(n.selected) !== want) {
              nodesChanged = true
              return { ...n, selected: want }
            }
            return n
          })
          let edgesChanged = false
          const edges = s.edges.map(e => {
            const want = edgeIdSet.has(e.id)
            if (Boolean(e.selected) !== want) {
              edgesChanged = true
              return { ...e, selected: want }
            }
            return e
          })

          if (!nodesChanged && !edgesChanged && selectedIdsMatch && selectedMatch) return s

          return {
            selected,
            selectedIds: nodeIds,
            nodes: nodesChanged ? nodes : s.nodes,
            edges: edgesChanged ? edges : s.edges,
          }
        }),

      setSelectedIds: (ids) => set({ selectedIds: ids }),

      deleteSelection: () =>
        set(s => {
          const nodeIds = new Set(s.selectedIds)
          if (s.selected?.kind === 'node') nodeIds.add(s.selected.id)

          const edgeIds = new Set<string>()
          if (s.selected?.kind === 'edge') edgeIds.add(s.selected.id)
          for (const e of s.edges) {
            if (e.selected) edgeIds.add(e.id)
          }

          // Prefer deleting concepts when any are selected (marquee also auto-selects edges).
          if (nodeIds.size > 0) {
            return {
              ...pushHistory(s),
              nodes: s.nodes.filter(n => !nodeIds.has(n.id)),
              edges: s.edges.filter(e => !nodeIds.has(e.source) && !nodeIds.has(e.target)),
              selected: null,
              selectedIds: [],
            }
          }

          if (edgeIds.size > 0) {
            return {
              ...pushHistory(s),
              edges: s.edges.filter(e => !edgeIds.has(e.id)),
              selected: null,
              selectedIds: [],
            }
          }

          return s
        }),

      copySelection: () => {
        const snap = snapshotSelection(get())
        if (!snap) return false
        setGraphClipboard(snap)
        set({ pasteAvailable: true })
        return true
      },

      pasteSelection: () => {
        const clip = getGraphClipboard()
        if (!clip?.nodes.length && !clip?.edges.length) return null
        const { nodes: pastedNodes, edges: pastedEdges } = instantiateClipboard(clip)
        const pastedNodeIds = pastedNodes.map(n => n.id)

        set(s => ({
          ...pushHistory(s),
          nodes: [
            ...s.nodes.map(n => (n.selected ? { ...n, selected: false } : n)),
            ...pastedNodes,
          ],
          edges: [
            ...s.edges.map(e => (e.selected ? { ...e, selected: false } : e)),
            ...pastedEdges,
          ],
          selected:
            pastedNodeIds.length === 1
              ? { kind: 'node', id: pastedNodeIds[0] }
              : pastedEdges.length === 1 && pastedNodeIds.length === 0
                ? { kind: 'edge', id: pastedEdges[0].id }
                : null,
          selectedIds: pastedNodeIds,
        }))
        advanceClipboardAfterPaste()
        return pastedNodeIds
      },

      setSetting: (key, value) =>
        set(s => ({ settings: { ...s.settings, [key]: value } })),

      setMentorPanelExpanded: (expanded) => set({ mentorPanelExpanded: expanded }),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setSidebarDisplayOpen: (v) => set({ sidebarDisplayOpen: v }),

      saveViewport: (id, vp) =>
        set(s => ({ viewports: { ...s.viewports, [id]: vp } })),

      loadGraphList: async () => {
        let records = await dbListGraphs()

        // First-launch bootstrap: import language-appropriate seeds when the DB is empty.
        // Detect browser language and persist it; save seeds in reverse so seeds[0]
        // gets the latest updatedAt and appears first in the sidebar.
        if (records.length === 0) {
          const lang = detectBrowserLanguage()
          set(s => ({ settings: { ...s.settings, language: lang } }))
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

        const list = records.map(r => ({ id: r.id, name: r.name, updatedAt: r.updatedAt }))
        set({ graphList: list })
        return list
      },

      loadGraph: async (id) => {
        let record = await dbLoadGraph(id)
        if (!record) {
          const seed = ALL_SEEDS.find(s => s.id === id)
          if (seed) {
            record = makeSeedRecord(seed)
            await dbSaveGraph(record)
          }
        }
        if (!record) return
        _draggingNodeIds.clear()
        set(s => ({
          currentGraphId: record!.id,
          nodes: record!.nodes,
          edges: record!.edges,
          selected: null,
          loadedToken: s.loadedToken + 1,
          _history: [],
          _future: [],
        }))
      },

      saveCurrentGraph: async (viewport) => {
        const { currentGraphId, nodes, edges, graphList } = get()
        const meta = graphList.find(g => g.id === currentGraphId)
        const now = Date.now()
        await dbSaveGraph({
          id: currentGraphId,
          name: meta?.name ?? 'Untitled',
          createdAt: meta?.updatedAt ?? now,
          updatedAt: now,
          nodes,
          edges,
        })
        set(s => ({
          graphList: s.graphList.map(g =>
            g.id === currentGraphId ? { ...g, updatedAt: now } : g
          ),
        }))
      },

      createGraph: async (name) => {
        const id = 'g' + Math.random().toString(36).slice(2, 9)
        const now = Date.now()
        await dbSaveGraph({ id, name, createdAt: now, updatedAt: now, nodes: [], edges: [] })
        _draggingNodeIds.clear()
        set(s => ({
          graphList: [...s.graphList, { id, name, updatedAt: now }],
          currentGraphId: id,
          nodes: [],
          edges: [],
          selected: null,
          _history: [],
          _future: [],
        }))
        return id
      },

      importGraph: async (name, nodes, edges) => {
        const id = 'g' + Math.random().toString(36).slice(2, 9)
        const now = Date.now()
        await dbSaveGraph({ id, name, createdAt: now, updatedAt: now, nodes, edges })
        _draggingNodeIds.clear()
        set(s => ({
          graphList: [...s.graphList, { id, name, updatedAt: now }],
          currentGraphId: id,
          nodes,
          edges,
          selected: null,
          _history: [],
          _future: [],
        }))
        return id
      },

      renameGraph: async (id, name) => {
        const record = await dbLoadGraph(id)
        if (!record) return
        await dbSaveGraph({ ...record, name })
        set(s => ({
          graphList: s.graphList.map(g => g.id === id ? { ...g, name } : g),
        }))
      },

      deleteGraph: async (id) => {
        await dbDeleteGraph(id)
        const { graphList, currentGraphId, loadGraph } = get()
        const next = graphList.find(g => g.id !== id)
        set(s => ({ graphList: s.graphList.filter(g => g.id !== id) }))
        if (currentGraphId === id && next) await loadGraph(next.id)
      },
    }),
    {
      name: ZUSTAND_PERSIST_KEY,
      partialize: (s) => ({
        settings: s.settings,
        mentorPanelExpanded: s.mentorPanelExpanded,
        sidebarCollapsed: s.sidebarCollapsed,
        sidebarDisplayOpen: s.sidebarDisplayOpen,
        currentGraphId: s.currentGraphId,
        graphList: s.graphList,
        viewports: s.viewports,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<GraphState> & { relationTypesPanelOpen?: boolean } | undefined
        if (!p) return current
        const { relationTypesPanelOpen: _removed, ...rest } = p
        const merged = { ...current.settings, ...p.settings } as typeof current.settings & {
          reviewBatchMax?: unknown
          fsrsMaxInterval?: unknown
        }
        const { reviewBatchMax: _legacyReviewBatchMax, fsrsMaxInterval: _legacyFsrsMaxInterval, ...settings } =
          merged
        return {
          ...current,
          ...rest,
          settings,
        }
      },
    }
  )
)

// Selectors
export const selectedNodeSelector = (s: GraphState) => {
  if (s.selected?.kind !== 'node') return null
  return s.nodes.find(n => n.id === s.selected!.id) ?? null
}

export const selectedEdgeSelector = (s: GraphState) => {
  if (s.selected?.kind !== 'edge') return null
  return s.edges.find(e => e.id === s.selected!.id) ?? null
}
