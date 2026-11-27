import assert from 'node:assert/strict'
import test from 'node:test'
import { createNessoStore } from '../../src/store/create.ts'
import { defaultGraphOptions, generateGraph } from './generate.ts'

test('generated graphs are valid, deterministic, and keep maps small', () => {
  const options = defaultGraphOptions(500)
  const { graph, workspace } = generateGraph(options)
  assert.deepEqual(generateGraph(options), { graph, workspace })
  assert.notDeepEqual(generateGraph({ ...options, seed: 2 }).graph, graph)
  const { mapGraph } = createNessoStore(graph, { workspace }).store.getState()
  assert.equal(graph.concepts.length, 500)
  assert.equal(graph.relations.length, 750)
  assert.equal(workspace.maps.length, 5)
  assert.equal(mapGraph.concepts.length, 30)
  assert.ok(mapGraph.relations.length > 0)
})
