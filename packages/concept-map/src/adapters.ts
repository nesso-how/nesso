import type { GraphSnapshot, Selection } from '@nesso-how/plugin'
import { relationKey } from '@nesso-how/schema'
import { MarkerType, Position } from '@xyflow/react'
import type { ConceptNode, RelationEdge } from './types'

type ConceptView = GraphSnapshot['concepts'][number]
type RelationView = GraphSnapshot['relations'][number]

export type ConceptNodeSize = { width: number; height: number }
type ConceptBounds = ConceptNodeSize & { position: ConceptView['position'] }
export type ConceptNodeSizes = Record<string, ConceptNodeSize>
export const conceptNodeMinSize: ConceptNodeSize = { width: 100, height: 44 }

export const indexGraph = (graph: GraphSnapshot) => ({
  concepts: new Map(graph.concepts.map((concept) => [concept.id, concept])),
  relationTypes: new Map(graph.relationTypes.map((type) => [type.id, type])),
})

export const facingSide = (from: ConceptBounds, to: ConceptBounds): Position => {
  const dx = to.position.x + to.width / 2 - from.position.x - from.width / 2
  const dy = to.position.y + to.height / 2 - from.position.y - from.height / 2
  return Math.abs(dx) / Math.max(from.width, 1) >= Math.abs(dy) / Math.max(from.height, 1)
    ? dx >= 0
      ? Position.Right
      : Position.Left
    : dy >= 0
      ? Position.Bottom
      : Position.Top
}

export const containsPoint = (
  concept: ConceptView,
  size: ConceptNodeSize,
  point: ConceptView['position'],
) =>
  point.x >= concept.position.x &&
  point.x <= concept.position.x + size.width &&
  point.y >= concept.position.y &&
  point.y <= concept.position.y + size.height

function conceptNode(
  concept: ConceptView,
  selected: boolean,
  measured?: ConceptNodeSize,
): ConceptNode {
  return {
    id: concept.id,
    type: 'concept',
    position: concept.position,
    measured,
    data: {
      label: concept.label,
      color: concept.color,
      bold: concept.bold,
      italic: concept.italic,
    },
    ariaLabel: concept.label,
    selected,
  }
}

export function outsideNode(concept: ConceptView, measured?: ConceptNodeSize): ConceptNode {
  return {
    ...conceptNode(concept, false, measured),
    className: 'graph-outside-node',
    selectable: false,
    draggable: false,
    connectable: false,
    deletable: false,
    focusable: false,
    domAttributes: { 'aria-hidden': true },
  }
}

export function relationEdge(
  relation: RelationView,
  selected: boolean,
  singleSelection: boolean,
  graph: ReturnType<typeof indexGraph>,
  defaultTypeId?: string,
  sizes: ConceptNodeSizes = {},
): RelationEdge {
  const bounds = (id: string): ConceptBounds => ({
    position: graph.concepts.get(id)!.position,
    ...(sizes[id] ?? conceptNodeMinSize),
  })
  const source = bounds(relation.source)
  const target = bounds(relation.target)
  return {
    id: relationKey(relation),
    source: relation.source,
    target: relation.target,
    sourceHandle: relation.source === relation.target ? Position.Right : facingSide(source, target),
    targetHandle: relation.source === relation.target ? Position.Top : facingSide(target, source),
    label:
      relation.predicate === defaultTypeId
        ? undefined
        : graph.relationTypes.get(relation.predicate)?.label,
    labelStyle: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      fill: selected ? 'var(--foreground)' : 'var(--muted-foreground)',
    },
    labelBgStyle: { fill: 'var(--background)', fillOpacity: 0.94 },
    labelBgPadding: [6, 3],
    style: {
      stroke: selected ? 'var(--primary)' : 'var(--edge)',
      strokeWidth: selected ? 1.5 : 1.2,
    },
    interactionWidth: 18,
    selected,
    reconnectable: selected && singleSelection,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color: selected ? 'var(--primary)' : 'var(--edge)',
    },
  }
}

export function outsideEdge(
  relation: RelationView,
  graph: ReturnType<typeof indexGraph>,
  defaultTypeId?: string,
  sizes: ConceptNodeSizes = {},
): RelationEdge {
  return {
    ...relationEdge(relation, false, false, graph, defaultTypeId, sizes),
    className: 'graph-outside-edge',
    selectable: false,
    focusable: false,
    deletable: false,
    interactionWidth: 0,
    domAttributes: { 'aria-hidden': true },
  }
}

export function createGraphElements() {
  let previousNodes = new Map<string, ConceptNode>()
  let previousEdges = new Map<string, RelationEdge>()
  let nodeList: ConceptNode[] = []
  let edgeList: RelationEdge[] = []
  return ({
    graph,
    indexed,
    selected,
    sizes,
    defaultTypeId,
    label,
    editing,
  }: {
    graph: GraphSnapshot
    indexed: ReturnType<typeof indexGraph>
    selected: Selection
    sizes: ConceptNodeSizes
    defaultTypeId?: string
    label: (relation: RelationView) => string
    editing?: {
      id: string | null
      enabled: boolean
      maxLength?: number
      onChange: (id: string | null) => void
    }
  }) => {
    const selectedConcepts = new Set(
      selected.filter(({ kind }) => kind === 'concept').map(({ id }) => id),
    )
    const selectedRelations = new Set(
      selected.filter(({ kind }) => kind === 'relation').map(({ id }) => id),
    )
    const nodes = graph.concepts.map((concept) => {
      const node = conceptNode(concept, selectedConcepts.has(concept.id), sizes[concept.id])
      node.data = {
        ...node.data,
        editable: editing?.enabled,
        editing: editing?.id === concept.id,
        maxLength: editing?.maxLength,
        onEditingChange: editing?.onChange,
      }
      const previous = previousNodes.get(node.id)
      return previous &&
        previous.position.x === node.position.x &&
        previous.position.y === node.position.y &&
        previous.data.label === node.data.label &&
        previous.data.color === node.data.color &&
        previous.data.bold === node.data.bold &&
        previous.data.italic === node.data.italic &&
        previous.data.editable === node.data.editable &&
        previous.data.editing === node.data.editing &&
        previous.data.maxLength === node.data.maxLength &&
        previous.data.onEditingChange === node.data.onEditingChange &&
        previous.selected === node.selected &&
        previous.measured?.width === node.measured?.width &&
        previous.measured?.height === node.measured?.height
        ? previous
        : node
    })
    const edges = graph.relations.map((relation) => {
      const edge = {
        ...relationEdge(
          relation,
          selectedRelations.has(relationKey(relation)),
          selected.length === 1,
          indexed,
          defaultTypeId,
          sizes,
        ),
        ariaLabel: label(relation),
      }
      const previous = previousEdges.get(edge.id)
      return previous &&
        previous.sourceHandle === edge.sourceHandle &&
        previous.targetHandle === edge.targetHandle &&
        previous.label === edge.label &&
        previous.ariaLabel === edge.ariaLabel &&
        previous.selected === edge.selected &&
        previous.reconnectable === edge.reconnectable
        ? previous
        : edge
    })
    if (nodes.length !== nodeList.length || nodes.some((node, index) => node !== nodeList[index])) {
      nodeList = nodes
      previousNodes = new Map(nodes.map((node) => [node.id, node]))
    }
    if (edges.length !== edgeList.length || edges.some((edge, index) => edge !== edgeList[index])) {
      edgeList = edges
      previousEdges = new Map(edges.map((edge) => [edge.id, edge]))
    }
    return { nodes: nodeList, edges: edgeList }
  }
}
