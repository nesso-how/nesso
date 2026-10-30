import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseGraph,
  relationKey,
  SchemaError,
  schemaContext,
  serializeGraph,
  validateGraph,
} from '../src/index.ts'

const predicate = 'https://example.org/relation/connects'
const subject = 'https://example.org/concept/one'
const targets = ['https://example.org/concept/two', 'https://example.org/concept/three']

const fixture = {
  '@context': { ...schemaContext, connects: { '@id': predicate, '@type': '@id' } },
  '@graph': [
    { '@id': predicate, '@type': 'rdf:Property', 'rdfs:label': 'connects' },
    {
      '@id': subject,
      'rdfs:label': 'One',
      position: { x: 10, y: 20 },
      'rdfs:comment': 'A definition.\nAn example.',
      color: '#E1ECDE',
      connects: targets.map((id) => ({ '@id': id })),
    },
    { '@id': targets[0], 'rdfs:label': 'Two', position: { x: 30, y: 40 } },
    { '@id': targets[1], 'rdfs:label': 'Three', position: { x: 50, y: 60 } },
  ],
}

test('a graph with compact and custom predicates survives a JSON-LD round trip', () => {
  const graph = parseGraph(fixture)
  assert.equal(graph.concepts[0].description, 'A definition.\nAn example.')
  assert.equal(graph.concepts[0].color, '#e1ecde')
  assert.equal(Object.hasOwn(graph.concepts[1], 'color'), false)
  const custom = 'urn:uuid:82d7d311-382c-45ee-9ec6-7e3b247d489b'
  graph.relationTypes.push({ id: custom, label: 'supports' })
  graph.relations.push(...targets.map((target) => ({ source: subject, predicate: custom, target })))
  const original = structuredClone(graph)
  const restored = parseGraph(serializeGraph(graph))
  assert.deepEqual(graph, original)
  assert.deepEqual(restored.concepts, graph.concepts)
  assert.deepEqual(restored.relationTypes, graph.relationTypes)
  assert.deepEqual(
    restored.relations.map(relationKey).sort(),
    graph.relations.map(relationKey).sort(),
  )
})

test('missing references are rejected instead of disappearing on export', () => {
  const graph = parseGraph(fixture)
  graph.relations.push({ source: subject, predicate, target: 'urn:uuid:missing' })
  assert.match(
    validateGraph(graph)
      .map((issue) => issue.message)
      .join('\n'),
    /Unknown concept/,
  )
  assert.throws(() => serializeGraph(graph), /Unknown concept/)
})

test('parse failures report structured issues', () => {
  const broken = {
    ...fixture,
    '@graph': [
      ...fixture['@graph'],
      { '@id': 'urn:uuid:broken', 'rdfs:label': 'Broken', position: { x: 'bad', y: 0 } },
    ],
  }
  assert.throws(
    () => parseGraph(broken),
    (error: unknown) =>
      error instanceof SchemaError &&
      error.issues.some(
        ({ path, message }) =>
          path === '@graph[4].position' && message === 'Invalid position: urn:uuid:broken',
      ),
  )
})

test('graph validation and serialization reject relative concept and relation-type identifiers', () => {
  for (const id of ['', 'relative', '/relative', '#fragment', '1invalid:scheme', 42]) {
    for (const kind of ['concepts', 'relationTypes'] as const) {
      const graph = parseGraph(fixture)
      graph[kind][0].id = id as never
      assert.ok(
        validateGraph(graph).some(
          (issue) => issue.path === `${kind}[0].id` && /absolute IRI/.test(issue.message),
        ),
      )
      assert.throws(() => serializeGraph(graph), SchemaError)
    }
  }
})

test('descriptions must be strings at graph and JSON-LD boundaries', () => {
  const graph = parseGraph(fixture)
  graph.concepts[0].description = 42 as never
  assert.throws(
    () => serializeGraph(graph),
    (error: unknown) =>
      error instanceof SchemaError &&
      error.issues.some(({ path }) => path === 'concepts[0].description'),
  )
  assert.throws(
    () =>
      parseGraph({
        ...fixture,
        '@graph': fixture['@graph'].map((entry) =>
          entry['@id'] === subject ? { ...entry, 'rdfs:comment': 42 } : entry,
        ),
      }),
    (error: unknown) =>
      error instanceof SchemaError &&
      error.issues.some(({ path }) => path === '@graph[1].rdfs:comment'),
  )
})

test('colors must be six-digit hex strings at graph and JSON-LD boundaries', () => {
  for (const color of ['e1ecde', '#abc', 42]) {
    const graph = parseGraph(fixture)
    graph.concepts[0].color = color as never
    assert.throws(() => serializeGraph(graph), SchemaError)
    assert.throws(
      () =>
        parseGraph({
          ...fixture,
          '@graph': fixture['@graph'].map((entry) =>
            entry['@id'] === subject ? { ...entry, color } : entry,
          ),
        }),
      SchemaError,
    )
  }
})
