import type { DeepReadonly, NessoState, ViewGraphSnapshot } from '@nesso-how/core'
import type { Concept, Presentation } from '@nesso-how/schema'
import type { Edge, Node } from '@xyflow/react'

export type PresentedGraph = DeepReadonly<
  Omit<ViewGraphSnapshot, 'concepts'> & { concepts: (Concept & Presentation)[] }
>
export const presentedGraph = (state: NessoState) => state.viewGraph as PresentedGraph

export type ConceptData = {
  label: string
  color?: string
  bold?: boolean
  italic?: boolean
  strikethrough?: boolean
  editable?: boolean
  maxLength?: number
  editing?: boolean
  historyGroup?: string
  onReuse?: (id: string) => void
  onEditingChange?: (id: string | null) => void
  members?: readonly string[]
  onGroupSelect?: (members: readonly string[]) => void
}
export type ConceptNode = Node<ConceptData, 'concept' | 'relationGroup'>

export type RelationEdge = Edge<
  {
    relations?: readonly string[]
    sourceOffset?: number
    targetOffset?: number
    sourceReferenceOffset?: number
    targetReferenceOffset?: number
    bend?: number
    editable?: boolean
  },
  'relation'
>
