import type { Edge, Node } from '@xyflow/react'

export type ConceptData = {
  label: string
  color?: string
  bold?: boolean
  italic?: boolean
  editable?: boolean
  maxLength?: number
  editing?: boolean
  onEditingChange?: (id: string | null) => void
}
export type ConceptNode = Node<ConceptData, 'concept'>

export type RelationEdge = Edge
