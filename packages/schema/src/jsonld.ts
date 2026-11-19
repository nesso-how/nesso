import { z } from 'zod'
import { conceptKeys, schemaContext } from './core.ts'
import { fail, parseSchema, SchemaError } from './errors.ts'
import { migrateGraph } from './migrations.ts'
import { validateGraph } from './validate.ts'
import {
  conceptSchema,
  iriSchema,
  presentationSchema,
  relationBendSchema,
  type Concept,
  type Graph,
  type Relation,
  type RelationType,
  type ConceptMap,
} from './types.ts'

type JsonObject = Record<string, unknown>
const jsonObject = z.record(z.string(), z.unknown())
const jsonldDocument = z.strictObject({
  schemaVersion: z.literal(4),
  '@context': jsonObject,
  '@graph': z.array(jsonObject),
})
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
  })
  .catchall(z.unknown())
const jsonldMap = z.strictObject({
  '@id': iriSchema,
  '@type': z.literal('Map'),
  'rdfs:label': z.string(),
  members: z.array(presentationSchema.extend({ concept: z.strictObject({ '@id': iriSchema }) })),
  relationBends: z.array(relationBendSchema).optional(),
})

function object(value: unknown, path: string): JsonObject {
  return parseSchema(jsonObject, value, path)
}

function iri(value: unknown, path: string): string {
  return parseSchema(iriSchema, value, path)
}

function checkTerms(context: JsonObject, terms: readonly (keyof typeof schemaContext)[]): void {
  for (const term of terms) {
    const expected = schemaContext[term]
    const actual = context[term]
    if (typeof expected === 'string') {
      if (actual !== expected) fail(`@context.${term}`, 'Unsupported context term')
    } else {
      const mapping = object(actual, `@context.${term}`)
      if (
        mapping['@id'] !== expected['@id'] ||
        mapping['@type'] !== ('@type' in expected ? expected['@type'] : undefined)
      ) {
        fail(`@context.${term}`, 'Unsupported context term')
      }
    }
  }
}

export function parseGraph(value: unknown): { graph: Graph; maps: ConceptMap[] } {
  const document = parseSchema(jsonldDocument, migrateGraph(value))
  const context = document['@context']
  checkTerms(context, ['rdf', 'rdfs', 'schemaVersion', 'position'])

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
  const maps: ConceptMap[] = []
  const entries = document['@graph']
  for (const [index, entry] of entries.entries()) {
    const path = `@graph[${index}]`
    const id = iri(entry['@id'], `${path}.@id`)
    if (entry['@type'] === 'rdf:Property') {
      const type = parseSchema(jsonldType, entry, path)
      relationTypes.push({ id, label: type['rdfs:label'] })
      continue
    }
    if (entry['@type'] === 'Map') {
      if (!maps.length) checkTerms(context, ['Map', 'members', 'concept'])
      const map = parseSchema(jsonldMap, entry, path)
      if (map.relationBends !== undefined) checkTerms(context, ['relationBends'])
      maps.push({
        id,
        name: map['rdfs:label'],
        members: map.members.map(({ concept, position, color, bold, italic, strikethrough }) => ({
          id: concept['@id'],
          position,
          ...(color === undefined ? {} : { color: color.toLowerCase() }),
          ...(bold === undefined ? {} : { bold }),
          ...(italic === undefined ? {} : { italic }),
          ...(strikethrough === undefined ? {} : { strikethrough }),
        })),
        ...(map.relationBends === undefined ? {} : { relationBends: map.relationBends }),
      })
      continue
    }
    if (entry['@type'] !== undefined) fail(`${path}.@type`, `Unsupported concept type: ${id}`)
    const parsed = parseSchema(jsonldConcept, entry, path)
    concepts.push({
      id,
      label: parsed['rdfs:label'],
      ...(parsed['rdfs:comment'] === undefined ? {} : { notes: parsed['rdfs:comment'] }),
    })
  }
  const known = new Set(relationTypes.map((type) => type.id))
  const relations: Relation[] = []
  for (const [index, entry] of entries.entries()) {
    if (entry['@type'] !== undefined) continue
    const id = iri(entry['@id'], `@graph[${index}].@id`)
    for (const [term, value] of Object.entries(entry)) {
      if (conceptKeys.includes(term)) continue
      const path = `@graph[${index}].${term}`
      const predicate = predicates.get(term) ?? (known.has(term) ? term : undefined)
      if (!predicate || !known.has(predicate)) fail(path, `Unsupported property: ${term}`)
      for (const target of Array.isArray(value) ? value : [value]) {
        relations.push({ source: id, predicate, target: iri(object(target, path)['@id'], path) })
      }
    }
  }
  const graph = { concepts, relationTypes, relations }
  const issues = validateGraph(graph, maps)
  if (issues.length) throw new SchemaError(issues)
  return { graph, maps }
}

export function serializeGraph(graph: Graph, maps: readonly ConceptMap[] = []): JsonObject {
  const issues = validateGraph(graph, maps)
  if (issues.length) throw new SchemaError(issues)

  const entries: JsonObject[] = graph.relationTypes.map(({ id, label }) => ({
    '@id': id,
    '@type': 'rdf:Property',
    'rdfs:label': label,
  }))
  const concepts = new Map<string, JsonObject>(
    graph.concepts.map(({ id, label, notes }) => [
      id,
      {
        '@id': id,
        'rdfs:label': label,
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
    schemaVersion: 4,
    '@context': structuredClone(schemaContext),
    '@graph': [
      ...entries,
      ...concepts.values(),
      ...maps.map(({ id, name, members, relationBends }) => ({
        '@id': id,
        '@type': 'Map',
        'rdfs:label': name,
        members: members.map(({ id, position, color, bold, italic, strikethrough }) => ({
          concept: { '@id': id },
          position: { x: position.x, y: position.y },
          ...(color === undefined ? {} : { color }),
          ...(bold === undefined ? {} : { bold }),
          ...(italic === undefined ? {} : { italic }),
          ...(strikethrough === undefined ? {} : { strikethrough }),
        })),
        ...(relationBends?.length
          ? { relationBends: relationBends.map((relation) => ({ ...relation })) }
          : {}),
      })),
    ],
  }
}
