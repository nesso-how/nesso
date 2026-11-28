import { resolveRelationTypeLabel, type Selection, type VocabDefinition } from '@nesso-how/core'
import { defaultLocale, type Locale } from '@nesso-how/i18n'
import { relationKey } from '@nesso-how/schema'
import { MarkerType, Position } from '@xyflow/react'
import type { ConceptNode, PresentedGraph, RelationEdge } from './types'
import { reconnectableEndpoints, selectedRelations } from './reconnection.ts'
import type { RelationGroup } from './groups.ts'

type ConceptView = PresentedGraph['concepts'][number]
type RelationView = PresentedGraph['relations'][number]

export type ConceptNodeSize = { width: number; height: number }
type ConceptBounds = ConceptNodeSize & { position: ConceptView['position'] }
export type ConceptNodeSizes = Record<string, ConceptNodeSize>
export const conceptNodeMinSize: ConceptNodeSize = { width: 100, height: 44 }

export const estimatedSize = (label: string, sizes: ConceptNodeSizes, id: string) =>
  sizes[id] ?? {
    width: Math.max(conceptNodeMinSize.width, label.length * 8 + 26),
    height: conceptNodeMinSize.height,
  }

export const conceptBoxes = (concepts: PresentedGraph['concepts'], sizes: ConceptNodeSizes) =>
  concepts.map(({ id, position }) => ({ id, position, ...(sizes[id] ?? conceptNodeMinSize) }))

export const indexGraph = (
  graph: PresentedGraph,
  vocabs: readonly VocabDefinition[] = [],
  locale: Locale = defaultLocale,
) => ({
  concepts: new Map(graph.concepts.map((concept) => [concept.id, concept])),
  relationTypes: new Map(
    graph.relationTypes.map((type) => [
      type.id,
      { id: type.id, label: resolveRelationTypeLabel(type, vocabs, locale) },
    ]),
  ),
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

export const relationSides = (source: ConceptBounds, target: ConceptBounds, bend = 0) => {
  if (!bend) return { source: facingSide(source, target), target: facingSide(target, source) }
  const from = { x: source.position.x + source.width / 2, y: source.position.y + source.height / 2 }
  const to = { x: target.position.x + target.width / 2, y: target.position.y + target.height / 2 }
  const apex = {
    position: {
      x: (from.x + to.x) / 2 + (from.y - to.y) * bend,
      y: (from.y + to.y) / 2 + (to.x - from.x) * bend,
    },
    width: 0,
    height: 0,
  }
  return { source: facingSide(source, apex), target: facingSide(target, apex) }
}

export function conceptNode(
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
      strikethrough: concept.strikethrough,
    },
    ariaLabel: concept.label,
    selected,
  }
}

export function relationEdge(
  relation: RelationView,
  selected: boolean,
  reconnectable: RelationEdge['reconnectable'],
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
  const sides =
    relation.source === relation.target
      ? { source: Position.Right, target: Position.Top }
      : relationSides(source, target, relation.bend)
  return {
    id: relationKey(relation),
    type: 'relation',
    source: relation.source,
    target: relation.target,
    sourceHandle: sides.source,
    targetHandle: sides.target,
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
    reconnectable: selected && reconnectable,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color: selected ? 'var(--primary)' : 'var(--edge)',
    },
  }
}

const endpointGap = 14
const cornerInset = 12

function spreadEndpoints(
  edges: readonly RelationEdge[],
  boxes: ReadonlyMap<string, ConceptBounds>,
): RelationEdge[] {
  type Endpoint = { index: number; end: 'source' | 'target'; key: number }
  const sides = new Map<string, { length: number; endpoints: Endpoint[] }>()
  edges.forEach((edge, index) => {
    for (const end of ['source', 'target'] as const) {
      const side = edge[`${end}Handle`] as Position
      const horizontal = side === Position.Top || side === Position.Bottom
      const box = boxes.get(edge[end])!
      const other = boxes.get(end === 'source' ? edge.target : edge.source)!
      const key =
        edge.source === edge.target
          ? horizontal
            ? Infinity
            : -Infinity
          : horizontal
            ? other.position.x + other.width / 2
            : other.position.y + other.height / 2
      const id = `${side}:${edge[end]}`
      const group = sides.get(id) ?? {
        length: horizontal ? box.width : box.height,
        endpoints: [],
      }
      group.endpoints.push({ index, end, key })
      sides.set(id, group)
    }
  })
  const offsets = edges.map(() => ({ sourceOffset: 0, targetOffset: 0 }))
  for (const { length, endpoints } of sides.values()) {
    if (endpoints.length < 2) continue
    const step = Math.min(
      endpointGap,
      Math.max(0, length - 2 * cornerInset) / (endpoints.length - 1),
    )
    endpoints
      .sort((a, b) => a.key - b.key || edges[a.index].id.localeCompare(edges[b.index].id))
      .forEach(({ index, end }, order) => {
        offsets[index][`${end}Offset`] = (order - (endpoints.length - 1) / 2) * step
      })
  }
  return edges.map((edge, index) => {
    const { sourceOffset, targetOffset } = offsets[index]
    return sourceOffset || targetOffset
      ? { ...edge, data: { ...edge.data, sourceOffset, targetOffset } }
      : edge
  })
}

