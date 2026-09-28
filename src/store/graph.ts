import {
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react'
import { create } from 'zustand'
import sample from '../../data/sample-graph.json'
import type { ConceptNode, RelationEdge } from '@/lib/types'

function relation(id: string, source: string, target: string, label = ''): RelationEdge {
  return {
    id,
    source,
    target,
    type: 'relation',
    data: { relation: label },
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: 'var(--muted-foreground)' },
  }
}

interface GraphState {
  nodes: ConceptNode[]
  edges: RelationEdge[]
  focusId: string
  setFocus: (id: string) => void
  onNodesChange: (changes: NodeChange<ConceptNode>[]) => void
  onEdgesChange: (changes: EdgeChange<RelationEdge>[]) => void
  addConcept: (position?: XYPosition) => void
  setConceptLabel: (id: string, label: string) => void
  addTags: (id: string, tags: string[]) => void
  removeTag: (id: string, tag: string) => void
  connect: (connection: Connection) => void
  setEdgeRelation: (id: string, relation: string) => void
  removeNode: (id: string) => void
  removeEdge: (id: string) => void
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: sample.nodes.map((node) => ({ ...node, type: 'concept' as const })),
  edges: sample.edges.map((edge) =>
    relation(edge.id, edge.source, edge.target, edge.data.relation),
  ),
  focusId: sample.nodes[0].id,

  setFocus: (id) =>
    set((state) => ({
      focusId: id,
      nodes: state.nodes.map((node) => ({ ...node, selected: node.id === id })),
      edges: state.edges.map((edge) => ({ ...edge, selected: false })),
    })),

  onNodesChange: (changes) =>
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),

  onEdgesChange: (changes) =>
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

  addConcept: (position) =>
    set((state) => {
      const id = crypto.randomUUID()
      const focus = state.nodes.find((node) => node.id === state.focusId)
      return {
        nodes: [
          ...state.nodes.map((node) => ({ ...node, selected: false })),
          {
            id,
            type: 'concept',
            position: position ?? {
              x: (focus?.position.x ?? 0) + 160,
              y: (focus?.position.y ?? 0) + 100,
            },
            data: { label: `Concept ${state.nodes.length + 1}`, tags: [] },
            selected: true,
          },
        ],
        edges: [
          ...state.edges.map((edge) => ({ ...edge, selected: false })),
          relation(crypto.randomUUID(), state.focusId, id),
        ],
      }
    }),

  setConceptLabel: (id, label) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, label } } : node,
      ),
    })),

  addTags: (id, tags) =>
    set((state) => {
      const known = state.nodes.flatMap((node) => node.data.tags)
      return {
        nodes: state.nodes.map((node) => {
          if (node.id !== id) return node
          const next = [...node.data.tags]
          for (const raw of tags) {
            const tag = raw.trim()
            if (!tag || next.some((item) => item.toLowerCase() === tag.toLowerCase())) continue
            next.push(known.find((item) => item.toLowerCase() === tag.toLowerCase()) ?? tag)
          }
          return { ...node, data: { ...node.data, tags: next } }
        }),
      }
    }),

  removeTag: (id, tag) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, tags: node.data.tags.filter((item) => item !== tag) } }
          : node,
      ),
    })),

  connect: ({ source, target }) => {
    if (!source || !target || source === target) return
    set((state) => {
      if (state.edges.some((edge) => edge.source === source && edge.target === target)) return state
      return {
        nodes: state.nodes.map((node) => ({ ...node, selected: false })),
        edges: [
          ...state.edges.map((edge) => ({ ...edge, selected: false })),
          { ...relation(crypto.randomUUID(), source, target), selected: true },
        ],
      }
    })
  },

  setEdgeRelation: (id, label) =>
    set((state) => ({
      edges: state.edges.map((edge) =>
        edge.id === id
          ? { ...edge, data: { ...edge.data, relation: label } }
          : edge,
      ),
    })),

  removeNode: (id) =>
    set((state) => {
      if (state.nodes.length === 1) return state
      const nodes = state.nodes.filter((node) => node.id !== id)
      return {
        nodes,
        edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
        focusId: state.focusId === id ? nodes[0].id : state.focusId,
      }
    }),

  removeEdge: (id) =>
    set((state) => ({ edges: state.edges.filter((edge) => edge.id !== id) })),
}))
