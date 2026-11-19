import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseGraph,
  serializeGraph,
  validateGraph,
  schemaContext,
  SchemaError,
} from '../src/index.ts'

const relation = { source: 'urn:a', predicate: 'urn:p', target: 'urn:b' }
const graph = {
  concepts: ['urn:a', 'urn:b', 'urn:c'].map((id) => ({ id, label: id })),
  relationTypes: [{ id: 'urn:p', label: 'links' }],
  relations: [relation, { ...relation, target: 'urn:a' }],
}
const map = {
  id: 'urn:map',
  name: 'Map',
  members: graph.concepts.map(({ id }) => ({ id, position: { x: 0, y: 0 } })),
  relationBends: [{ ...relation, bend: -0.25 }],
}

test('map relation bends survive JSON-LD round trips without changing semantic triples', () => {
  const document = serializeGraph(graph, [map])
  assert.equal(document.schemaVersion, 4)
  assert.deepEqual(parseGraph(document), { graph, maps: [map] })
})

test('bends reject unknown, duplicate, self, off-map, zero and nonfinite references and values', () => {
  for (const relationBends of [
    [{ ...relation, target: 'urn:c', bend: 0.2 }],
    [{ ...relation, target: 'urn:a', bend: 0.2 }],
    [map.relationBends[0], map.relationBends[0]],
    [{ ...relation, bend: Infinity }],
    [{ ...relation, bend: 0 }],
  ]) {
    assert.throws(() => serializeGraph(graph, [{ ...map, relationBends }]), SchemaError)
  }
  assert.ok(validateGraph(graph, [{ ...map, members: map.members.slice(0, 1) }]).length)
  const document = serializeGraph(graph, [map])
  assert.throws(
    () =>
      parseGraph({
        ...document,
        '@context': {
          ...schemaContext,
          relationBends: { '@id': 'urn:wrong', '@type': '@json' },
        },
      }),
    /Unsupported context term/,
  )
})

test('profile 2 keeps a predicate aliased to the new context term', () => {
  const document = {
    schemaVersion: 2,
    '@context': { ...schemaContext, relationBends: { '@id': 'urn:p', '@type': '@id' } },
    '@graph': [
      { '@id': 'urn:p', '@type': 'rdf:Property', 'rdfs:label': 'links' },
      { '@id': 'urn:a', 'rdfs:label': 'A', relationBends: [{ '@id': 'urn:b' }] },
      { '@id': 'urn:b', 'rdfs:label': 'B' },
    ],
  }
  assert.deepEqual(parseGraph(document).graph.relations, [relation])
})
