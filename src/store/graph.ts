import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react'
import type { ConceptNodeData, NessoSettings, EdgeTypeName } from '@/types/graph'
import { makeSeedGraph } from '@/data/seedGraph'

type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | null

interface GraphState {
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
  selected: Selection
  settings: NessoSettings
  tutorialDone: boolean
  relationTypesPanelOpen: boolean

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
}

export const useGraphStore = create<GraphState>()(
  persist(
    (set) => ({
  ...makeSeedGraph(),
  selected: null,
  tutorialDone: false,
  relationTypesPanelOpen: true,
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
      edges: [...s.edges, { id, source, target, type: 'nesso', data: { type } }],
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
}),
    {
      name: 'nesso',
      partialize: (s) => ({
        settings: s.settings,
        tutorialDone: s.tutorialDone,
        relationTypesPanelOpen: s.relationTypesPanelOpen,
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
