import assert from 'node:assert/strict'
import test from 'node:test'
import type { NessoStore, Notification } from '@nesso/plugin'
import { exportPlugin } from './index.ts'

const graph = { concepts: [{ id: 'urn:concept', label: 'One', position: { x: 0, y: 0 } }], relations: [], relationTypes: [] }
const setupState = () => ({
  viewGraph: graph,
  workspace: { activeViewId: null, savedViews: [{ id: 'urn:view', name: 'Test view' }] },
  preferences: { locale: 'it' },
})

test('export notifies only after successful downloads, using its injected API and current locale', async (context) => {
  const state = setupState()
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
  await action.runOnView?.('urn:view')
  assert.equal(anchor.download, 'nesso-test-view.jsonld')
  assert.deepEqual(getViewGraph.mock.calls[0].arguments, ['urn:view'])
  assert.deepEqual(notify.mock.calls[0].arguments[0], {
    tone: 'info', title: 'Vista esportata', description: 'Download JSON-LD avviato.',
  })
  state.preferences.locale = 'en'
  await action.run()
  assert.equal(anchor.download, 'nesso-graph.jsonld')
  assert.deepEqual(notify.mock.calls[1].arguments[0], {
    tone: 'info', title: 'View exported', description: 'JSON-LD download started.',
  })
  assert.equal(otherNotify.mock.callCount(), 0)
  anchor.click.mock.mockImplementationOnce(() => { throw new Error('Download failed') })
  await assert.rejects(Promise.resolve(action.run()), /Download failed/)
  assert.equal(notify.mock.callCount(), 2)
})

test('export waits for the save picker before notifying', async (context) => {
  const state = setupState()
  const getViewGraph = context.mock.fn(() => graph)
  const store = { getState: () => state, getViewGraph } as unknown as NessoStore
  const written: string[] = []
  const writable = {
    write: context.mock.fn(async (data: string) => { written.push(data) }),
    close: context.mock.fn(async () => {}),
  }
  const handle = { createWritable: context.mock.fn(async () => writable) }
  const picker = context.mock.fn(async (_options: unknown) => handle)
  Object.defineProperty(globalThis, 'showSaveFilePicker', { configurable: true, value: picker })
  context.after(() => { Reflect.deleteProperty(globalThis, 'showSaveFilePicker') })
  const createElement = context.mock.fn(() => { throw new Error('fallback download must not run') })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement } })
  context.after(() => { Reflect.deleteProperty(globalThis, 'document') })
  const notify = context.mock.fn((_notification: Notification) => {
    assert.ok(writable.close.mock.callCount() > 0)
    return 'export-notification'
  })
  const dismiss = context.mock.fn()
  assert.ok(exportPlugin.kind === 'actions')
  const [action] = exportPlugin.create({ store, notifications: { notify, dismiss } })
  await action.runOnView?.('urn:view')
  assert.equal(picker.mock.callCount(), 1)
  assert.deepEqual(picker.mock.calls[0].arguments[0], { suggestedName: 'nesso-test-view.jsonld' })
  assert.deepEqual(getViewGraph.mock.calls[0].arguments, ['urn:view'])
  assert.equal(createElement.mock.callCount(), 0)
  assert.equal(written.length, 1)
  assert.ok(written[0].includes('urn:concept'))
  assert.equal(writable.close.mock.callCount(), 1)
  assert.deepEqual(notify.mock.calls[0].arguments[0], {
    tone: 'info', title: 'Vista esportata', description: 'Download JSON-LD avviato.',
  })
})

test('export stays silent when the save picker is cancelled', async (context) => {
  const state = setupState()
  const store = { getState: () => state, getViewGraph: context.mock.fn(() => graph) } as unknown as NessoStore
  const picker = context.mock.fn(async () => { throw new DOMException('Cancelled', 'AbortError') })
  Object.defineProperty(globalThis, 'showSaveFilePicker', { configurable: true, value: picker })
  context.after(() => { Reflect.deleteProperty(globalThis, 'showSaveFilePicker') })
  const createElement = context.mock.fn(() => { throw new Error('fallback download must not run') })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement } })
  context.after(() => { Reflect.deleteProperty(globalThis, 'document') })
  const notify = context.mock.fn((_notification: Notification) => 'export-notification')
  assert.ok(exportPlugin.kind === 'actions')
  const [action] = exportPlugin.create({ store, notifications: { notify, dismiss: context.mock.fn() } })
  await action.runOnView?.('urn:view')
  assert.equal(picker.mock.callCount(), 1)
  assert.equal(createElement.mock.callCount(), 0)
  assert.equal(notify.mock.callCount(), 0)
})

test('export stays silent when writing the picked file fails', async (context) => {
  const state = setupState()
  const store = { getState: () => state, getViewGraph: context.mock.fn(() => graph) } as unknown as NessoStore
  const handle = { createWritable: context.mock.fn(async () => { throw new Error('Write failed') }) }
  Object.defineProperty(globalThis, 'showSaveFilePicker', { configurable: true, value: context.mock.fn(async () => handle) })
  context.after(() => { Reflect.deleteProperty(globalThis, 'showSaveFilePicker') })
  const notify = context.mock.fn((_notification: Notification) => 'export-notification')
  assert.ok(exportPlugin.kind === 'actions')
  const [action] = exportPlugin.create({ store, notifications: { notify, dismiss: context.mock.fn() } })
  await assert.rejects(Promise.resolve(action.runOnView?.('urn:view')), /Write failed/)
  assert.equal(notify.mock.callCount(), 0)
})
