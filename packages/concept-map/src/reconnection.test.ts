import assert from 'node:assert/strict'
import test from 'node:test'
import type { GraphSnapshot } from '@nesso-how/core'
import { relationKey } from '@nesso-how/schema'
import { reconnectOperations } from './reconnection.ts'

const graph: GraphSnapshot = {
  concepts: ['a', 'b', 'c', 'd'].map((id) => ({
    id: `urn:${id}`,
    label: id,
    position: { x: 0, y: 0 },
  })),
  relationTypes: [
    { id: 'urn:links', label: 'links' },
    { id: 'urn:other', label: 'other' },
  ],
  relations: [
    { source: 'urn:a', predicate: 'urn:links', target: 'urn:b' },
    { source: 'urn:a', predicate: 'urn:other', target: 'urn:c' },
  ],
}

test('reconnecting shared sources or targets preserves each opposite endpoint and predicate', () => {
  for (const endpoint of ['source', 'target'] as const) {
    const current =
      endpoint === 'source'
        ? graph
        : {
            ...graph,
            relations: graph.relations.map(({ source, target, ...rest }) => ({
              ...rest,
              source: target,
              target: source,
            })),
          }
    assert.deepEqual(
      reconnectOperations(current, { relations: current.relations, endpoint }, 'urn:d'),
      current.relations.map((relation) => ({
        kind: 'relation.reconnect',
        id: relationKey(relation),
        source: endpoint === 'source' ? 'urn:d' : relation.source,
        target: endpoint === 'target' ? 'urn:d' : relation.target,
      })),
    )
    assert.equal(
      reconnectOperations(
        current,
        { relations: current.relations, endpoint },
        current.relations[0][endpoint],
      ).length,
      2,
    )
  }
})

test('one invalid relation rejects the complete reconnect rather than producing partial edits', () => {
  const reconnect = { relations: graph.relations, endpoint: 'source' as const }
  for (const target of ['urn:c', 'urn:missing'])
    assert.deepEqual(reconnectOperations(graph, reconnect, target), [])
  assert.deepEqual(reconnectOperations(graph, { ...reconnect, endpoint: 'target' }, 'urn:d'), [])
  assert.deepEqual(
    reconnectOperations({ ...graph, relations: [graph.relations[0]] }, reconnect, 'urn:d'),
    [],
  )
  const duplicate = { ...graph.relations[1], source: 'urn:d' }
  assert.deepEqual(
    reconnectOperations(
      { ...graph, relations: [...graph.relations, duplicate] },
      reconnect,
      'urn:d',
    ),
    [],
  )
  assert.equal(
    reconnectOperations(
      {
        ...graph,
        relations: [...graph.relations, { ...duplicate, predicate: 'urn:links' }],
      },
      reconnect,
      'urn:d',
    ).length,
    2,
  )
})
