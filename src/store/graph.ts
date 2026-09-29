import { newIri, parseGraph, relationKey, type Graph, type Relation, type RelationType } from '@nesso/schema'
import { defaultRelationId, relationIds } from '@nesso/vocab'
import { type Connection, type EdgeChange, type NodeChange, type XYPosition } from '@xyflow/react'
import { create } from 'zustand'
import sample from '../../data/sample-graph.json'
import type { ConceptNode, RelationEdge } from '@/lib/types'

type Selection = { kind: 'concept' | 'relation'; id: string } | null

const defaultTypeIds = new Set<string>(Object.values(relationIds))

const usedTypes = (types: RelationType[], relations: Relation[]) => {
  const used = new Set(relations.map((relation) => relation.predicate))
  return types.filter((type) => defaultTypeIds.has(type.id) || used.has(type.id))
}

interface GraphState {
  graph: Graph
  focusId: string
  selected: Selection
  setFocus: (id: string) => void
  onNodesChange: (changes: NodeChange<ConceptNode>[]) => void
  onEdgesChange: (changes: EdgeChange<RelationEdge>[]) => void
  addConcept: (position?: XYPosition) => void
  setConceptLabel: (id: string, label: string) => void
  addTags: (id: string, tags: string[]) => void
  removeTag: (id: string, tag: string) => void
  connect: (connection: Connection) => void
  setEdgeRelation: (id: string, label: string) => void
  removeNode: (id: string) => void
  removeEdge: (id: string) => void
}

const initialGraph = parseGraph(sample)

