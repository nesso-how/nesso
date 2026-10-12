import assert from 'node:assert/strict'
import test from 'node:test'
import type { Graph } from '@nesso/schema'
import { createSeedDocument } from '../data/seed.ts'
import { initializeNessoStore } from './initialize.ts'
import type { LoadedState } from './persistence.ts'

const empty: LoadedState = { blocked: [], issues: [] }

test('first-run initialization uses the detected language for both the interface and seed document', () => {
  for (const [language, locale] of [['en-US', 'en'], ['it-IT', 'it'], ['zh-SG', 'zh-CN']] as const) {
    const host = initializeNessoStore(empty, [language])
    const state = host.store.getState()
    const seed = createSeedDocument(locale)
    assert.equal(state.preferences.locale, locale)
    assert.deepEqual(state.graph, seed.graph)
    assert.deepEqual(state.workspace, seed.workspace)
  }
})

test('a saved language choice takes precedence over browser preferences when seeding', () => {
  const preferences = initializeNessoStore(empty, ['en-US']).store.getState().preferences
  const state = initializeNessoStore({ ...empty, preferences }, ['zh-CN', 'it-IT']).store.getState()
  assert.equal(state.preferences.locale, 'en')
  assert.deepEqual(state.graph, createSeedDocument('en').graph)
  assert.deepEqual(state.workspace, createSeedDocument('en').workspace)
})

test('restored documents retain their content and edits even when detecting a different interface language', () => {
  const host = initializeNessoStore(empty, ['zh-CN'])
  host.store.setConceptLabel(host.store.getState().graph.concepts[0].id, 'My edited concept')
  host.store.renameView('first-try', 'My edited view')
  const before = host.store.getState()
  const restored = initializeNessoStore({ ...empty, graph: structuredClone(before.graph) as Graph, workspace: before.workspace }, ['it-IT']).store.getState()
  assert.equal(restored.preferences.locale, 'it')
  assert.deepEqual(restored.graph, before.graph)
  assert.deepEqual(restored.workspace, before.workspace)
})

test('deleted and unreadable documents start with one fresh concept rather than a translated seed', () => {
  for (const loaded of [
    { ...empty, graph: null },
    { ...empty, blocked: ['document'], issues: [{ section: 'document', operation: 'read', path: 'document', message: 'Unreadable document' }] },
  ] satisfies LoadedState[]) {
    const state = initializeNessoStore(loaded, ['zh-CN']).store.getState()
    assert.equal(state.preferences.locale, 'zh-CN')
    assert.equal(state.graph.concepts.length, 1)
    assert.equal(state.graph.concepts[0].label, 'Concept 1')
    assert.deepEqual(state.graph.relations, [])
    assert.deepEqual(state.workspace.savedViews, [])
    assert.deepEqual(state.persistenceIssues, loaded.issues)
  }
})
