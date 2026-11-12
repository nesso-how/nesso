import type { DeepReadonly, NessoState } from '@nesso-how/core'
import type { Concept, Graph, Presentation } from '@nesso-how/schema'
import type { Edge, Node } from '@xyflow/react'

export type PresentedGraph = DeepReadonly<
  Omit<Graph, 'concepts'> & { concepts: (Concept & Presentation)[] }
>
export const presentedGraph = (state: NessoState) => state.viewGraph as PresentedGraph

export type ConceptData = {
  label: string
  color?: string
  bold?: boolean
  italic?: boolean
  editable?: boolean
  maxLength?: number
  editing?: boolean
  onEditingChange?: (id: string | null) => void
  members?: readonly string[]
  onGroupSelect?: (members: readonly string[]) => void
}
export type ConceptNode = Node<ConceptData, 'concept' | 'relationGroup'>

export type RelationEdge = Edge<{ relations?: readonly string[] }>