export const useGraphStore = create<GraphState>((set) => ({
  graph: initialGraph,
  focusId: initialGraph.concepts[0].id,
  selected: null,

  setFocus: (id) => set({ focusId: id, selected: { kind: 'concept', id } }),

  onNodesChange: (changes) => set((state) => {
    let { graph, selected, focusId } = state
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        const position = change.position
        graph = {
          ...graph,
          concepts: graph.concepts.map((concept) =>
            concept.id === change.id ? { ...concept, position } : concept,
          ),
        }
      } else if (change.type === 'select') {
        if (change.selected) selected = { kind: 'concept', id: change.id }
        else if (selected?.kind === 'concept' && selected.id === change.id) selected = null
      } else if (change.type === 'remove' && graph.concepts.length > 1) {
        const relations = graph.relations.filter((relation) =>
          relation.source !== change.id && relation.target !== change.id,
        )
        graph = {
          ...graph,
          concepts: graph.concepts.filter((concept) => concept.id !== change.id),
          relations,
          relationTypes: usedTypes(graph.relationTypes, relations),
        }
        if (focusId === change.id) focusId = graph.concepts[0].id
        if (selected?.id === change.id) selected = null
        if (selected?.kind === 'relation' &&
          !graph.relations.some((relation) => relationKey(relation) === selected?.id)) selected = null
      }
    }
    return { graph, selected, focusId }
  }),

  onEdgesChange: (changes) => set((state) => {
    let { graph, selected } = state
    for (const change of changes) {
      if (change.type === 'select') {
        if (change.selected) selected = { kind: 'relation', id: change.id }
        else if (selected?.kind === 'relation' && selected.id === change.id) selected = null
      } else if (change.type === 'remove') {
        const relations = graph.relations.filter((relation) => relationKey(relation) !== change.id)
        graph = { ...graph, relations, relationTypes: usedTypes(graph.relationTypes, relations) }
        if (selected?.id === change.id) selected = null
      }
    }
    return { graph, selected }
  }),

  addConcept: (position) => set((state) => {
    const id = newIri()
    const focus = state.graph.concepts.find((concept) => concept.id === state.focusId)
    const relation: Relation = { source: state.focusId, predicate: defaultRelationId, target: id }
    return {
      graph: {
        ...state.graph,
        concepts: [...state.graph.concepts, {
          id,
          label: `Concept ${state.graph.concepts.length + 1}`,
          tags: [],
          position: position ?? {
            x: (focus?.position.x ?? 0) + 160,
            y: (focus?.position.y ?? 0) + 100,
          },
        }],
        relations: [...state.graph.relations, relation],
      },
      selected: { kind: 'concept', id },
    }
  }),

  setConceptLabel: (id, label) => set((state) => ({
    graph: {
      ...state.graph,
      concepts: state.graph.concepts.map((concept) =>
        concept.id === id ? { ...concept, label } : concept,
      ),
    },
  })),

  addTags: (id, tags) => set((state) => {
    const known = state.graph.concepts.flatMap((concept) => concept.tags)
    return {
      graph: {
        ...state.graph,
        concepts: state.graph.concepts.map((concept) => {
          if (concept.id !== id) return concept
          const next = [...concept.tags]
          for (const raw of tags) {
            const tag = raw.trim()
            if (!tag || next.some((item) => item.toLowerCase() === tag.toLowerCase())) continue
            next.push(known.find((item) => item.toLowerCase() === tag.toLowerCase()) ?? tag)
          }
          return { ...concept, tags: next }
        }),
      },
    }
  }),

  removeTag: (id, tag) => set((state) => ({
    graph: {
      ...state.graph,
      concepts: state.graph.concepts.map((concept) =>
        concept.id === id ? { ...concept, tags: concept.tags.filter((item) => item !== tag) } : concept,
      ),
    },
  })),

  connect: ({ source, target }) => {
    if (!source || !target || source === target) return
    set((state) => {
      if (!state.graph.concepts.some((concept) => concept.id === source) ||
        !state.graph.concepts.some((concept) => concept.id === target)) return state
      if (state.graph.relations.some((relation) => relation.source === source && relation.target === target)) {
        return state
      }
      const relation: Relation = { source, predicate: defaultRelationId, target }
      return {
        graph: { ...state.graph, relations: [...state.graph.relations, relation] },
        selected: { kind: 'relation', id: relationKey(relation) },
      }
    })
  },

  setEdgeRelation: (id, rawLabel) => set((state) => {
    const current = state.graph.relations.find((relation) => relationKey(relation) === id)
    if (!current) return state
    const label = rawLabel.trim()
    const existing = state.graph.relationTypes.find(
      (item) => item.label.toLowerCase() === label.toLowerCase(),
    )
    const type = label ? existing ?? { id: newIri(), label } : null
    const next = { ...current, predicate: type?.id ?? defaultRelationId }
    if (state.graph.relations.some((relation) =>
      relationKey(relation) === relationKey(next) && relationKey(relation) !== id,
    )) return state
    const relations = state.graph.relations.map((relation) =>
      relationKey(relation) === id ? next : relation,
    )
    return {
      graph: {
        ...state.graph,
        relations,
        relationTypes: usedTypes(
          type && !existing ? [...state.graph.relationTypes, type] : state.graph.relationTypes,
          relations,
        ),
      },
      selected: { kind: 'relation', id: relationKey(next) },
    }
  }),

  removeNode: (id) => set((state) => {
    if (state.graph.concepts.length === 1) return state
    const concepts = state.graph.concepts.filter((concept) => concept.id !== id)
    const relations = state.graph.relations.filter((relation) =>
      relation.source !== id && relation.target !== id,
    )
    return {
      graph: {
        ...state.graph,
        concepts,
        relations,
        relationTypes: usedTypes(state.graph.relationTypes, relations),
      },
      focusId: state.focusId === id ? concepts[0].id : state.focusId,
      selected: null,
    }
  }),

  removeEdge: (id) => set((state) => {
    const relations = state.graph.relations.filter((relation) => relationKey(relation) !== id)
    return {
      graph: {
        ...state.graph,
        relations,
        relationTypes: usedTypes(state.graph.relationTypes, relations),
      },
      selected: null,
    }
  }),
}))
