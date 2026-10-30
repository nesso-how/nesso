import assert from 'node:assert/strict'
import test from 'node:test'
import { createNessoStore } from '../store/create.ts'
import { createPluginPanel } from './panel.ts'
import type { ActionPackage } from './actions.ts'

const source: ActionPackage = {
  name: 'nesso-plugin-panel',
  entry: new Uint8Array([1]),
  manifest: { apiVersion: 1, kind: 'actions', entry: 'index.js', writes: [], capabilities: ['ui'] },
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

test('view navigation replaces panel instances without ending the action or reopening closed panels', async () => {
  for (const reason of ['close', 'abort'] as const) {
    const host = createNessoStore(null)
    const panel = createPluginPanel(host.store, { notify: () => '', dismiss: () => {} })
    const first = host.store.createView('First', [])
    const second = host.store.createView('Second', [])
    host.store.setView(first)
    const controller = new AbortController()
    let ended = false
    const pending = panel
      .open(
        source,
        {
          viewId: first,
          actionId: 'browse',
          descriptors: [{ id: 'browse', label: { en: 'Browse' }, ui: true as const }],
        },
        controller.signal,
      )
      .then(() => {
        ended = true
      })
    const initial = panel.getSnapshot()!
    assert.equal(initial.viewName, 'First')
    host.store.setLocale('it')
    assert.equal(panel.getSnapshot(), initial)
    const instances = new Set([initial.id])
    for (const [id, name] of [
      [second, 'Second'],
      [null, null],
      [first, 'First'],
    ] as const) {
      host.store.setView(id)
      const next = panel.getSnapshot()!
      assert.equal(instances.has(next.id), false)
      instances.add(next.id)
      assert.equal(next.viewName, name)
      assert.equal(next.status, 'loading')
      await Promise.resolve()
      assert.equal(ended, false)
    }
    host.store.deleteView(second)
    assert.ok(panel.getSnapshot())
    if (reason === 'close') panel.close()
    else controller.abort()
    await pending
    host.store.setView(null)
    assert.equal(panel.getSnapshot(), null)
  }
})
