import { relationKey } from './core.ts'
import type { SchemaIssue } from './errors.ts'
import type { Position, Relation, RelationType } from './types.ts'

export function validateGraph(graph: {
  readonly concepts: readonly { readonly id: string; readonly label: string; readonly position: Readonly<Position> }[]
  readonly relationTypes: readonly Readonly<RelationType>[]
  readonly relations: readonly Readonly<Relation>[]
}): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const concepts = new Set<string>()
  const types = new Set<string>()
  const relations = new Set<string>()

  for (const [index, concept] of graph.concepts.entries()) {
    if (!concept.id || concepts.has(concept.id)) {
      issues.push({ path: `concepts[${index}].id`, message: `Duplicate or missing concept IRI: ${concept.id}` })
    }
    concepts.add(concept.id)
    if (!Number.isFinite(concept.position.x) || !Number.isFinite(concept.position.y)) {
      issues.push({ path: `concepts[${index}].position`, message: `Invalid position: ${concept.id}` })
    }
  }
  for (const [index, type] of graph.relationTypes.entries()) {
    if (!type.id || types.has(type.id) || concepts.has(type.id)) {
      issues.push({ path: `relationTypes[${index}].id`, message: `Duplicate or missing relation IRI: ${type.id}` })
    }
    types.add(type.id)
  }
  for (const [index, relation] of graph.relations.entries()) {
    if (!concepts.has(relation.source) || !concepts.has(relation.target)) {
      issues.push({ path: `relations[${index}]`, message: `Unknown concept in relation: ${relationKey(relation)}` })
    }
    if (!types.has(relation.predicate)) {
      issues.push({ path: `relations[${index}].predicate`, message: `Unknown relation type: ${relation.predicate}` })
    }
    const key = relationKey(relation)
    if (relations.has(key)) issues.push({ path: `relations[${index}]`, message: `Duplicate relation: ${key}` })
    relations.add(key)
  }
  return issues
}
