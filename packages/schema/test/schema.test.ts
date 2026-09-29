import assert from 'node:assert/strict'
import test from 'node:test'
import { parseGraph, relationKey, schemaContext, serializeGraph, validateGraph } from '../src/index.ts'

const predicate = 'https://example.org/relation/connects'
const subject = 'https://example.org/concept/one'
const targets = ['https://example.org/concept/two', 'https://example.org/concept/three']

const fixture = {
  '@context': { ...schemaContext, connects: { '@id': predicate, '@type': '@id' } },
  '@graph': [
    { '@id': predicate, '@type': 'rdf:Property', 'rdfs:label': 'connects' },
    {
      '@id': subject, 'rdfs:label': 'One', tags: ['Example'], position: { x: 10, y: 20 },
      connects: targets.map((id) => ({ '@id': id })),
    },
    { '@id': targets[0], 'rdfs:label': 'Two', position: { x: 30, y: 40 } },
    { '@id': targets[1], 'rdfs:label': 'Three', position: { x: 50, y: 60 } },
  ],
}

test('a graph with compact and custom predicates survives a JSON-LD round trip', () => {
  const graph = parseGraph(fixture)
  const custom = 'urn:uuid:82d7d311-382c-45ee-9ec6-7e3b247d489b'
  graph.relationTypes.push({ id: custom, label: 'supports' })
  graph.relations.push(...targets.map((target) => ({ source: subject, predicate: custom, target })))
  const restored = parseGraph(serializeGraph(graph))
  assert.deepEqual(restored.concepts, graph.concepts)
  assert.deepEqual(restored.relationTypes, graph.relationTypes)
  assert.deepEqual(restored.relations.map(relationKey).sort(), graph.relations.map(relationKey).sort())
})

test('missing references are rejected instead of disappearing on export', () => {
  const graph = parseGraph(fixture)
  graph.relations.push({ source: subject, predicate, target: 'urn:uuid:missing' })
  assert.match(validateGraph(graph).join('\n'), /Unknown concept/)
  assert.throws(() => serializeGraph(graph), /Unknown concept/)
})
