import type { GraphSnapshot } from '@nesso/plugin'
import { relationKey } from '@nesso/schema'
import { MarkerType, Position } from '@xyflow/react'
import type { ConceptNode, RelationEdge } from './types'

type ConceptView = GraphSnapshot['concepts'][number]
type RelationView = GraphSnapshot['relations'][number]

export type ConceptNodeSize = { width: number; height: number }
type ConceptBounds = ConceptNodeSize & { position: ConceptView['position'] }
export type ConceptNodeSizes = Record<string, ConceptNodeSize>
export const conceptNodeMinSize: ConceptNodeSize = { width: 120, height: 50 }

export const facingSide = (from: ConceptBounds, to: ConceptBounds): Position => {
  const dx = to.position.x + to.width / 2 - from.position.x - from.width / 2
  const dy = to.position.y + to.height / 2 - from.position.y - from.height / 2
  return Math.abs(dx) / Math.max(from.width, 1) >= Math.abs(dy) / Math.max(from.height, 1)
    ? dx >= 0 ? Position.Right : Position.Left
    : dy >= 0 ? Position.Bottom : Position.Top
}

export function conceptNode(concept: ConceptView, selected: boolean, measured?: ConceptNodeSize): ConceptNode {
  return {
    id: concept.id,
    type: 'concept',
    position: concept.position,
    measured,
    data: { label: concept.label },
    ariaLabel: concept.label,
    selected,
  }
}

export function relationEdge(relation: RelationView, selected: boolean, graph: GraphSnapshot, defaultTypeId?: string, sizes: ConceptNodeSizes = {}): RelationEdge {
  const bounds = (id: string): ConceptBounds => ({ position: graph.concepts.find((concept) => concept.id === id)!.position, ...(sizes[id] ?? conceptNodeMinSize) })
  const source = bounds(relation.source)
  const target = bounds(relation.target)
  return {
    id: relationKey(relation),
    source: relation.source,
    target: relation.target,
    sourceHandle: relation.source === relation.target ? Position.Right : facingSide(source, target),
    targetHandle: relation.source === relation.target ? Position.Top : facingSide(target, source),
    label: relation.predicate === defaultTypeId ? undefined : graph.relationTypes.find((type) => type.id === relation.predicate)?.label,
    labelStyle: { fontFamily: 'var(--font-mono)', fontSize: 9, fill: selected ? 'var(--foreground)' : 'var(--muted-foreground)' },
    labelBgStyle: { fill: 'var(--background)', fillOpacity: 0.94 },
    labelBgPadding: [6, 3],
    style: { stroke: selected ? 'var(--primary)' : 'var(--edge)', strokeWidth: selected ? 1.5 : 1.2 },
    interactionWidth: 18,
    selected,
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: selected ? 'var(--primary)' : 'var(--edge)' },
  }
}
