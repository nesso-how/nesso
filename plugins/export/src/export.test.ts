import assert from 'node:assert/strict'
import test from 'node:test'
import type { NessoStore, Notification } from '@nesso/plugin'
import { exportPlugin } from './index.ts'

test('export notifies only after successful downloads, using its injected API and current locale', (context) => {
  const graph = { concepts: [{ id: 'urn:concept', label: 'One', position: { x: 0, y: 0 } }], relations: [], relationTypes: [] }
  const state = {
    viewGraph: graph,
    workspace: { activeViewId: null, savedViews: [{ id: 'urn:view', name: 'Test view' }] },
    preferences: { locale: 'it' },
  }
  const getViewGraph = context.mock.fn(() => graph)
  const store = { getState: () => state, getViewGraph } as unknown as NessoStore
  const anchor = { href: '', download: '', click: context.mock.fn() }
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => anchor } })
  context.after(() => { Reflect.deleteProperty(globalThis, 'document') })
  context.mock.method(URL, 'createObjectURL', () => 'blob:export')
  context.mock.method(URL, 'revokeObjectURL', () => {})
  const notify = context.mock.fn((_notification: Notification) => {
    assert.ok(anchor.click.mock.callCount() > 0)
    return 'export-notification'
  })
  const dismiss = context.mock.fn()
  assert.ok(exportPlugin.kind === 'actions')
  const [action] = exportPlugin.create({ store, notifications: { notify, dismiss } })
  const otherNotify = context.mock.fn(() => 'other-notification')
  exportPlugin.create({ store, notifications: { notify: otherNotify, dismiss } })
  action.runOnView?.('urn:view')
  assert.equal(anchor.download, 'nesso-test-view.jsonld')
  assert.deepEqual(getViewGraph.mock.calls[0].arguments, ['urn:view'])
  assert.deepEqual(notify.mock.calls[0].arguments[0], {
    tone: 'info', title: 'Vista esportata', description: 'Download JSON-LD avviato.',
  })
  state.preferences.locale = 'en'
  action.run()
  assert.equal(anchor.download, 'nesso-graph.jsonld')
  assert.deepEqual(notify.mock.calls[1].arguments[0], {
    tone: 'info', title: 'View exported', description: 'JSON-LD download started.',
  })
  assert.equal(otherNotify.mock.callCount(), 0)
  anchor.click.mock.mockImplementationOnce(() => { throw new Error('Download failed') })
  assert.throws(() => action.run(), /Download failed/)
  assert.equal(notify.mock.callCount(), 2)
})
