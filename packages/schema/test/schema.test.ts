import assert from 'node:assert/strict'
import test from 'node:test'
import { NessoError } from '@nesso-how/errors'
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

const parse = (value: unknown) => parseGraph(value).graph

test('a graph with compact and custom predicates survives a JSON-LD round trip', () => {
  const graph = parse(fixture)
  assert.equal(graph.concepts[0].notes, 'A definition.\nAn example.')
  assert.deepEqual(Object.keys(graph.concepts[1]), ['id', 'label'])
  const custom = 'urn:uuid:82d7d311-382c-45ee-9ec6-7e3b247d489b'
  graph.relationTypes.push({ id: custom, label: 'supports' })
  graph.relations.push(...targets.map((target) => ({ source: subject, predicate: custom, target })))
  const original = structuredClone(graph)
  const serialized = serializeGraph(graph)
  assert.equal(serialized.schemaVersion, 1)
  const entry = (serialized['@graph'] as Record<string, unknown>[]).find(
    (entry) => entry['@id'] === subject,
  )!
  assert.equal(entry['rdfs:comment'], graph.concepts[0].notes)
  const { graph: restored, views } = parseGraph(serialized)
  assert.deepEqual(views, [])
  const { schemaVersion: _, ...unversioned } = serialized
  assert.deepEqual(parseGraph(unversioned), { graph, views: [] })
  assert.deepEqual(graph, original)
  assert.deepEqual(restored.concepts, graph.concepts)
  assert.deepEqual(restored.relationTypes, graph.relationTypes)
  assert.deepEqual(
    restored.relations.map(relationKey).sort(),
    graph.relations.map(relationKey).sort(),
  )
})

test('missing references are rejected instead of disappearing on export', () => {
  const graph = parse(fixture)
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
      error.issues.some(({ path }) => path === '@graph[4].position.x'),
  )
})

test('graph structure is validated consistently and schema errors share the common error base', () => {
  const graph = parse(fixture)
  graph.concepts[0].label = undefined as never
  assert.ok(validateGraph(graph).length)
  assert.throws(
    () => serializeGraph(graph),
    (error) => error instanceof SchemaError && error instanceof NessoError,
  )
  for (const graph of [null, {}, { concepts: [null], relationTypes: [], relations: [] }])
    assert.ok(validateGraph(graph).length)
})

