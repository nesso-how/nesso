import { schemaContext } from './core.ts'
import { validateGraph } from './validate.ts'
import type { Concept, Graph, Relation, RelationType } from './types.ts'

type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a JSON object')
  }
  return value as JsonObject
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected a string')
  return value
}

function iri(value: unknown): string {
  const id = string(value)
  if (!/^[a-z][a-z0-9+.-]*:/i.test(id)) throw new Error(`Expected an absolute IRI: ${id}`)
  return id
}

export function parseGraph(value: unknown): Graph {
  const document = object(value)
  if (Object.keys(document).some((key) => key !== '@context' && key !== '@graph')) {
    throw new Error('Unsupported document property')
  }
  const context = object(document['@context'])
  for (const term of ['rdf', 'rdfs', 'tags', 'position'] as const) {
    const expected = schemaContext[term]
    const actual = context[term]
    if (typeof expected === 'string') {
      if (actual !== expected) throw new Error(`Unsupported context term: ${term}`)
    } else {
      const mapping = object(actual)
      if (mapping['@id'] !== expected['@id'] || mapping['@type'] !== expected['@type']) {
        throw new Error(`Unsupported context term: ${term}`)
      }
    }
  }
  if (!Array.isArray(document['@graph'])) throw new Error('Expected @graph array')

  const predicates = new Map<string, string>()
  for (const [term, definition] of Object.entries(context)) {
    if (definition && typeof definition === 'object' && !Array.isArray(definition)) {
      const mapping = object(definition)
      if (mapping['@type'] === '@id') predicates.set(term, iri(mapping['@id']))
    }
  }

  const concepts: Concept[] = []
  const relationTypes: RelationType[] = []
  const entries: JsonObject[] = document['@graph'].map(object)
  for (const entry of entries) {
    const id = iri(entry['@id'])
    const label = string(entry['rdfs:label'])
    if (entry['@type'] === 'rdf:Property') {
      if (Object.keys(entry).some((key) => !['@id', '@type', 'rdfs:label'].includes(key))) {
        throw new Error(`Unsupported relation type property: ${id}`)
      }
      relationTypes.push({ id, label })
      continue
    }
    if (entry['@type'] !== undefined) throw new Error(`Unsupported concept type: ${id}`)
    const tags = entry.tags === undefined ? [] : entry.tags
    if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) {
      throw new Error(`Invalid tags: ${id}`)
    }
    const position = entry.position === undefined ? { x: 0, y: 0 } : object(entry.position)
    if (typeof position.x !== 'number' || typeof position.y !== 'number') {
      throw new Error(`Invalid position: ${id}`)
    }
    concepts.push({ id, label, tags, position: { x: position.x, y: position.y } })
  }

  const known = new Set(relationTypes.map((type) => type.id))
  const relations: Relation[] = []
  for (const entry of entries) {
    if (entry['@type'] === 'rdf:Property') continue
    for (const [term, value] of Object.entries(entry)) {
      if (['@id', 'rdfs:label', 'tags', 'position'].includes(term)) continue
      const predicate = predicates.get(term) ?? (known.has(term) ? term : undefined)
      if (!predicate || !known.has(predicate)) throw new Error(`Unsupported property: ${term}`)
      for (const target of Array.isArray(value) ? value : [value]) {
        relations.push({ source: iri(entry['@id']), predicate, target: iri(object(target)['@id']) })
      }
    }
  }
  const graph = { concepts, relationTypes, relations }
  const errors = validateGraph(graph)
  if (errors.length) throw new Error(errors.join('\n'))
  return graph
}

export function serializeGraph(graph: Graph): JsonObject {
  const errors = validateGraph(graph)
  if (errors.length) throw new Error(errors.join('\n'))

  const entries: JsonObject[] = graph.relationTypes.map(({ id, label }) => ({
    '@id': id, '@type': 'rdf:Property', 'rdfs:label': label,
  }))
  for (const concept of graph.concepts) {
    const entry: JsonObject = {
      '@id': concept.id,
      'rdfs:label': concept.label,
      tags: concept.tags,
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
