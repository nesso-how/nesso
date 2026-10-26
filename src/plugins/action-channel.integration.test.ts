import assert from 'node:assert/strict'
import test from 'node:test'
import { createPluginClient, themeTokens, runtimeLimits, type ActionDescriptor, type BaseState, type FileOpenResult, type PluginError } from '@nesso-how/plugin/runtime'
import { createNessoStore } from '../store/create.ts'
import { connectActionChannel } from './action-channel.ts'
import type { NessoOperation } from '@nesso-how/plugin'

const descriptors: readonly ActionDescriptor[] = [{ id: 'example', label: { en: 'Example' }, supportsViews: true }]
const base: BaseState = { revision: 0, contextId: 'context', locale: 'en', theme: Object.fromEntries(themeTokens.map((token) => [token, ''])), conceptPlacementOffset: { x: 160, y: 100 } }
const graph = { concepts: [{ id: 'urn:a', label: 'A', position: { x: 0, y: 0 } }, { id: 'urn:b', label: 'B', position: { x: 100, y: 0 } }], relationTypes: [], relations: [] }

function fixture(discovery = false, open: () => Promise<FileOpenResult> = async () => null, writes: readonly NessoOperation['kind'][] = ['concept.label', 'concept.color'], capabilities: readonly string[] = ['files.open']) {
  const host = createNessoStore(graph)
  const target = host.store.createView('Target', ['urn:a'])
  host.store.setView(null)
  host.store.setSelection([{ kind: 'concept', id: 'urn:b' }])
  const channel = new MessageChannel()
  const failures: PluginError[] = []
  const found: (readonly ActionDescriptor[])[] = []
  const notified: string[] = []
  const descriptions: (string | undefined)[] = []
  const dismissed: string[] = []
  const runtime = connectActionChannel(channel.port1, host.store, { writes, capabilities, invocation: discovery ? undefined : { actionId: 'example', viewId: target, descriptors } }, base, {
    files: { open, save: async () => ({ saved: true }) },
    notify: ({ title, description }) => { notified.push(title); descriptions.push(description); return title }, dismiss: (id) => { dismissed.push(id) },
    discovered: (value) => found.push(value), activated: () => {}, complete: () => {}, failed: (error) => failures.push(error),
  })
  const client = createPluginClient(channel.port2, runtime.snapshot())
  const start = async (value = descriptors) => { channel.port2.postMessage({ type: 'contribution', value }); await client.context.store.refresh() }
  const close = () => { runtime.close(); client.close() }
  return { host, target, channel, runtime, client, failures, found, notified, descriptions, dismissed, start, close }
}

test('action projections stay bound to the invoked view, filter off-view selection and synchronize atomic writes', async (t) => {
  const instance = fixture()
  t.after(instance.close)
  const { store } = instance.client.context
  const before = store.getState()
  assert.ok('viewGraph' in before)
  assert.equal('graph' in before, false)
  assert.equal('conversation' in before, false)
  assert.deepEqual(before.viewGraph.concepts.map(({ id }) => id), ['urn:a'])
  assert.deepEqual(before.selected, [])
  assert.equal('conceptIds' in before.workspace.savedViews[0], false)
  await assert.rejects(store.applyOperations([{ kind: 'concept.label', id: 'urn:a', value: 'Early' }]), { code: 'denied' })
  await instance.start()
  instance.host.store.setView(instance.target)
  await store.refresh()
  await store.applyOperations([{ kind: 'concept.label', id: 'urn:a', value: 'Changed' }], { atRevision: store.getState().revision })
  const state = store.getState()
  assert.ok('viewGraph' in state)
  assert.equal(state.targetViewId, instance.target)
  assert.equal(state.viewGraph.concepts[0].label, 'Changed')
  assert.equal('getViewGraph' in store, false)
  await assert.rejects(store.applyOperations([{ kind: 'concept.label', id: 'urn:a', value: 'Stale' }], { atRevision: before.revision }), { code: 'stale-state' })
  await assert.rejects(store.applyOperations([{ kind: 'concept.label', id: 'urn:a', value: 'No' }, { kind: 'concept.remove', id: 'urn:b' }]), { code: 'denied' })
  await store.applyOperations([{ kind: 'concept.color', id: 'urn:a', value: '#123456' }])
  assert.equal(instance.host.store.getState().graph.concepts[0].color, '#123456')
})

