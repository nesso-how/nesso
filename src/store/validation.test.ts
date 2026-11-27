import assert from 'node:assert/strict'
import test from 'node:test'
import type { WorkspaceState } from '@nesso-how/core'
import { NessoError } from '@nesso-how/errors'
import type { Graph } from '@nesso-how/schema'
import {
  checkGraph,
  checkGraphChanges,
  checkWorkspace,
  checkWorkspaceChanges,
  type GraphChanges,
} from './validation.ts'

const graph: Graph = {
  concepts: [
    { id: 'urn:n1', label: 'One' },
    { id: 'urn:n2', label: 'Two' },
  ],
  relationTypes: [{ id: 'urn:links', label: 'links' }],
  relations: [{ source: 'urn:n1', predicate: 'urn:links', target: 'urn:n2' }],
}
const workspace: WorkspaceState = {
  activeMapId: null,
  pinnedMapIds: [],
  mapGroups: [],
  maps: [
    {
      id: 'urn:map',
      name: 'Map',
      members: graph.concepts.map(({ id }) => ({ id, position: { x: 0, y: 0 } })),
    },
  ],
  viewports: {},
}
const removal: GraphChanges = {
  concepts: [{ id: 'urn:n2', before: { index: 1, value: graph.concepts[1] } }],
  relations: [],
  relationTypes: [],
}

const issues = (check: () => void): NessoError['issues'] => {
  try {
    check()
  } catch (error) {
    if (error instanceof NessoError) return error.issues
    throw error
  }
  return assert.fail('Expected validation to fail')
}

test('incremental checks report full issues when a removal breaks unchanged references', () => {
  const removed = { ...graph, concepts: [graph.concepts[0]] }
  assert.deepEqual(
    issues(() => checkGraphChanges(removed, removal)),
    issues(() => checkGraph(removed)),
  )
  const pruned = { ...removed, relations: [] }
  checkGraphChanges(pruned, removal)
  assert.deepEqual(
    issues(() => checkWorkspaceChanges(pruned, workspace, workspace, removal)),
    issues(() => checkWorkspace(pruned, workspace)),
  )
})
