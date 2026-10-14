import type { Edge, Node } from '@xyflow/react'

export type ConceptData = {
  label: string
  editable?: boolean
  maxLength?: number
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
}
export type ConceptNode = Node<ConceptData, 'concept'>

export type RelationEdge = Edge