test('isolated clients have no clipboard API and raw clipboard requests close the channel without effects', async (t) => {
  for (const method of ['clipboard.readText', 'clipboard.writeText']) {
    const instance = fixture()
    t.after(instance.close)
    await instance.start()
    assert.equal('clipboard' in instance.client.context, false)
    const before = instance.host.store.getState()
    instance.channel.port2.postMessage({ type: 'request', id: 1000, contextId: base.contextId, method, params: method === 'clipboard.writeText' ? { text: 'Forbidden' } : {} })
    await assert.rejects(instance.client.context.store.refresh(), { code: 'closed' })
    assert.equal(instance.failures[0].code, 'invalid-input')
    assert.equal(instance.host.store.getState(), before)
  }
})

test('notifications require a declared capability and retain host rate limits and revocation', async (t) => {
  const denied = fixture()
  t.after(denied.close)
  await denied.start()
  await assert.rejects(denied.client.context.notifications.notify({ tone: 'info', title: { en: 'Undeclared' } }), { code: 'denied' })
  assert.deepEqual(denied.notified, [])
  const allowed = fixture(false, undefined, [], ['notifications.notify'])
  t.after(allowed.close)
  await assert.rejects(allowed.client.context.notifications.notify({ tone: 'info', title: { en: 'Early' } }), { code: 'denied' })
  await allowed.start()
  for (let index = 0; index < 10; index++) assert.equal(await allowed.client.context.notifications.notify({ tone: 'info', title: { en: `Notice ${index}` } }), `Notice ${index}`)
  await assert.rejects(allowed.client.context.notifications.notify({ tone: 'info', title: { en: 'Over limit' } }), { code: 'denied' })
  assert.equal(allowed.notified.length, 10)
  assert.deepEqual(allowed.dismissed, allowed.notified.slice(0, 5))
  allowed.runtime.close()
  await assert.rejects(allowed.client.context.notifications.notify({ tone: 'info', title: { en: 'Late' } }), { code: 'closed' })
  assert.equal(allowed.notified.length, 10)
  assert.deepEqual(allowed.dismissed, allowed.notified)
})

test('the host resolves notification text in the current locale and preserves localized action failures', async (t) => {
  const instance = fixture(false, undefined, [], ['notifications.notify'])
  t.after(instance.close)
  await instance.start()
  instance.host.store.setLocale('it')
  const notification = { tone: 'info' as const, title: { en: 'Notice', it: 'Avviso' }, description: { en: 'English fallback' } }
  assert.equal(await instance.client.context.notifications.notify(notification), 'Avviso')
  instance.host.store.setLocale('zh-CN')
  assert.equal(await instance.client.context.notifications.notify(notification), 'Notice')
  assert.deepEqual(instance.notified, ['Avviso', 'Notice'])
  assert.deepEqual(instance.descriptions, ['English fallback', 'English fallback'])
  const displayMessage = { en: 'Failed', it: 'Operazione fallita' }
  instance.channel.port2.postMessage({ type: 'complete', ok: false, error: { code: 'failed', issues: [{ path: 'action', message: 'Technical failure' }], displayMessage } })
  await assert.rejects(instance.client.context.store.refresh(), { code: 'closed' })
  assert.deepEqual(instance.failures[0].displayMessage, displayMessage)
  assert.deepEqual(instance.failures[0].issues, [{ path: 'action', message: 'Technical failure' }])
})

test('discovery has only base state and no effects; invocation rejects descriptors different from discovery', async (t) => {
  const discovery = fixture(true, undefined, undefined, ['files.open', 'notifications.notify'])
  t.after(discovery.close)
  assert.equal('viewGraph' in discovery.client.context.store.getState(), false)
  await assert.rejects(discovery.client.context.files.open({ extensions: ['json'], mimeTypes: [] }), { code: 'denied' })
  await assert.rejects(discovery.client.context.notifications.notify({ tone: 'info', title: { en: 'Denied' } }), { code: 'denied' })
  discovery.channel.port2.postMessage({ type: 'contribution', value: descriptors })
  await assert.rejects(discovery.client.context.store.refresh(), { code: 'closed' })
  assert.deepEqual(discovery.found, [descriptors])
  const invocation = fixture()
  t.after(invocation.close)
  await assert.rejects(invocation.start([{ ...descriptors[0], label: { en: 'Changed' } }]), { code: 'closed' })
  assert.equal(invocation.failures[0].code, 'denied')
})

