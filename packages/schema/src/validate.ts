import { relationKey } from './core.ts'
import type { Graph } from './types.ts'

export function validateGraph(graph: Graph): string[] {
  const errors: string[] = []
  const concepts = new Set<string>()
  const types = new Set<string>()
  const relations = new Set<string>()

  for (const concept of graph.concepts) {
    if (!concept.id || concepts.has(concept.id)) errors.push(`Duplicate or missing concept IRI: ${concept.id}`)
    concepts.add(concept.id)
    if (!Number.isFinite(concept.position.x) || !Number.isFinite(concept.position.y)) {
      errors.push(`Invalid position: ${concept.id}`)
    }
  }
  for (const type of graph.relationTypes) {
    if (!type.id || types.has(type.id) || concepts.has(type.id)) {
      errors.push(`Duplicate or missing relation IRI: ${type.id}`)
    }
    types.add(type.id)
  }
  for (const relation of graph.relations) {
    if (!concepts.has(relation.source) || !concepts.has(relation.target)) {
      errors.push(`Unknown concept in relation: ${relationKey(relation)}`)
    }
    if (!types.has(relation.predicate)) errors.push(`Unknown relation type: ${relation.predicate}`)
    const key = relationKey(relation)
    if (relations.has(key)) errors.push(`Duplicate relation: ${key}`)
    relations.add(key)
  }
  return errors
}
