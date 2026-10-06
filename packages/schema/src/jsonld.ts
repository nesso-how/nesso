import { schemaContext } from './core.ts'
import { fail, SchemaError } from './errors.ts'
import { validateGraph } from './validate.ts'
import type { Concept, Graph, Relation, RelationType } from './types.ts'

type JsonObject = Record<string, unknown>

function object(value: unknown, path: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'Expected a JSON object')
  return value as JsonObject
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'Expected a string')
  return value
}

function iri(value: unknown, path: string): string {
  const id = string(value, path)
  if (!/^[a-z][a-z0-9+.-]*:/i.test(id)) fail(path, `Expected an absolute IRI: ${id}`)
  return id
}

export function parseGraph(value: unknown): Graph {
  const document = object(value, '')
  if (Object.keys(document).some((key) => key !== '@context' && key !== '@graph')) {
    fail('', 'Unsupported document property')
  }
  const context = object(document['@context'], '@context')
  for (const term of ['rdf', 'rdfs', 'position'] as const) {
    const expected = schemaContext[term]
    const actual = context[term]
    if (typeof expected === 'string') {
      if (actual !== expected) fail(`@context.${term}`, 'Unsupported context term')
    } else {
      const mapping = object(actual, `@context.${term}`)
      if (mapping['@id'] !== expected['@id'] || mapping['@type'] !== expected['@type']) {
        fail(`@context.${term}`, 'Unsupported context term')
      }
    }
  }
  if (!Array.isArray(document['@graph'])) fail('@graph', 'Expected an array')

  const predicates = new Map<string, string>()
  for (const [term, definition] of Object.entries(context)) {
    if (definition && typeof definition === 'object' && !Array.isArray(definition)) {
      const mapping = object(definition, `@context.${term}`)
      if (mapping['@type'] === '@id') predicates.set(term, iri(mapping['@id'], `@context.${term}.@id`))
    }
  }

  const concepts: Concept[] = []
  const relationTypes: RelationType[] = []
  const entries: JsonObject[] = document['@graph'].map((entry, index) => object(entry, `@graph[${index}]`))
  for (const [index, entry] of entries.entries()) {
    const path = `@graph[${index}]`
    const id = iri(entry['@id'], `${path}.@id`)
    const label = string(entry['rdfs:label'], `${path}.rdfs:label`)
    if (entry['@type'] === 'rdf:Property') {
      if (Object.keys(entry).some((key) => !['@id', '@type', 'rdfs:label'].includes(key))) {
        fail(path, `Unsupported relation type property: ${id}`)
      }
      relationTypes.push({ id, label })
      continue
    }
    if (entry['@type'] !== undefined) fail(`${path}.@type`, `Unsupported concept type: ${id}`)
    const position = entry.position === undefined ? { x: 0, y: 0 } : object(entry.position, `${path}.position`)
    if (typeof position.x !== 'number' || typeof position.y !== 'number') {
      fail(`${path}.position`, `Invalid position: ${id}`)
    }
    concepts.push({ id, label, position: { x: position.x, y: position.y } })
  }

  const known = new Set(relationTypes.map((type) => type.id))
  const relations: Relation[] = []
  for (const [index, entry] of entries.entries()) {
    if (entry['@type'] === 'rdf:Property') continue
    const id = iri(entry['@id'], `@graph[${index}].@id`)
    for (const [term, value] of Object.entries(entry)) {
      if (['@id', 'rdfs:label', 'position'].includes(term)) continue
      const path = `@graph[${index}].${term}`
      const predicate = predicates.get(term) ?? (known.has(term) ? term : undefined)
      if (!predicate || !known.has(predicate)) fail(path, `Unsupported property: ${term}`)
      for (const target of Array.isArray(value) ? value : [value]) {
        relations.push({ source: id, predicate, target: iri(object(target, path)['@id'], path) })
      }
    }
  }
  const graph = { concepts, relationTypes, relations }
  const issues = validateGraph(graph)
  if (issues.length) throw new SchemaError(issues)
  return graph
}

export function serializeGraph(graph: Graph): JsonObject {
  const issues = validateGraph(graph)
  if (issues.length) throw new SchemaError(issues)

  const entries: JsonObject[] = graph.relationTypes.map(({ id, label }) => ({
    '@id': id, '@type': 'rdf:Property', 'rdfs:label': label,
  }))
  for (const concept of graph.concepts) {
    const entry: JsonObject = {
      '@id': concept.id,
      'rdfs:label': concept.label,
      position: concept.position,
    }
    for (const relation of graph.relations.filter((item) => item.source === concept.id)) {
      const targets = entry[relation.predicate] as { '@id': string }[] | undefined
      entry[relation.predicate] = [...(targets ?? []), { '@id': relation.target }]
    }
    entries.push(entry)
  }
  return { '@context': structuredClone(schemaContext), '@graph': entries }
}
