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
  const sourceHandle =
    relation.source === relation.target ? Position.Right : facingSide(source, target)
  const targetHandle =
    relation.source === relation.target ? Position.Top : facingSide(target, source)
  return {
    id: relationKey(relation),
    source: relation.source,
    target: relation.target,
    sourceHandle,
    targetHandle,
    className: `graph-source-${sourceHandle} graph-target-${targetHandle}`,
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
    groups = [],
    preview = new Set(),
    onGroupSelect,
  }: {
    graph: PresentedGraph
    indexed: ReturnType<typeof indexGraph>
    selected: Selection
    sizes: ConceptNodeSizes
    defaultTypeId?: string
    label: (relation: RelationView) => string
    groups?: readonly RelationGroup[]
    preview?: ReadonlySet<string>
    onGroupSelect?: ConceptNode['data']['onGroupSelect']
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
    const visibleGroups = groups.filter((group) => {
      const count = group.relations.filter((id) => selectedRelationIds.has(id)).length
      return count === 0 || count === group.relations.length
    })
    const grouped = new Set(visibleGroups.flatMap((group) => group.relations))
    const edges = graph.relations
      .filter((relation) => !grouped.has(relationKey(relation)))
      .map((relation) => {
        const edge = {
          ...relationEdge(
            relation,
            selectedRelationIds.has(relationKey(relation)),
            reconnectable,
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
    for (const group of visibleGroups) {
      const id = `#group:${group.key}`
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
        className: `graph-relation-group${preview.has(group.key) ? ' graph-group-preview' : ''}${group.members.every((id) => selectedConcepts.has(id)) ? ' graph-group-selected' : ''}`,
      }
      const before = previousNodes.get(id)
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
      const concept = { id, label: names, position: node.position }
      const groupIndex = { ...indexed, concepts: new Map([...indexed.concepts, [id, concept]]) }
      const relation = {
        source: group.direction === 'out' ? group.anchor : id,
        target: group.direction === 'out' ? id : group.anchor,
        predicate: group.predicate,
      }
      const endpoint = group.direction === 'out' ? 'source' : 'target'
      const edge: RelationEdge = {
        ...relationEdge(
          relation,
          group.relations.every((id) => selectedRelationIds.has(id)),
          reconnectable === true || reconnectable === endpoint ? endpoint : false,
          groupIndex,
          defaultTypeId,
          { ...sizes, [id]: group.bounds },
        ),
        id,
        data: { relations: group.relations },
        ariaLabel: group.members
          .map((member) =>
            label({
              ...relation,
              ...(group.direction === 'out' ? { target: member } : { source: member }),
            }),
          )
          .join('; '),
      }
      const old = previousEdges.get(id)
      edges.push(
        old &&
          old.sourceHandle === edge.sourceHandle &&
          old.targetHandle === edge.targetHandle &&
          old.label === edge.label &&
          old.ariaLabel === edge.ariaLabel &&
          old.selected === edge.selected &&
          old.reconnectable === edge.reconnectable
          ? old
          : edge,
      )
    }
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
