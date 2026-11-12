import type {
  GraphSnapshot,
  NessoOperation,
  NessoState,
  Selection,
  ViewGraphSnapshot,
} from '@nesso-how/core'
import {
  newIri,
  parseGraph,
  relationKey,
  SchemaError,
  serializeGraph,
  type Position,
} from '@nesso-how/schema'

export const graphSelection = (graph: GraphSnapshot): Selection => [
  ...graph.concepts.map(({ id }) => ({ kind: 'concept' as const, id })),
  ...graph.relations.map((relation) => ({ kind: 'relation' as const, id: relationKey(relation) })),
]

export const selectionCoversGraph = (selected: Selection, graph: GraphSnapshot): boolean => {
  const concepts = new Set(
    selected.filter((item) => item.kind === 'concept').map((item) => item.id),
  )
  return graph.concepts.length > 0 && graph.concepts.every((concept) => concepts.has(concept.id))
}

type DeletionState = Pick<NessoState, 'selected' | 'workspace'>

const inOtherView = ({ workspace }: DeletionState, id: string) =>
  workspace.savedViews.some(
    (view) => view.id !== workspace.activeViewId && view.members.some((member) => member.id === id),
  )

export const deleteOperations = (state: DeletionState): NessoOperation[] => {
  const viewId = state.workspace.activeViewId
  return state.selected.map(({ kind, id }): NessoOperation => {
    if (kind === 'relation') return { kind: 'relation.remove', id }
    return viewId && inOtherView(state, id)
      ? { kind: 'view.membership', viewId, conceptId: id, included: false }
      : { kind: 'concept.remove', id }
  })
}

export const deletionNeedsConfirmation = (state: DeletionState): boolean =>
  state.workspace.activeViewId === null &&
  state.selected.some(({ kind, id }) => kind === 'concept' && inOtherView(state, id))

export function copyGraph(graph: ViewGraphSnapshot, selected: Selection): string | null {
  const concepts = new Set(
    selected.filter((item) => item.kind === 'concept').map((item) => item.id),
  )
  const selectedRelations = new Set(
    selected.filter((item) => item.kind === 'relation').map((item) => item.id),
  )
  const relations = graph.relations.filter(
    (relation) =>
      selectedRelations.has(relationKey(relation)) ||
      (concepts.has(relation.source) && concepts.has(relation.target)),
  )
  for (const relation of relations) {
    concepts.add(relation.source)
    concepts.add(relation.target)
  }
  const copied = graph.concepts.filter((concept) => concepts.has(concept.id))
  if (!copied.length) return null
  const types = new Set(relations.map((relation) => relation.predicate))
  const members = copied.flatMap(({ id, position, color, bold, italic }) =>
    position ? [{ id, position, color, bold, italic }] : [],
  )
  return JSON.stringify(
    serializeGraph(
      {
        concepts: copied.map(({ id, label, notes }) => ({ id, label, notes })),
        relations,
        relationTypes: graph.relationTypes.filter((type) => types.has(type.id)),
      },
      members.length ? [{ id: newIri(), name: '', members }] : [],
    ),
  )
}

export function pasteOperations(
  text: string,
  position?: Readonly<Position>,
  offset = 40,
  inView = true,
  reuse?: { readonly graph: GraphSnapshot; readonly viewId: string | null },
): NessoOperation[] {
  let document: unknown
  try {
    document = JSON.parse(text)
  } catch {
    throw new SchemaError([{ path: 'clipboard', message: 'Expected a JSON-LD graph' }])
  }
  const { graph, views } = parseGraph(document)
  if (!graph.concepts.length)
    throw new SchemaError([{ path: 'clipboard', message: 'Expected at least one concept' }])
  const kept = new Set(reuse?.graph.concepts.map(({ id }) => id))
  const linked = new Set(reuse?.graph.relations.map(relationKey))
  const ids = new Map(
    graph.concepts.map((concept) => [concept.id, kept.has(concept.id) ? concept.id : newIri()]),
  )
  const members = inView ? (views[0]?.members ?? []) : []
  const origin = members.reduce(
    (point, { position }) => ({
      x: Math.min(point.x, position.x),
      y: Math.min(point.y, position.y),
    }),
    { x: Infinity, y: Infinity },
  )
  const delta = position
    ? { x: position.x - origin.x, y: position.y - origin.y }
    : { x: offset, y: offset }
  const presentation = new Map(
    members.map((member) => [
      member.id,
      {
        ...member,
        position: { x: member.position.x + delta.x, y: member.position.y + delta.y },
      },
    ]),
  )
  const concepts = graph.concepts.map((concept) => ({
    ...concept,
    ...presentation.get(concept.id),
    id: ids.get(concept.id)!,
  }))
  const relations = graph.relations.map((relation) => ({
    ...relation,
    source: ids.get(relation.source)!,
    target: ids.get(relation.target)!,
  }))
  return [
    ...concepts.flatMap((concept): NessoOperation[] => {
      const style: NessoOperation[] = [
        ...(concept.color === undefined
          ? []
          : [{ kind: 'concept.color' as const, id: concept.id, value: concept.color }]),
        ...(concept.bold === undefined
          ? []
          : [{ kind: 'concept.bold' as const, id: concept.id, value: concept.bold }]),
        ...(concept.italic === undefined
          ? []
          : [{ kind: 'concept.italic' as const, id: concept.id, value: concept.italic }]),
      ]
      if (!kept.has(concept.id))
        return [
          { kind: 'selection.set', value: [] },
          { kind: 'concept.add', id: concept.id, position: concept.position },
          { kind: 'concept.label', id: concept.id, value: concept.label },
          ...(concept.notes === undefined
            ? []
            : [{ kind: 'concept.notes' as const, id: concept.id, value: concept.notes }]),
          ...style,
        ]
      if (!reuse?.viewId) return []
      return [
        { kind: 'view.membership', viewId: reuse.viewId, conceptId: concept.id, included: true },
        ...(concept.position
          ? [{ kind: 'concept.position' as const, id: concept.id, value: concept.position }]
          : []),
        ...style,
      ]
    }),
    ...relations
      .filter((relation) => !linked.has(relationKey(relation)))
      .map((relation): NessoOperation => ({
        kind: 'relation.connect',
        source: relation.source,
        target: relation.target,
        type: graph.relationTypes.find((type) => type.id === relation.predicate)!,
      })),
    {
      kind: 'selection.set',
      value: [
        ...concepts.map((concept) => ({ kind: 'concept' as const, id: concept.id })),
        ...relations.map((relation) => ({ kind: 'relation' as const, id: relationKey(relation) })),
      ],
    },
  ]
}
