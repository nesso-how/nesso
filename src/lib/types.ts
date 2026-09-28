import type { Edge, Node } from '@xyflow/react'

export type ConceptData = { label: string; tags: string[] }
export type ConceptNode = Node<ConceptData, 'concept'>

export type RelationData = { relation: string }
export type RelationEdge = Edge<RelationData, 'relation'>