const sameEdge = (previous: RelationEdge, edge: RelationEdge) =>
  previous.sourceHandle === edge.sourceHandle &&
  previous.targetHandle === edge.targetHandle &&
  previous.data?.sourceOffset === edge.data?.sourceOffset &&
  previous.data?.targetOffset === edge.data?.targetOffset &&
  previous.data?.sourceReferenceOffset === edge.data?.sourceReferenceOffset &&
  previous.data?.targetReferenceOffset === edge.data?.targetReferenceOffset &&
  previous.data?.bend === edge.data?.bend &&
  previous.data?.editable === edge.data?.editable &&
  previous.label === edge.label &&
  previous.ariaLabel === edge.ariaLabel &&
  previous.selected === edge.selected &&
  previous.reconnectable === edge.reconnectable

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
    interactive = false,
    groups = [],
    preview = new Set(),
    onGroupSelect,
  }: {
    graph: PresentedGraph
    indexed: ReturnType<typeof indexGraph>
    selected: Selection
    sizes: ConceptNodeSizes
    defaultTypeId?: string
    interactive?: boolean
    label: (relation: RelationView) => string
    groups?: readonly RelationGroup[]
    preview?: ReadonlySet<string>
    onGroupSelect?: ConceptNode['data']['onGroupSelect']
    editing?: {
      id: string | null
      enabled: boolean
      maxLength?: number
      historyGroup?: string
      onReuse?: (id: string) => void
      onChange: (id: string | null) => void
    }
  }) => {
    const selectedConcepts = new Set(
      selected.filter(({ kind }) => kind === 'concept').map(({ id }) => id),
    )
    const selectedRelationIds = new Set(
      selected.filter(({ kind }) => kind === 'relation').map(({ id }) => id),
    )
    const reconnectable = reconnectableEndpoints(selectedRelations(graph, selected))
    const nodes = graph.concepts.map((concept) => {
      const node = conceptNode(concept, selectedConcepts.has(concept.id), sizes[concept.id])
      node.data = {
        ...node.data,
        editable: editing?.enabled,
        editing: editing?.id === concept.id,
        maxLength: editing?.maxLength,
        onEditingChange: editing?.onChange,
        historyGroup: editing?.id === concept.id ? editing.historyGroup : undefined,
        onReuse: editing?.id === concept.id ? editing.onReuse : undefined,
      }
      const previous = previousNodes.get(node.id)
      return previous &&
        previous.position.x === node.position.x &&
        previous.position.y === node.position.y &&
        previous.data.label === node.data.label &&
        previous.data.color === node.data.color &&
        previous.data.bold === node.data.bold &&
        previous.data.italic === node.data.italic &&
        previous.data.strikethrough === node.data.strikethrough &&
        previous.data.editable === node.data.editable &&
        previous.data.editing === node.data.editing &&
        previous.data.maxLength === node.data.maxLength &&
        previous.data.onEditingChange === node.data.onEditingChange &&
        previous.data.historyGroup === node.data.historyGroup &&
        previous.data.onReuse === node.data.onReuse &&
        previous.selected === node.selected &&
        previous.measured?.width === node.measured?.width &&
        previous.measured?.height === node.measured?.height
        ? previous
        : node
    })
    const visibleGroups = groups.filter((group) => {
      const count = group.relations.filter((id) => selectedRelationIds.has(id)).length
      return count === 0 || count === group.relations.length
    })
    const grouped = new Set(visibleGroups.flatMap((group) => group.relations))
    const edges: RelationEdge[] = graph.relations
      .filter((relation) => !grouped.has(relationKey(relation)))
      .map((relation) => {
        const selected = selectedRelationIds.has(relationKey(relation))
        return {
          ...relationEdge(relation, selected, reconnectable, indexed, defaultTypeId, sizes),
          ariaLabel: label(relation),
          data: {
            bend: relation.bend,
            editable: interactive && selected && relation.source !== relation.target,
          },
        }
      })
    const boxes = new Map<string, ConceptBounds>(
      graph.concepts.map(({ id, position }) => [
        id,
        { position, ...(sizes[id] ?? conceptNodeMinSize) },
      ]),
    )
    for (const group of visibleGroups) {
      const id = `#group:${group.frame}`
      const names = group.members.map((id) => indexed.concepts.get(id)!.label).join(', ')
      const node: ConceptNode = {
        id,
        type: 'relationGroup',
        position: { x: group.bounds.x, y: group.bounds.y },
        width: group.bounds.width,
        height: group.bounds.height,
        measured: { width: group.bounds.width, height: group.bounds.height },
        style: { width: group.bounds.width, height: group.bounds.height },
        data: { label: names, members: group.members, onGroupSelect, editable: editing?.enabled },
        ariaLabel: names,
        selectable: false,
        draggable: false,
        connectable: false,
        deletable: false,
        zIndex: -1,
        className: `graph-relation-group${visibleGroups.some(({ frame, key }) => frame === group.frame && preview.has(key)) ? ' graph-group-preview' : ''}${group.members.every((id) => selectedConcepts.has(id)) ? ' graph-group-selected' : ''}`,
      }
      const before = previousNodes.get(id)
      if (!boxes.has(id))
        nodes.unshift(
          before &&
            before.position.x === node.position.x &&
            before.position.y === node.position.y &&
            before.width === node.width &&
            before.height === node.height &&
            before.data.label === names &&
            before.className === node.className &&
            before.data.onGroupSelect === onGroupSelect &&
            before.data.editable === node.data.editable
            ? before
            : node,
        )
      boxes.set(id, { position: node.position, ...group.bounds })
      const concept = { id, label: names, position: node.position }
      const groupIndex = { ...indexed, concepts: new Map([...indexed.concepts, [id, concept]]) }
      const relation = {
        source: group.direction === 'out' ? group.anchor : id,
        target: group.direction === 'out' ? id : group.anchor,
        predicate: group.predicate,
      }
      const endpoint = group.direction === 'out' ? 'source' : 'target'
      edges.push({
        ...relationEdge(
          relation,
          group.relations.every((id) => selectedRelationIds.has(id)),
          reconnectable === true || reconnectable === endpoint ? endpoint : false,
          groupIndex,
          defaultTypeId,
          { ...sizes, [id]: group.bounds },
        ),
        id: `#group:${group.key}`,
        data: { relations: group.relations },
        ariaLabel: group.members
          .map((member) =>
            label({
              ...relation,
              ...(group.direction === 'out' ? { target: member } : { source: member }),
            }),
          )
          .join('; '),
      })
    }
    const automatic = spreadEndpoints(
      edges.map((edge) => {
        if (!edge.data?.bend) return edge
        const sides = relationSides(boxes.get(edge.source)!, boxes.get(edge.target)!)
        return { ...edge, sourceHandle: sides.source, targetHandle: sides.target }
      }),
      boxes,
    )
    const routed = edges.some((edge) => edge.data?.bend) ? spreadEndpoints(edges, boxes) : automatic
    const spread = routed.map((edge, index) => {
      edge = {
        ...edge,
        data: {
          ...edge.data,
          sourceReferenceOffset: automatic[index].data?.sourceOffset ?? 0,
          targetReferenceOffset: automatic[index].data?.targetOffset ?? 0,
        },
      }
      const previous = previousEdges.get(edge.id)
      return previous && sameEdge(previous, edge) ? previous : edge
    })
    if (nodes.length !== nodeList.length || nodes.some((node, index) => node !== nodeList[index])) {
      nodeList = nodes
      previousNodes = new Map(nodes.map((node) => [node.id, node]))
    }
    if (
      spread.length !== edgeList.length ||
      spread.some((edge, index) => edge !== edgeList[index])
    ) {
      edgeList = spread
      previousEdges = new Map(spread.map((edge) => [edge.id, edge]))
    }
    return { nodes: nodeList, edges: edgeList }
  }
}
