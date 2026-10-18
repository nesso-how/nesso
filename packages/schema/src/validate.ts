import { isAbsoluteIri, relationKey } from './core.ts'
import type { SchemaIssue } from './errors.ts'
import type { Concept, Relation, RelationType } from './types.ts'

export function validateGraph(graph: {
  readonly concepts: readonly Readonly<Concept>[]
  readonly relationTypes: readonly Readonly<RelationType>[]
  readonly relations: readonly Readonly<Relation>[]
}): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const concepts = new Set<string>()
  const types = new Set<string>()
  const relations = new Set<string>()

  for (const [index, concept] of graph.concepts.entries()) {
    if (!isAbsoluteIri(concept.id)) {
      issues.push({ path: `concepts[${index}].id`, message: `Expected an absolute IRI: ${concept.id}` })
    } else if (concepts.has(concept.id)) {
      issues.push({ path: `concepts[${index}].id`, message: `Duplicate concept IRI: ${concept.id}` })
    }
    concepts.add(concept.id)
    if (concept.description !== undefined && typeof concept.description !== 'string') {
      issues.push({ path: `concepts[${index}].description`, message: 'Expected a string' })
    }
    if (!Number.isFinite(concept.position.x) || !Number.isFinite(concept.position.y)) {
      issues.push({ path: `concepts[${index}].position`, message: `Invalid position: ${concept.id}` })
    }
    if (concept.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(concept.color)) {
      issues.push({ path: `concepts[${index}].color`, message: `Invalid color: ${concept.id}` })
    }
  }
  for (const [index, type] of graph.relationTypes.entries()) {
    if (!isAbsoluteIri(type.id)) {
      issues.push({ path: `relationTypes[${index}].id`, message: `Expected an absolute IRI: ${type.id}` })
    } else if (types.has(type.id) || concepts.has(type.id)) {
      issues.push({ path: `relationTypes[${index}].id`, message: `Duplicate relation IRI: ${type.id}` })
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