test('graph validation and serialization reject relative concept and relation-type identifiers', () => {
  for (const id of ['', 'relative', '/relative', '#fragment', '1invalid:scheme', 42]) {
    for (const kind of ['concepts', 'relationTypes'] as const) {
      const graph = parse(fixture)
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

test('relation types cannot reuse concept property keys at graph and JSON-LD boundaries', () => {
  for (const id of ['rdfs:label', 'rdfs:comment']) {
    const graph = parse(fixture)
    graph.relationTypes[0].id = id
    for (const relation of graph.relations) relation.predicate = id
    assert.ok(
      validateGraph(graph).some(
        (issue) => issue.path === 'relationTypes[0].id' && /Reserved/.test(issue.message),
      ),
    )
    assert.throws(() => serializeGraph(graph), SchemaError)
    assert.throws(
      () =>
        parseGraph({
          '@context': { ...schemaContext, connects: { '@id': id, '@type': '@id' } },
          '@graph': fixture['@graph'].map((entry) =>
            entry['@id'] === predicate ? { ...entry, '@id': id } : entry,
          ),
        }),
      SchemaError,
    )
  }
})

test('notes must be strings at graph and JSON-LD boundaries', () => {
  const graph = parse(fixture)
  graph.concepts[0].notes = 42 as never
  assert.throws(
    () => serializeGraph(graph),
    (error: unknown) =>
      error instanceof SchemaError && error.issues.some(({ path }) => path === 'concepts[0].notes'),
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

test('legacy documents preserve presentation and relation aliases when migrated', () => {
  const { connects: _, ...concept } = fixture['@graph'][1]
  const legacy = {
    '@context': {
      ...Object.fromEntries(
        Object.entries(fixture['@context']).filter(
          ([term]) => !['schemaVersion', 'View', 'members', 'concept'].includes(term),
        ),
      ),
      schemaVersion: { '@id': predicate, '@type': '@id' },
      View: { '@id': predicate, '@type': '@id' },
    },
    '@graph': [
      fixture['@graph'][0],
      {
        ...concept,
        bold: false,
        italic: true,
        schemaVersion: { '@id': targets[0] },
        [predicate]: { '@id': targets[1] },
      },
      { ...fixture['@graph'][2], View: { '@id': subject } },
      { '@id': targets[1], 'rdfs:label': 'Three' },
    ],
  }
  const original = structuredClone(legacy)
  const { graph, views } = parseGraph(legacy)
  assert.deepEqual(graph.concepts[0], {
    id: subject,
    label: 'One',
    notes: 'A definition.\nAn example.',
  })
  assert.deepEqual(
    graph.relations.map(relationKey).sort(),
    [
      { source: subject, predicate, target: targets[0] },
      { source: subject, predicate, target: targets[1] },
      { source: targets[0], predicate, target: subject },
    ]
      .map(relationKey)
      .sort(),
  )
  assert.equal(views.length, 1)
  assert.equal(views[0].name, '')
  assert.deepEqual(views[0].members, [
    { id: subject, position: { x: 10, y: 20 }, color: '#e1ecde', bold: false, italic: true },
    { id: targets[0], position: { x: 30, y: 40 } },
    { id: targets[1], position: { x: 0, y: 0 } },
  ])
  assert.deepEqual(legacy, original)
})

test('views keep their members presentation across a JSON-LD round trip', () => {
  const { graph, views } = parseGraph(fixture)
  const view = {
    id: 'https://example.org/view/project',
    name: 'Project',
    members: [
      { id: targets[1], position: { x: -5, y: 7 }, bold: true, italic: true },
      { ...views[0].members[0] },
    ],
  }
  const serialized = serializeGraph(graph, [view])
  const entries = serialized['@graph'] as Record<string, unknown>[]
  assert.ok(entries.every((entry) => entry['@type'] === 'View' || !('position' in entry)))
  assert.deepEqual(parseGraph(serialized), { graph, views: [view] })
  const { schemaVersion: _, ...unversioned } = serialized
  assert.deepEqual(parseGraph(unversioned), { graph, views: [view] })
})

test('versioned documents reject unknown versions, invalid mappings and legacy presentation', () => {
  const document = serializeGraph(parse(fixture))
  for (const schemaVersion of [2, '1'])
    assert.throws(
      () => parseGraph({ ...document, schemaVersion }),
      (error: unknown) =>
        error instanceof SchemaError && error.issues.some(({ path }) => path === 'schemaVersion'),
    )
  assert.throws(
    () =>
      parseGraph({
        ...document,
        '@context': { ...schemaContext, schemaVersion: { '@id': 'urn:wrong' } },
      }),
    (error: unknown) =>
      error instanceof SchemaError &&
      error.issues.some(({ path }) => path === '@context.schemaVersion'),
  )
  assert.throws(
    () => parseGraph({ ...fixture, schemaVersion: 1 }),
    /Unsupported property: position/,
  )
})

test('views are validated against the graph', () => {
  const graph = parse(fixture)
  const view = (members: { id: string; position: { x: number; y: number } }[]) => ({
    id: 'https://example.org/view/project',
    name: 'Project',
    members,
  })
  const at = { x: 0, y: 0 }
  for (const [views, message] of [
    [[view([{ id: 'urn:uuid:missing', position: at }])], /Unknown view member/],
    [
      [
        view([
          { id: subject, position: at },
          { id: subject, position: at },
        ]),
      ],
      /Duplicate view member/,
    ],
    [[view([]), view([])], /Duplicate view IRI/],
  ] as const) {
    assert.match(
      validateGraph(graph, views)
        .map((issue) => issue.message)
        .join('\n'),
      message,
    )
    assert.throws(() => serializeGraph(graph, views), SchemaError)
  }
})

test('documents cannot mix inline concept presentation with views', () => {
  const { schemaVersion: _, ...serialized } = serializeGraph(parse(fixture), [
    { id: 'https://example.org/view/project', name: 'Project', members: [] },
  ])
  const entries = serialized['@graph'] as Record<string, unknown>[]
  assert.throws(
    () =>
      parseGraph({
        ...serialized,
        '@graph': entries.map((entry) =>
          entry['@id'] === subject ? { ...entry, position: { x: 0, y: 0 } } : entry,
        ),
      }),
    /Concept presentation belongs to views/,
  )
})

test('colors must be six-digit hex strings at view and JSON-LD boundaries', () => {
  for (const color of ['e1ecde', '#abc', 42]) {
    const { graph, views } = parseGraph(fixture)
    views[0].members[0].color = color as never
    assert.throws(() => serializeGraph(graph, views), SchemaError)
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
