import { z } from 'zod'
import { conceptKeys, newIri, schemaContext } from './core.ts'
import { fail, parseSchema, SchemaError } from './errors.ts'
import { validateGraph } from './validate.ts'
import {
  conceptSchema,
  iriSchema,
  presentationSchema,
  type Concept,
  type Graph,
  type Presentation,
  type Relation,
  type RelationType,
  type View,
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
    ...presentationSchema.partial().shape,
  })
  .catchall(z.unknown())
const jsonldView = z.strictObject({
  '@id': iriSchema,
  '@type': z.literal('View'),
  'rdfs:label': z.string(),
  members: z.array(presentationSchema.extend({ concept: z.strictObject({ '@id': iriSchema }) })),
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

function presentation({ position, color, bold, italic }: Partial<Presentation>): Presentation {
  return {
    position: position ? { x: position.x, y: position.y } : { x: 0, y: 0 },
    ...(color === undefined ? {} : { color: color.toLowerCase() }),
    ...(bold === undefined ? {} : { bold }),
    ...(italic === undefined ? {} : { italic }),
  }
}

export function parseGraph(value: unknown): { graph: Graph; views: View[] } {
  const document = parseSchema(jsonldDocument, value)
  const context = document['@context']
  checkTerms(context, ['rdf', 'rdfs', 'position'])

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
  const views: View[] = []
  const inline = new Map<string, Presentation>()
  const entries = document['@graph']
  for (const [index, entry] of entries.entries()) {
    const path = `@graph[${index}]`
    const id = iri(entry['@id'], `${path}.@id`)
    if (entry['@type'] === 'rdf:Property') {
      const type = parseSchema(jsonldType, entry, path)
      relationTypes.push({ id, label: type['rdfs:label'] })
      continue
    }
    if (entry['@type'] === 'View') {
      if (!views.length) checkTerms(context, ['View', 'members', 'concept'])
      const view = parseSchema(jsonldView, entry, path)
      views.push({
        id,
        name: view['rdfs:label'],
        members: view.members.map(({ concept, ...member }) => ({
          id: concept['@id'],
          ...presentation(member),
        })),
      })
      continue
    }
    if (entry['@type'] !== undefined) fail(`${path}.@type`, `Unsupported concept type: ${id}`)
    const parsed = parseSchema(jsonldConcept, entry, path)
    const { position, color, bold, italic } = parsed
    if ([position, color, bold, italic].some((value) => value !== undefined))
      inline.set(id, presentation(parsed))
    concepts.push({
      id,
      label: parsed['rdfs:label'],
      ...(parsed['rdfs:comment'] === undefined ? {} : { notes: parsed['rdfs:comment'] }),
    })
  }
  if (inline.size && views.length) fail('@graph', 'Concept presentation belongs to views')
  if (inline.size)
    views.push({
      id: newIri(),
      name: '',
      members: concepts.map(({ id }) => ({ id, ...(inline.get(id) ?? presentation({})) })),
    })

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
  const issues = validateGraph(graph, views)
  if (issues.length) throw new SchemaError(issues)
  return { graph, views }
}

export function serializeGraph(graph: Graph, views: readonly View[] = []): JsonObject {
  const issues = validateGraph(graph, views)
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
    '@context': structuredClone(schemaContext),
    '@graph': [
      ...entries,
      ...concepts.values(),
      ...views.map(({ id, name, members }) => ({
        '@id': id,
        '@type': 'View',
        'rdfs:label': name,
        members: members.map(({ id, position, color, bold, italic }) => ({
          concept: { '@id': id },
          position: { x: position.x, y: position.y },
          ...(color === undefined ? {} : { color }),
          ...(bold === undefined ? {} : { bold }),
          ...(italic === undefined ? {} : { italic }),
        })),
      })),
    ],
  }
}
