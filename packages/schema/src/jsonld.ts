import { z } from 'zod'
import { schemaContext } from './core.ts'
import { fail, parseSchema, SchemaError } from './errors.ts'
import { validateGraph } from './validate.ts'
import {
  conceptSchema,
  iriSchema,
  positionSchema,
  type Concept,
  type Graph,
  type Relation,
  type RelationType,
} from './types.ts'

type JsonObject = Record<string, unknown>
const jsonObject = z.record(z.string(), z.unknown())
const jsonldDocument = z.strictObject({ '@context': jsonObject, '@graph': z.array(jsonObject) })
const jsonldType = z.strictObject({
  '@id': iriSchema,
  '@type': z.literal('rdf:Property'),
  'rdfs:label': z.string(),
})
const jsonldConcept = z
  .object({
    '@id': iriSchema,
    'rdfs:label': conceptSchema.shape.label,
    'rdfs:comment': conceptSchema.shape.notes,
    position: positionSchema.optional(),
    color: conceptSchema.shape.color,
    bold: conceptSchema.shape.bold,
    italic: conceptSchema.shape.italic,
  })
  .catchall(z.unknown())

function object(value: unknown, path: string): JsonObject {
  return parseSchema(jsonObject, value, path)
}

function iri(value: unknown, path: string): string {
  return parseSchema(iriSchema, value, path)
}

export function parseGraph(value: unknown): Graph {
  const document = parseSchema(jsonldDocument, value)
  const context = document['@context']
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

  const predicates = new Map<string, string>()
  for (const [term, definition] of Object.entries(context)) {
    if (definition && typeof definition === 'object' && !Array.isArray(definition)) {
      const mapping = object(definition, `@context.${term}`)
      if (mapping['@type'] === '@id')
        predicates.set(term, iri(mapping['@id'], `@context.${term}.@id`))
    }
  }

  const concepts: Concept[] = []
  const relationTypes: RelationType[] = []
  const entries = document['@graph']
  for (const [index, entry] of entries.entries()) {
    const path = `@graph[${index}]`
    const id = iri(entry['@id'], `${path}.@id`)
    if (entry['@type'] === 'rdf:Property') {
      const type = parseSchema(jsonldType, entry, path)
      relationTypes.push({ id, label: type['rdfs:label'] })
      continue
    }
    if (entry['@type'] !== undefined) fail(`${path}.@type`, `Unsupported concept type: ${id}`)
    const parsed = parseSchema(jsonldConcept, entry, path)
    const position = parsed.position ?? { x: 0, y: 0 }
    const color = parsed.color?.toLowerCase()
    const { bold, italic } = parsed
    concepts.push({
      id,
      label: parsed['rdfs:label'],
      position: { x: position.x, y: position.y },
      ...(color === undefined ? {} : { color }),
      ...(bold === undefined ? {} : { bold }),
      ...(italic === undefined ? {} : { italic }),
      ...(parsed['rdfs:comment'] === undefined ? {} : { notes: parsed['rdfs:comment'] }),
    })
  }

  const known = new Set(relationTypes.map((type) => type.id))
  const relations: Relation[] = []
  for (const [index, entry] of entries.entries()) {
    if (entry['@type'] === 'rdf:Property') continue
    const id = iri(entry['@id'], `@graph[${index}].@id`)
    for (const [term, value] of Object.entries(entry)) {
      if (
        ['@id', 'rdfs:label', 'rdfs:comment', 'position', 'color', 'bold', 'italic'].includes(term)
      )
        continue
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
    '@id': id,
    '@type': 'rdf:Property',
    'rdfs:label': label,
  }))
  const concepts = new Map<string, JsonObject>(
    graph.concepts.map(({ id, label, notes, color, bold, italic, position }) => [
      id,
      {
        '@id': id,
        'rdfs:label': label,
        position,
        ...(color === undefined ? {} : { color }),
        ...(bold === undefined ? {} : { bold }),
        ...(italic === undefined ? {} : { italic }),
        ...(notes === undefined ? {} : { 'rdfs:comment': notes }),
      },
    ]),
  )
  for (const relation of graph.relations) {
    const entry = concepts.get(relation.source)!
    const targets = entry[relation.predicate] as { '@id': string }[] | undefined
    if (targets) targets.push({ '@id': relation.target })
    else entry[relation.predicate] = [{ '@id': relation.target }]
  }
  return {
    '@context': structuredClone(schemaContext),
    '@graph': [...entries, ...concepts.values()],
  }
}