test('typed plugin writes are asynchronous, synchronize snapshots and preserve validation, declarations and history groups', async (t) => {
  const instance = fixture(false, undefined, ['concept.label', 'concept.color', 'concept.description'])
  t.after(instance.close)
  const { store } = instance.client.context
  await instance.start()
  const before = instance.host.store.getState()
  const pending = store.setConceptLabel('urn:a', 'First', 'edit')
  assert.ok(pending instanceof Promise)
  assert.equal(instance.host.store.getState(), before)
  assert.equal(await pending, undefined)
  await store.setConceptLabel('urn:a', 'Second', 'edit')
  const state = store.getState()
  assert.ok('viewGraph' in state)
  assert.equal(state.viewGraph.concepts[0].label, 'Second')
  await store.setConceptLabel('urn:a', 'Second', 'edit')
  assert.equal(store.getState(), state)
  await assert.rejects(store.setConceptLabel('urn:a', 'x'.repeat(300)), { code: 'invalid-input' })
  const committed = instance.host.store.getState()
  await assert.rejects(store.addConcept(), { code: 'denied' })
  assert.equal('createView' in store, false)
  assert.equal('setView' in store, false)
  assert.equal('undo' in store, false)
  assert.equal(instance.host.store.getState(), committed)
  await store.setConceptColor('urn:a', '#123456')
  assert.equal(instance.host.store.getState().graph.concepts[0].color, '#123456')
  await store.setConceptDescription('urn:a', 'Described')
  assert.equal(instance.host.store.getState().graph.concepts[0].description, 'Described')
  instance.host.store.setConceptLabel('urn:a', 'Host edit', 'edit')
  await store.setConceptLabel('urn:a', 'Plugin edit', 'edit')
  assert.equal(instance.host.store.getState().graph.concepts[0].label, 'Plugin edit')
  assert.equal('resetGraph' in store || 'setViewport' in store || 'setActiveRenderer' in store, false)
})

test('concept colors cross isolated snapshots and declared commands with atomic validation', async (t) => {
  const denied = fixture(false, undefined, ['concept.label'])
  t.after(denied.close)
  await denied.start()
  await assert.rejects(denied.client.context.store.setConceptColor('urn:a', '#654321'), { code: 'denied' })
  const instance = fixture(false, undefined, ['concept.color', 'concept.label'])
  t.after(instance.close)
  instance.host.store.setConceptColor('urn:a', '#123456')
  await instance.start()
  const { store } = instance.client.context
  const color = () => {
    const state = store.getState()
    assert.ok('viewGraph' in state)
    return state.viewGraph.concepts[0].color
  }
  assert.equal(color(), '#123456')
  await store.setConceptColor('urn:a', '#ABCDEF')
  assert.equal(color(), '#abcdef')
  const before = instance.host.store.getState()
  await assert.rejects(store.setConceptColor('urn:a', 'red'), { code: 'invalid-input' })
  assert.equal(instance.host.store.getState(), before)
  await store.setConceptColor('urn:a', '')
  assert.equal(color(), undefined)
  await store.setConceptColor('urn:a', '#abcdef')
  assert.equal(color(), '#abcdef')
  await store.setConceptColor('urn:a', '#123456')
  assert.equal(color(), '#123456')
})

test('declared writes reject relative graph identifiers atomically without changing snapshots or history', async (t) => {
  const instance = fixture(false, undefined, ['concept.add', 'concept.label', 'relation.connect'])
  t.after(instance.close)
  await instance.start()
  const { store } = instance.client.context
  const before = instance.host.store.getState()
  const snapshot = store.getState()
  for (const operation of [
    { kind: 'concept.add', id: 'relative-concept' },
    { kind: 'relation.connect', source: 'urn:a', target: 'urn:b', type: { id: 'relative-type', label: 'Invalid' } },
  ] satisfies NessoOperation[]) {
    await assert.rejects(store.applyOperations([{ kind: 'concept.label', id: 'urn:a', value: 'Must roll back' }, operation]), { code: 'invalid-input' })
    assert.equal(instance.host.store.getState(), before)
    assert.equal(store.getState(), snapshot)
  }
})

