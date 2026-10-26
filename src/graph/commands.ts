import type { GraphSnapshot, NessoOperation, Selection } from '@nesso-how/plugin'
import { newIri, parseGraph, relationKey, SchemaError, serializeGraph, type Position } from '@nesso-how/schema'

export const selectionCoversGraph = (selected: Selection, graph: GraphSnapshot): boolean => {
  const concepts = new Set(selected.filter((item) => item.kind === 'concept').map((item) => item.id))
  return graph.concepts.length > 0 && graph.concepts.every((concept) => concepts.has(concept.id))
}

export function copyGraph(graph: GraphSnapshot, selected: Selection): string | null {
  const concepts = new Set(selected.filter((item) => item.kind === 'concept').map((item) => item.id))
  const selectedRelations = new Set(selected.filter((item) => item.kind === 'relation').map((item) => item.id))
  const relations = graph.relations.filter((relation) => selectedRelations.has(relationKey(relation))
    || (concepts.has(relation.source) && concepts.has(relation.target)))
  for (const relation of relations) {
    concepts.add(relation.source)
    concepts.add(relation.target)
  }
  const copied = graph.concepts.filter((concept) => concepts.has(concept.id))
  if (!copied.length) return null
  const types = new Set(relations.map((relation) => relation.predicate))
  return JSON.stringify(serializeGraph({
    concepts: copied,
    relations,
    relationTypes: graph.relationTypes.filter((type) => types.has(type.id)),
  }))
}

export function pasteOperations(text: string, position?: Readonly<Position>, offset = 40): NessoOperation[] {
  let document: unknown
  try {
    document = JSON.parse(text)
  } catch {
    throw new SchemaError([{ path: 'clipboard', message: 'Expected a JSON-LD graph' }])
  }
  const graph = parseGraph(document)
  if (!graph.concepts.length) throw new SchemaError([{ path: 'clipboard', message: 'Expected at least one concept' }])
  const ids = new Map(graph.concepts.map((concept) => [concept.id, newIri()]))
  const origin = graph.concepts.reduce((point, concept) => ({
    x: Math.min(point.x, concept.position.x),
    y: Math.min(point.y, concept.position.y),
  }), { x: Infinity, y: Infinity })
  const delta = position ? { x: position.x - origin.x, y: position.y - origin.y } : { x: offset, y: offset }
  const concepts = graph.concepts.map((concept) => ({
    ...concept,
    id: ids.get(concept.id)!,
    position: { x: concept.position.x + delta.x, y: concept.position.y + delta.y },
  }))
  const relations = graph.relations.map((relation) => ({ ...relation, source: ids.get(relation.source)!, target: ids.get(relation.target)! }))
  return [
    ...concepts.flatMap((concept): NessoOperation[] => [
      { kind: 'selection.set', value: [] },
      { kind: 'concept.add', id: concept.id, position: concept.position },
      { kind: 'concept.label', id: concept.id, value: concept.label },
      ...(concept.description === undefined ? [] : [{ kind: 'concept.description' as const, id: concept.id, value: concept.description }]),
      ...(concept.color === undefined ? [] : [{ kind: 'concept.color' as const, id: concept.id, value: concept.color }]),
      ...(concept.bold === undefined ? [] : [{ kind: 'concept.bold' as const, id: concept.id, value: concept.bold }]),
      ...(concept.italic === undefined ? [] : [{ kind: 'concept.italic' as const, id: concept.id, value: concept.italic }]),
    ]),
    ...relations.map((relation): NessoOperation => ({
      kind: 'relation.connect', source: relation.source, target: relation.target,
      type: graph.relationTypes.find((type) => type.id === relation.predicate)!,
    })),
    { kind: 'selection.set', value: [
      ...concepts.map((concept) => ({ kind: 'concept' as const, id: concept.id })),
      ...relations.map((relation) => ({ kind: 'relation' as const, id: relationKey(relation) })),
    ] },
  ]
}
