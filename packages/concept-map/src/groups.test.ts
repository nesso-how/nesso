import assert from 'node:assert/strict'
import test from 'node:test'
import type { Graph } from '@nesso-how/schema'
import { groupRelations, keepGroups } from './groups.ts'

const concept = (id: string, x: number, y = 0) => ({
  id: `urn:${id}`,
  label: id,
  position: { x, y },
})
const relation = (source: string, target: string, predicate = 'urn:p') => ({
  source: `urn:${source}`,
  target: `urn:${target}`,
  predicate,
})
const fixture = (): Graph => ({
  concepts: [concept('a', 0, -200), concept('b', 0), concept('c', 120), concept('d', 240)],
  relations: [relation('a', 'b'), relation('a', 'c'), relation('a', 'd')],
  relationTypes: [
    { id: 'urn:p', label: 'same' },
    { id: 'urn:q', label: 'same' },
  ],
})

test('groups fan-out and fan-in without changing positions or relations', () => {
  const graph = fixture()
  for (const item of graph.concepts) item.position.x -= 1000
  const original = structuredClone(graph)
  const out = groupRelations(graph)
  assert.equal(out.length, 1)
  assert.equal(out[0].direction, 'out')
  assert.deepEqual(out[0].members, ['urn:b', 'urn:c', 'urn:d'])
  assert.deepEqual(out[0].bounds, { x: -1012, y: -12, width: 364, height: 68 })
  assert.deepEqual(graph, original)
  graph.relations = graph.relations.map(({ source, target, predicate }) => ({
    source: target,
    target: source,
    predicate,
  }))
  assert.equal(groupRelations(graph)[0].direction, 'in')
})

test('partial clusters and distinct clusters retain unique identities', () => {
  const graph = fixture()
  graph.concepts[3].position.x = 500
  assert.deepEqual(groupRelations(graph)[0].members, ['urn:b', 'urn:c'])
  graph.concepts.push(concept('e', 620))
  graph.relations.push(relation('a', 'e'))
  const groups = groupRelations(graph)
  assert.equal(groups.length, 2)
  assert.notEqual(groups[0].key, groups[1].key)
  assert.equal(keepGroups(groups).values().next().value!.length, 2)
})

test('hysteresis retains members to 48 px but returning members need 28 px', () => {
  const graph = fixture()
  let kept = keepGroups(groupRelations(graph))
  graph.concepts[3].position.x = 268
  assert.equal(groupRelations({ ...graph, kept })[0].members.length, 3)
  assert.equal(groupRelations(graph)[0].members.length, 2)
  graph.concepts[3].position.x = 269
  const split = groupRelations({ ...graph, kept })
  assert.equal(split[0].members.length, 2)
  kept = keepGroups(split)
  graph.concepts[3].position.x = 260
  assert.equal(groupRelations({ ...graph, kept })[0].members.length, 2)
  graph.concepts[3].position.x = 248
  assert.equal(groupRelations({ ...graph, kept })[0].members.length, 3)
})

test('displayed context, anchors and padded bounds are obstacles', () => {
  const graph = fixture()
  assert.equal(groupRelations({ ...graph, obstacles: [concept('outside', 108, 35)] }).length, 0)
  graph.concepts[0].position = { x: 108, y: 35 }
  assert.equal(groupRelations(graph).length, 0)
})

test('largest candidate wins, then a kept candidate, independently of relation order', () => {
  const graph = fixture()
  graph.concepts.push(concept('k', 500, -200))
  graph.relations.push(relation('k', 'b', 'urn:q'), relation('k', 'c', 'urn:q'))
  assert.equal(groupRelations(graph)[0].anchor, 'urn:a')
  graph.relations = graph.relations.filter(({ target }) => target !== 'urn:d')
  const onlyK = groupRelations({
    ...graph,
    relations: graph.relations.filter(({ source }) => source === 'urn:k'),
  })
  const kept = keepGroups(onlyK)
  assert.equal(groupRelations({ ...graph, kept })[0].anchor, 'urn:k')
  assert.deepEqual(
    groupRelations({ ...graph, relations: [...graph.relations].reverse(), kept }),
    groupRelations({ ...graph, kept }),
  )
})

test('identical type labels do not combine predicates, and sizes affect closeness', () => {
  const graph = fixture()
  graph.relations = [relation('a', 'b'), relation('a', 'c', 'urn:q')]
  assert.equal(groupRelations(graph).length, 0)
  graph.relations[1].predicate = 'urn:p'
  graph.concepts[3].position.x = 500
  graph.concepts[2].position.x = 170
  assert.equal(groupRelations(graph).length, 0)
  assert.equal(
    groupRelations({ ...graph, sizes: { 'urn:b': { width: 150, height: 44 } } }).length,
    1,
  )
})