test('plugin creation helpers resolve stable IDs after commit and reject failed or closed requests without publishing IDs', async (t) => {
  const instance = fixture(false, undefined, ['concept.add', 'concept.label'])
  t.after(instance.close)
  await instance.start()
  instance.host.store.setView(instance.target)
  instance.host.store.setSelection([])
  const { store } = instance.client.context
  assert.equal('createView' in store, false)
  const concept = await store.addConcept({ x: 40, y: 50 })
  const state = store.getState()
  assert.ok('viewGraph' in state)
  assert.ok(state.viewGraph.concepts.some(({ id }) => id === concept))
  assert.ok(instance.host.store.getState().workspace.savedViews[0].conceptIds.includes(concept))
  await store.setConceptLabel(concept, 'Created', 'edit')
  const created = store.getState()
  assert.ok('viewGraph' in created)
  assert.equal(created.viewGraph.concepts.find(({ id }) => id === concept)?.label, 'Created')
  const committed = instance.host.store.getState()
  assert.equal(committed.graph.concepts.find(({ id }) => id === concept)?.label, 'Created')
  await assert.rejects(store.addConcept({ x: NaN, y: 0 }), { code: 'invalid-input' })
  await assert.rejects(store.setConceptLabel(concept, 'x'.repeat(300)), { code: 'invalid-input' })
  assert.equal(instance.host.store.getState(), committed)
  instance.runtime.close()
  await assert.rejects(store.addConcept(), { code: 'closed' })
  await assert.rejects(store.setConceptLabel(concept, 'Closed'), { code: 'closed' })
  assert.equal(instance.host.store.getState(), committed)
})

test('pending file work survives navigation but target deletion revokes it and prevents late effects', async (t) => {
  let resolve: (value: FileOpenResult) => void = () => {}
  let began: () => void = () => {}
  const started = new Promise<void>((done) => { began = done })
  const instance = fixture(false, () => { began(); return new Promise((done) => { resolve = done }) })
  t.after(instance.close)
  await instance.start()
  const result = instance.client.context.files.open({ extensions: ['json'], mimeTypes: [] })
  await started
  instance.host.store.setView(instance.target)
  await instance.client.context.store.refresh()
  await assert.rejects(instance.client.context.files.open({ extensions: ['json'], mimeTypes: [] }), { code: 'unavailable' })
  instance.host.store.deleteView(instance.target)
  await assert.rejects(result, { code: 'closed' })
  assert.equal(instance.failures[0].code, 'stale-context')
  resolve({ name: 'late.json', mediaType: 'application/json', text: '{}' })
  await assert.rejects(instance.client.context.store.applyOperations([{ kind: 'concept.label', id: 'urn:a', value: 'Late' }]), { code: 'closed' })
  assert.equal(instance.host.store.getState().graph.concepts[0].label, 'A')
})

test('host deadlines revoke running actions and pause only within the bounded file interaction budget', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const running = fixture()
  t.after(running.close)
  await running.start()
  t.mock.timers.tick(runtimeLimits.action)
  assert.equal(running.runtime.signal.aborted, true)
  assert.equal(running.failures[0].code, 'timeout')
  let began: () => void = () => {}
  const started = new Promise<void>((resolve) => { began = resolve })
  const waiting = fixture(false, () => { began(); return new Promise(() => {}) })
  t.after(waiting.close)
  await waiting.start()
  const result = waiting.client.context.files.open({ extensions: ['json'], mimeTypes: [] })
  const rejected = assert.rejects(result, { code: 'closed' })
  await started
  t.mock.timers.tick(runtimeLimits.action)
  assert.equal(waiting.runtime.signal.aborted, false)
  t.mock.timers.tick(runtimeLimits.interaction - runtimeLimits.action)
  await rejected
  assert.equal(waiting.runtime.signal.aborted, true)
  assert.equal(waiting.failures[0].code, 'timeout')
})
