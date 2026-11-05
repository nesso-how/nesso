import assert from 'node:assert/strict'
import test from 'node:test'
import { createNessoStore } from '../store/create.ts'
import { createPluginPanel } from './panel.ts'
import type { ActionPackage } from './actions.ts'
import { createPluginEntry } from './entry.ts'

const source: ActionPackage = {
  name: 'nesso-plugin-panel',
  entry: createPluginEntry(new Uint8Array([1])),
  manifest: { apiVersion: 2, kind: 'actions', entry: 'index.js', writes: [], capabilities: ['ui'] },
  i18n: {
    metadata: {
      name: { en: 'Example' },
      description: { en: 'Example' },
      documentation: { en: 'Example' },
    },
  },
}

test('central sessions are revoked by replacement, cancellation, reset or target deletion', async () => {
  for (const reason of ['replace', 'abort', 'reset', 'delete'] as const) {
    const host = createNessoStore(null)
    const panel = createPluginPanel(host.store, { notify: () => '', dismiss: () => {} })
    const viewId = host.store.createView(
      'Target',
      host.store.getState().graph.concepts.map(({ id }) => id),
    )
    const invocation = {
      viewId,
      actionId: 'browse',
      descriptors: [{ id: 'browse', label: { en: 'Browse' }, ui: true as const }],
    }
    const controller = new AbortController()
    const pending = panel.open(source, invocation, controller.signal)
    if (reason === 'abort') controller.abort()
    if (reason === 'reset')
      host.store.applyOperations([{ kind: 'document.reset', id: host.store.getState().documentId }])
    if (reason === 'delete') host.store.deleteView(viewId)
    if (reason === 'replace') {
      const replaced = panel.open(source, invocation, new AbortController().signal)
      await pending
      assert.ok(panel.getSnapshot())
      panel.close()
      await replaced
    }
    await pending
    assert.equal(panel.getSnapshot(), null)
  }
})

test('view navigation reuses panel frames without ending the action or reopening closed panels', async () => {
  const host = createNessoStore(null)
  const panel = createPluginPanel(host.store, { notify: () => '', dismiss: () => {} })
  const first = host.store.createView('First', [])
  const second = host.store.createView('Second', [])
  host.store.setView(first)
  let ended = false
  const pending = panel
    .open(
      source,
      {
        viewId: first,
        actionId: 'browse',
        descriptors: [{ id: 'browse', label: { en: 'Browse' }, ui: true as const }],
      },
      new AbortController().signal,
    )
    .then(() => {
      ended = true
    })
  const initial = panel.getSnapshot()!
  assert.equal(initial.viewName, 'First')
  host.store.setLocale('it')
  assert.equal(panel.getSnapshot(), initial)
  for (const [id, name] of [
    [second, 'Second'],
    [null, null],
    [first, 'First'],
  ] as const) {
    host.store.setView(id)
    const next = panel.getSnapshot()!
    assert.equal(next.id, initial.id)
    assert.equal(next.frameId, initial.frameId)
    assert.equal(next.viewName, name)
    assert.equal(next.status, 'loading')
    await Promise.resolve()
    assert.equal(ended, false)
  }
  host.store.deleteView(second)
  assert.ok(panel.getSnapshot())
  panel.close()
  await pending
  host.store.setView(null)
  assert.equal(panel.getSnapshot(), null)
})

test('only Notes and Review are preloaded and retained until invalidation', async () => {
  const host = createNessoStore(null)
  const panel = createPluginPanel(host.store, { notify: () => '', dismiss: () => {} })
  const notes = { ...source, name: '@nesso-how/notes' }
  const review = { ...source, name: '@nesso-how/review' }
  const warming = panel.preload([source, notes, notes, review])
  const initial = panel.getFrames()
  assert.deepEqual(
    initial.map(({ source }) => source.name),
    [notes.name, review.name],
  )
  const open = async (source: ActionPackage) => {
    const pending = panel.open(
      source,
      {
        actionId: 'browse',
        viewId: null,
        descriptors: [{ id: 'browse', label: { en: 'Browse' }, ui: true }],
      },
      new AbortController().signal,
    )
    const frame = panel.getFrames().find((frame) => frame.source === source)
    panel.close()
    await pending
    return frame
  }
  assert.equal(await open(notes), initial[0])
  assert.equal(await open(review), initial[1])
  assert.notEqual(await open(source), await open(source))
  assert.deepEqual(panel.getFrames(), initial)
  const replacement = await open({ ...notes })
  assert.notEqual(replacement, initial[0])
  assert.deepEqual(panel.getFrames(), [initial[1], replacement])
  panel.invalidate(review.name)
  assert.deepEqual(
    panel.getFrames().map(({ source }) => source.name),
    [notes.name],
  )
  host.store.applyOperations([{ kind: 'document.reset', id: host.store.getState().documentId }])
  assert.deepEqual(panel.getFrames(), [])
  await warming
})
