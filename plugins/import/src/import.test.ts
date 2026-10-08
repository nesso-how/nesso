import assert from 'node:assert/strict'
import test from 'node:test'
import type { NessoState } from '@nesso/plugin'
import type { Graph } from '@nesso/schema'
import { buildImportOperations } from './index.ts'

const state: Pick<NessoState, 'graph' | 'workspace' | 'vocabs' | 'preferences'> = {
  graph: {
    concepts: [],
    relationTypes: [{ id: 'urn:knows', label: 'knows' }],
    relations: [],
  },
  workspace: { activeViewId: 'urn:active', savedViews: [], viewports: {} },
  vocabs: [{
    id: 'urn:vocab', label: 'Vocab', defaultTypeId: 'urn:default',
    relationTypes: [{ id: 'urn:default', label: 'related to' }],
  }],
  preferences: {
    activeVocabId: 'urn:vocab', activeRendererId: 'urn:renderer', activeThemeId: 'urn:theme',
    panels: { explorerWidth: 280, inspectorWidth: 280 },
  },
}

const snapshot: Graph = {
  concepts: [
    { id: 'urn:old-a', label: 'Alpha', position: { x: 1, y: 2 } },
    { id: 'urn:old-b', label: 'Beta', position: { x: 3, y: 4 } },
  ],
  relationTypes: [
    { id: 'urn:knows', label: 'knows' },
    { id: 'urn:likes', label: 'likes' },
  ],
  relations: [
    { source: 'urn:old-a', predicate: 'urn:knows', target: 'urn:old-b' },
    { source: 'urn:old-b', predicate: 'urn:likes', target: 'urn:old-a' },
    { source: 'urn:old-a', predicate: 'urn:likes', target: 'urn:old-b' },
    { source: 'urn:old-a', predicate: 'urn:missing', target: 'urn:old-b' },
    { source: 'urn:old-a', predicate: 'urn:knows', target: 'urn:ghost' },
    { source: 'urn:old-a', predicate: 'urn:knows', target: 'urn:old-a' },
  ],
}

test('import remaps concept ids and merges relations with missing types created once', () => {
  const operations = buildImportOperations(snapshot, state, 'urn:target')
  const adds = operations.filter((operation) => operation.kind === 'concept.add')
  assert.equal(adds.length, 2)
  const ids = adds.map((operation) => operation.kind === 'concept.add' ? operation.id : '')
  assert.ok(ids.every((id) => !id.startsWith('urn:old-')))
  const labels = operations.filter((operation) => operation.kind === 'concept.label')
  assert.deepEqual(labels.map((operation) => operation.kind === 'concept.label' ? operation.value : ''), ['Alpha', 'Beta'])
  const connects = operations.filter((operation) => operation.kind === 'relation.connect')
  assert.equal(connects.length, 3)
  const retypes = operations.filter((operation) => operation.kind === 'relation.type')
  assert.equal(retypes.length, 2)
  assert.deepEqual(retypes.map((operation) => operation.kind === 'relation.type' ? operation.typeId : ''), ['urn:knows', 'urn:likes'])
  const creates = operations.filter((operation) => operation.kind === 'relation.type.create')
  assert.equal(creates.length, 1)
  assert.equal(creates[0]?.kind === 'relation.type.create' ? creates[0].typeId : '', 'urn:likes')
  const joins = operations.filter((operation) => operation.kind === 'view.membership' && operation.viewId === 'urn:target')
  assert.equal(joins.length, 2)
  assert.ok(joins.every((operation) => operation.kind === 'view.membership' && operation.included))
  const leaves = operations.filter((operation) => operation.kind === 'view.membership' && operation.viewId === 'urn:active')
  assert.equal(leaves.length, 2)
  assert.ok(leaves.every((operation) => operation.kind === 'view.membership' && !operation.included))
})

test('import into the active view skips membership edits and empty snapshots are no-ops', () => {
  const same = buildImportOperations(snapshot, state, 'urn:active')
  assert.ok(same.every((operation) => operation.kind !== 'view.membership'))
  assert.deepEqual(buildImportOperations({ concepts: [], relationTypes: [], relations: [] }, state, null), [])
  const complete = buildImportOperations(snapshot, { ...state, workspace: { ...state.workspace, activeViewId: null } }, null)
  assert.ok(complete.every((operation) => operation.kind !== 'view.membership'))
})
