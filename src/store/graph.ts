// SPDX-License-Identifier: AGPL-3.0
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react'
import type { ConceptNodeData, NessoSettings, EdgeTypeName } from '@/types/graph'
import { CONCEPT_HANDLE_IN, CONCEPT_HANDLE_OUT } from '@/data/conceptHandles'
import { makeSeedGraph } from '@/data/seedGraph'
import { dbSaveGraph, dbLoadGraph, dbListGraphs, dbDeleteGraph } from './db'
import type { GraphRecord } from './db'

type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | null

type Viewport = { x: number; y: number; zoom: number }

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
  tutorialDone: boolean
  relationTypesPanelOpen: boolean
  mentorPanelExpanded: boolean

  // Per-graph viewports (persisted in localStorage for instant restore)
  viewports: Record<string, Viewport>

  // Multi-graph
  currentGraphId: string
  graphList: GraphMeta[]

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

  // Settings
  setSetting: <K extends keyof NessoSettings>(key: K, value: NessoSettings[K]) => void

  // Tutorial
  completeTutorial: () => void

  // UI chrome (persisted)
  setRelationTypesPanelOpen: (open: boolean) => void
  toggleRelationTypesPanel: () => void
  setMentorPanelExpanded: (expanded: boolean) => void

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

const SEED_ID = 'seed'

function makeSeedRecord(): GraphRecord {
  const { nodes, edges } = makeSeedGraph()
  return {
    id: SEED_ID,
    name: 'Programming concepts',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    nodes,
    edges,
  }
}

export const useGraphStore = create<GraphState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selected: null,
      tutorialDone: false,
      relationTypesPanelOpen: true,
      mentorPanelExpanded: true,
      viewports: {},
      currentGraphId: SEED_ID,
      graphList: [{ id: SEED_ID, name: 'Programming concepts', updatedAt: Date.now() }],
      settings: {
        dark: false,
        accent: '#b14a2e',
        edgeEncoding: 'full',
        showLabels: false,
        showConfidence: true,
        curveStyle: 'arc',
        categoryPalette: 'default',
      },

      onNodesChange: (changes) =>
        set(s => ({ nodes: applyNodeChanges(changes, s.nodes as any) as Node<ConceptNodeData>[] })),

      onEdgesChange: (changes) =>
        set(s => ({ edges: applyEdgeChanges(changes, s.edges) })),

      updateNodeData: (id, patch) =>
        set(s => ({
          nodes: s.nodes.map(n =>
            n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
          ),
        })),

      deleteNode: (id) =>
        set(s => ({
          nodes: s.nodes.filter(n => n.id !== id),
          edges: s.edges.filter(e => e.source !== id && e.target !== id),
          selected: s.selected?.id === id ? null : s.selected,
        })),

      addNode: (x = 0, y = 0) => {
        const id = 'n' + Math.random().toString(36).slice(2, 7)
        set(s => ({
          nodes: [
            ...s.nodes,
            {
              id,
              type: 'concept',
              position: { x, y },
              data: { text: 'New concept', conf: 1, reviewed: 0, pinned: false },
            },
          ],
          selected: { kind: 'node', id },
        }))
        return id
      },

      addEdge: (source, target, type) => {
        const id = 'e' + Math.random().toString(36).slice(2, 8)
        set(s => ({
          edges: [...s.edges, {
            id,
            source,
            target,
            sourceHandle: CONCEPT_HANDLE_OUT,
            targetHandle: CONCEPT_HANDLE_IN,
            type: 'nesso',
            data: { type },
          }],
          selected: { kind: 'edge', id },
        }))
        return id
      },

      updateEdgeType: (id, type) =>
        set(s => ({
          edges: s.edges.map(e =>
            e.id === id ? { ...e, data: { ...e.data, type } } : e
          ),
        })),

      deleteEdge: (id) =>
        set(s => ({
          edges: s.edges.filter(e => e.id !== id),
          selected: s.selected?.id === id ? null : s.selected,
        })),

      setSelected: (sel) => set({ selected: sel }),

      setSetting: (key, value) =>
        set(s => ({ settings: { ...s.settings, [key]: value } })),

      completeTutorial: () => set({ tutorialDone: true }),

      setRelationTypesPanelOpen: (open) => set({ relationTypesPanelOpen: open }),
      toggleRelationTypesPanel: () =>
        set(s => ({ relationTypesPanelOpen: !s.relationTypesPanelOpen })),

      setMentorPanelExpanded: (expanded) => set({ mentorPanelExpanded: expanded }),

      saveViewport: (id, vp) =>
        set(s => ({ viewports: { ...s.viewports, [id]: vp } })),

      loadGraphList: async () => {
        const records = await dbListGraphs()
        if (records.length === 0) return []
        const list = records.map(r => ({ id: r.id, name: r.name, updatedAt: r.updatedAt }))
        set({ graphList: list })
        return list
      },

      loadGraph: async (id) => {
        let record = await dbLoadGraph(id)
        if (!record && id === SEED_ID) {
          record = makeSeedRecord()
          await dbSaveGraph(record)
        }
        if (!record) return
        set({
          currentGraphId: id,
          nodes: record.nodes,
          edges: record.edges,
          selected: null,
        })
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
        set(s => ({
          graphList: [...s.graphList, { id, name, updatedAt: now }],
          currentGraphId: id,
          nodes: [],
          edges: [],
          selected: null,
        }))
        return id
      },

      importGraph: async (name, nodes, edges) => {
        const id = 'g' + Math.random().toString(36).slice(2, 9)
        const now = Date.now()
        await dbSaveGraph({ id, name, createdAt: now, updatedAt: now, nodes, edges })
        set(s => ({
          graphList: [...s.graphList, { id, name, updatedAt: now }],
          currentGraphId: id,
          nodes,
          edges,
          selected: null,
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
      name: 'nesso',
      partialize: (s) => ({
        settings: s.settings,
        tutorialDone: s.tutorialDone,
        relationTypesPanelOpen: s.relationTypesPanelOpen,
        mentorPanelExpanded: s.mentorPanelExpanded,
        currentGraphId: s.currentGraphId,
        graphList: s.graphList,
        viewports: s.viewports,
      }),
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
