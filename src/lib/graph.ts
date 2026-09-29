import { relationKey, type Concept, type Relation } from '@nesso/schema'
import { MarkerType } from '@xyflow/react'
import type { ConceptNode, RelationEdge } from '@/lib/types'

export function conceptNode(concept: Concept, selected: boolean): ConceptNode {
  return {
    id: concept.id,
    type: 'concept',
    position: concept.position,
    data: { label: concept.label, tags: concept.tags },
    selected,
  }
}

export function relationEdge(relation: Relation, selected: boolean): RelationEdge {
  return {
    id: relationKey(relation),
    source: relation.source,
    target: relation.target,
    type: 'relation',
    data: { relationId: relation.predicate },
    selected,
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: 'var(--muted-foreground)' },
  }
}
