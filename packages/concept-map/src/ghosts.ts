import { MarkerType } from '@xyflow/react'
import {
  conceptNodeMinSize,
  facingSide,
  type ConceptNodeSize,
  type ConceptNodeSizes,
} from './adapters.ts'
import { arrange, type LayoutBounds } from './layout.ts'
import type { OutsideNeighbor } from './neighbors.ts'
import type { ConceptNode, PresentedGraph, RelationEdge } from './types'

export const ghostPrefix = '#ghost:'
const shownGhosts = 4
export const moreGhost = { id: '#ghost:more', width: 44, height: 32 }

export const estimatedSize = (label: string, sizes: ConceptNodeSizes, id: string) =>
  sizes[id] ?? {
    width: Math.max(conceptNodeMinSize.width, label.length * 8 + 26),
    height: conceptNodeMinSize.height,
  }

export const conceptBoxes = (concepts: PresentedGraph['concepts'], sizes: ConceptNodeSizes) =>
  concepts.map(({ id, position }) => ({ id, position, ...(sizes[id] ?? conceptNodeMinSize) }))

export function ghostElements({
  anchor,
  neighbors,
  labels,
  concepts,
  relations,
  sizes,
  bounds,
  typeLabel,
}: {
  anchor: string
  neighbors: readonly OutsideNeighbor[]
  labels: ReadonlyMap<string, string>
  concepts: PresentedGraph['concepts']
  relations: PresentedGraph['relations']
  sizes: ConceptNodeSizes
  bounds?: LayoutBounds
  typeLabel: (predicate: string) => string | undefined
}): { nodes: ConceptNode[]; edges: RelationEdge[] } {
  const shown = neighbors.slice(0, shownGhosts)
  const rest = neighbors.slice(shownGhosts).map(({ id }) => id)
  const free = [
    ...shown.map(({ id }) => ({
      id: ghostPrefix + id,
      ...estimatedSize(labels.get(id) ?? '', sizes, id),
    })),
    ...(rest.length ? [moreGhost] : []),
  ]
  const fixed = conceptBoxes(concepts, sizes)
  const positions = arrange({
    fixed,
    free,
    links: [...relations, ...free.map(({ id }) => ({ source: anchor, target: id }))],
    bounds,
  })
  const source = fixed.find(({ id }) => id === anchor)!
  const node = (id: string, size: ConceptNodeSize, data: ConceptNode['data']): ConceptNode => ({
    id,
    type: 'ghost',
    position: positions.get(id)!,
    measured: size,
    data,
    ariaLabel: data.label,
    selectable: false,
    draggable: false,
    connectable: false,
    deletable: false,
  })
  const edge = (
    id: string,
    size: ConceptNodeSize,
    outgoing?: boolean,
    label?: string,
  ): RelationEdge => {
    const target = { position: positions.get(id)!, ...size }
    return {
      id,
      source: outgoing === false ? id : anchor,
      target: outgoing === false ? anchor : id,
      sourceHandle: outgoing === false ? facingSide(target, source) : facingSide(source, target),
      targetHandle: outgoing === false ? facingSide(source, target) : facingSide(target, source),
      label,
      labelStyle: { fontFamily: 'var(--font-mono)', fontSize: 11, fill: 'var(--muted-foreground)' },
      labelBgStyle: { fill: 'var(--background)', fillOpacity: 0.94 },
      labelBgPadding: [6, 3],
      className: 'graph-ghost-edge',
      selectable: false,
      focusable: false,
      reconnectable: false,
      markerEnd:
        outgoing === undefined
          ? undefined
          : { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'var(--edge)' },
    }
  }
  const nodes = shown.map(({ id }, index) =>
    node(free[index].id, free[index], { label: labels.get(id) ?? '' }),
  )
  const edges = shown.map(({ relations }, index) =>
    edge(
      free[index].id,
      free[index],
      relations[0].source === anchor,
      relations.flatMap(({ predicate }) => typeLabel(predicate) ?? []).join(', ') || undefined,
    ),
  )
  if (rest.length) {
    nodes.push(node(moreGhost.id, moreGhost, { label: `+${rest.length}`, members: rest }))
    edges.push(edge(moreGhost.id, moreGhost))
  }
  return { nodes, edges }
}
