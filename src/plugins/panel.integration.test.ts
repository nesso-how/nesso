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
