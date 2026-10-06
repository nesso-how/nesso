import type { GraphSnapshot } from '@nesso/plugin'
import { relationKey } from '@nesso/schema'
import { MarkerType } from '@xyflow/react'
import type { ConceptNode, RelationEdge } from './types'

type ConceptView = GraphSnapshot['concepts'][number]
type RelationView = GraphSnapshot['relations'][number]

export const conceptNodeSize = { width: 182, height: 50 }

export function conceptNode(concept: ConceptView, selected: boolean): ConceptNode {
  return {
    id: concept.id,
    type: 'concept',
    position: concept.position,
    data: { label: concept.label },
    selected,
  }
}

export function relationEdge(relation: RelationView, selected: boolean): RelationEdge {
  return {
    id: relationKey(relation),
    source: relation.source,
    target: relation.target,
    type: 'relation',
    data: { relationId: relation.predicate },
    selected,
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: selected ? 'var(--primary)' : 'var(--edge)' },
  }
}
